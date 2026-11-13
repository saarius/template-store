"""Synthetic snapshots and receipt failures; no production configuration or network."""
import contextlib
import hashlib
import json
import pathlib
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import backup
import upload_recovery_status as monitor


class UploadRecoveryStatusTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        (self.root / 'uploads').mkdir()
        self.media = self.root / 'uploads/image.png'
        self.media.write_bytes(b'synthetic media')
        with contextlib.closing(sqlite3.connect(self.root / 'content.db')) as db:
            db.execute('CREATE TABLE media (storage_key TEXT, size INTEGER, content_hash TEXT, status TEXT)')
            db.execute('INSERT INTO media VALUES (?, ?, ?, ?)', ('image.png', self.media.stat().st_size,
                       'sha1:' + hashlib.sha1(self.media.read_bytes()).hexdigest(), 'ready'))
            db.commit()
        self.archive = backup.snapshot(self.root)
        self.receipt = self.root / monitor.RECEIPT

    def test_current_verified_receipt_is_public_safe_and_private_on_disk(self):
        result = monitor.check_latest(self.root)
        self.assertEqual(result['state'], 'verified')
        self.assertEqual(result['counts']['readyMediaVerified'], 1)
        self.assertEqual(self.receipt.stat().st_mode & 0o777, 0o600)
        self.assertNotIn('archive', result)
        for private in [self.archive.name, str(self.root), 'image.png', 'sha1:', 'inode']:
            self.assertNotIn(private, json.dumps(result))
        self.assertEqual(monitor.public_status(self.root), result)
        self.assertEqual(list(self.root.glob('.upload-recovery-*')), [])

    def test_new_snapshot_cannot_inherit_old_success_and_retention_is_unchanged(self):
        monitor.check_latest(self.root)
        for _ in range(4):
            backup.snapshot(self.root)
        self.assertEqual(monitor.public_status(self.root)['state'], 'not-checked')
        self.assertEqual(len(list((self.root / 'backups').glob('*.tar.gz'))), 3)
        self.assertEqual(monitor.check_latest(self.root)['state'], 'verified')

    def test_modified_archive_invalidates_receipt_even_if_bytes_size_mtime_preserved(self):
        import os
        monitor.check_latest(self.root)
        before = self.archive.stat()
        # Replacing with identical bytes still changes file identity.
        replacement = self.root / 'replacement'; replacement.write_bytes(self.archive.read_bytes())
        replacement.chmod(0o600)
        os.utime(replacement, ns=(before.st_atime_ns, before.st_mtime_ns))
        replacement.replace(self.archive)
        self.assertEqual(monitor.public_status(self.root)['state'], 'not-checked')

    def test_failed_drill_replaces_old_success_without_details_and_retains_archive(self):
        monitor.check_latest(self.root)
        before = self.archive.read_bytes()
        with patch.object(monitor, 'verify_archive', side_effect=RuntimeError('private do not expose')):
            with self.assertRaisesRegex(RuntimeError, '^upload_check_failed$'):
                monitor.check_latest(self.root)
        result = monitor.public_status(self.root)
        self.assertEqual(result['state'], 'failed')
        self.assertIsNone(result['counts'])
        self.assertNotIn('private do not expose', self.receipt.read_text())
        self.assertEqual(self.archive.read_bytes(), before)

    def test_concurrent_external_archive_mutation_cannot_produce_success(self):
        original = monitor.verify_archive
        def mutate(archive):
            result = original(archive)
            archive.touch()
            return result
        with patch.object(monitor, 'verify_archive', side_effect=mutate):
            with self.assertRaisesRegex(RuntimeError, 'upload_check_failed'):
                monitor.check_latest(self.root)
        self.assertEqual(json.loads(self.receipt.read_text())['state'], 'failed')
        self.assertNotEqual(monitor.public_status(self.root)['state'], 'verified')

    def test_missing_no_archive_corrupt_and_unreadable_receipt_are_not_zero_success(self):
        self.assertEqual(monitor.public_status(self.root)['state'], 'not-checked')
        for data in ['not json', '{}', '[]', 'x' * 4097]:
            self.receipt.write_text(data); self.receipt.chmod(0o600)
            self.assertEqual(monitor.public_status(self.root)['state'], 'unavailable')
        self.archive.unlink()
        self.assertEqual(monitor.public_status(self.root)['state'], 'no-backup')

    def test_receipt_schema_counts_and_time_fail_closed(self):
        monitor.check_latest(self.root)
        valid = json.loads(self.receipt.read_text())
        mutations = [dict(schema='wrong'), dict(state='surprise'), dict(checkedAt='not a time'),
                     dict(checkedAt='2099-01-01T00:00:00+00:00'), dict(checkedAt='2026-01-01'),
                     dict(counts={**valid['counts'], 'readyMediaVerified': True}),
                     dict(counts={**valid['counts'], 'readyMediaVerified': -1}),
                     dict(counts={**valid['counts'], 'readyMediaVerified': 2}),
                     dict(counts={**valid['counts'], 'readyMediaBytesVerified': 10000}),
                     dict(counts={**valid['counts'], 'extra': 'private'})]
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                self.receipt.write_text(json.dumps({**valid, **mutation}))
                self.assertEqual(monitor.public_status(self.root)['state'], 'unavailable')

    def test_linked_or_public_receipt_refused_without_overwriting_target(self):
        monitor.check_latest(self.root)
        self.receipt.chmod(0o644)
        self.assertEqual(monitor.public_status(self.root)['state'], 'unavailable')
        self.receipt.unlink()
        target = self.root / 'private-target'; target.write_text('never overwrite')
        self.receipt.symlink_to(target)
        self.assertEqual(monitor.public_status(self.root)['state'], 'unavailable')
        with self.assertRaises(RuntimeError):
            monitor.check_latest(self.root)
        self.assertEqual(target.read_text(), 'never overwrite')

    def test_atomic_write_failure_preserves_old_receipt_and_removes_temporary(self):
        monitor.check_latest(self.root)
        before = self.receipt.read_bytes()
        with patch.object(monitor.json, 'dump', side_effect=OSError('synthetic failure')):
            with self.assertRaises(OSError):
                monitor.check_latest(self.root)
        self.assertEqual(self.receipt.read_bytes(), before)
        self.assertEqual(list(self.root.glob('.upload-recovery-*')), [])

    def test_reader_never_runs_extraction_and_checker_waits_for_backup_lock(self):
        import fcntl
        import time
        monitor.check_latest(self.root)
        with patch.object(monitor, 'verify_archive', side_effect=AssertionError('reader must not extract')):
            self.assertEqual(monitor.public_status(self.root)['state'], 'verified')
        self.receipt.unlink()
        with (self.root / '.backup.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            process = subprocess.Popen([sys.executable, str(pathlib.Path(monitor.__file__)),
                                        '--root', str(self.root)], stdout=subprocess.PIPE,
                                       stderr=subprocess.PIPE, text=True)
            try:
                time.sleep(.15)
                self.assertIsNone(process.poll())
                self.assertFalse(self.receipt.exists())
            finally:
                fcntl.flock(lock, fcntl.LOCK_UN)
                try:
                    stdout, stderr = process.communicate(timeout=10)
                finally:
                    if process.poll() is None:
                        process.kill()
                        process.wait()
        self.assertEqual(process.returncode, 0, stderr)
        self.assertEqual(json.loads(stdout)['state'], 'verified')

    def test_checker_cli_is_fixed_and_nonzero_on_failure(self):
        command = [sys.executable, str(pathlib.Path(monitor.__file__)), '--root', str(self.root)]
        result = subprocess.run(command, capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout)['state'], 'verified')
        self.archive.write_bytes(b'not a tar')
        result = subprocess.run(command, capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, '')
        self.assertEqual(result.stderr, 'Latest offline upload check failed; live files were not replaced.\n')
        self.assertEqual(monitor.public_status(self.root)['state'], 'failed')

    def test_production_backup_cli_runs_the_gate_and_fails_without_live_replacement(self):
        # The real CLI gets a synthetic ring, never its default private config.
        config = self.root / 'synthetic.env'
        config.write_text('EMDASH_ENCRYPTION_KEY=emdash_enc_v1_' + 'A' * 43 + '\n')
        config.chmod(0o600)
        command = [sys.executable, str(pathlib.Path(backup.__file__)), '--root', str(self.root),
                   '--emdash-config', str(config)]
        result = subprocess.run(command, capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('offline upload check complete', result.stdout)
        self.assertEqual(monitor.public_status(self.root)['state'], 'verified')
        self.media.write_bytes(b'wrong bytes')
        original_db = (self.root / 'content.db').read_bytes()
        result = subprocess.run(command, capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, '')
        self.assertEqual(result.stderr, 'Recovery snapshot retained, but its offline upload check failed.\n')
        self.assertEqual(monitor.public_status(self.root)['state'], 'failed')
        self.assertEqual((self.root / 'content.db').read_bytes(), original_db)
        self.assertEqual(self.media.read_bytes(), b'wrong bytes')
        self.assertEqual(len(list((self.root / 'backups').glob('*.tar.gz'))), 3)


if __name__ == '__main__':
    unittest.main()
