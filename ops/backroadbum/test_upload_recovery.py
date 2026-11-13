"""Synthetic archive/media fixtures only; never reads production paths or credentials."""
import contextlib
import hashlib
import io
import json
import pathlib
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import backup
import verify_upload_recovery as recovery


class UploadRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        (self.root / 'uploads/nested').mkdir(parents=True)
        self.image = b'synthetic-image-bytes'
        (self.root / 'uploads/nested/image.png').write_bytes(self.image)
        (self.root / 'uploads/cache.js').write_bytes(b'synthetic cached plugin, not media proof')
        with contextlib.closing(sqlite3.connect(self.root / 'content.db')) as db:
            db.execute('CREATE TABLE media (storage_key TEXT, size INTEGER, content_hash TEXT, status TEXT)')
            db.execute('INSERT INTO media VALUES (?, ?, ?, ?)', ('nested/image.png', len(self.image),
                       'sha1:' + hashlib.sha1(self.image).hexdigest(), 'ready'))
            db.execute('INSERT INTO media VALUES (?, ?, ?, ?)', ('unfinished.png', None, None, 'processing'))
            db.commit()
        self.archive = backup.snapshot(self.root)

    def update_media(self, column, value):
        with contextlib.closing(sqlite3.connect(self.root / 'content.db')) as db:
            db.execute(f'UPDATE media SET {column}=? WHERE status=?', (value, 'ready'))
            db.commit()
        self.archive = backup.snapshot(self.root)

    def test_archive_alone_restores_nested_media_with_hashes_and_private_modes(self):
        # An unrelated archived credential is not extracted by this drill.
        path = self.root / 'with-credential.tar'
        path.touch(mode=0o600)
        with tarfile.open(self.archive) as source, tarfile.open(path, 'w') as target:
            for member in source:
                target.addfile(member, source.extractfile(member) if member.isfile() else None)
            member = tarfile.TarInfo('recovery/emdash.env'); member.mode = 0o600; member.size = 17
            target.addfile(member, io.BytesIO(b'synthetic private'))
        (self.root / 'uploads/nested/image.png').unlink()
        before = (self.root / 'content.db').read_bytes()
        restored = self.root / 'drill'
        recovery.restore_asset_copy(path, restored)
        result = recovery.inspect_asset_copy(restored)
        self.assertEqual(result['restoredUploadFiles'], 2)
        self.assertEqual(result['readyMediaVerified'], 1)
        self.assertEqual(result['readyMediaBytesVerified'], len(self.image))
        self.assertEqual(result['nonReadyMediaNotVerified'], 1)
        self.assertFalse(result['privateConfigurationExtracted'])
        self.assertEqual(result['outboundRequests'], 0)
        self.assertFalse((restored / 'recovery').exists())
        self.assertEqual((self.root / 'content.db').read_bytes(), before)
        for p in restored.rglob('*'):
            self.assertEqual(p.stat().st_mode & 0o777, 0o700 if p.is_dir() else 0o600)
        self.assertEqual(restored.stat().st_mode & 0o777, 0o700)

    def test_missing_media_refuses_success(self):
        (self.root / 'uploads/nested/image.png').unlink()
        self.archive = backup.snapshot(self.root)
        with self.assertRaises(FileNotFoundError):
            recovery.verify_archive(self.archive)

    def test_changed_same_size_bytes_refuse_success(self):
        (self.root / 'uploads/nested/image.png').write_bytes(b'x' * len(self.image))
        self.archive = backup.snapshot(self.root)
        with self.assertRaisesRegex(RuntimeError, 'hash_mismatch'):
            recovery.verify_archive(self.archive)

    def test_size_and_hash_metadata_fail_closed(self):
        for column, value, error in [('size', 0, 'size_refused'), ('size', None, 'size_refused'),
                                     ('content_hash', None, 'hash_unverifiable'),
                                     ('content_hash', 'md5:unsupported', 'hash_unverifiable')]:
            with self.subTest(value=value):
                self.update_media(column, value)
                with self.assertRaisesRegex(RuntimeError, error):
                    recovery.verify_archive(self.archive)
                self.update_media('size', len(self.image))
                self.update_media('content_hash', 'sha1:' + hashlib.sha1(self.image).hexdigest())

    def test_sha256_media_hash_supported(self):
        self.update_media('content_hash', 'sha256:' + hashlib.sha256(self.image).hexdigest())
        self.assertEqual(recovery.verify_archive(self.archive)['readyMediaVerified'], 1)

    def test_database_storage_keys_cannot_escape_uploads(self):
        for key in ['../content.db', '/etc/passwd', 'nested/../../content.db', './nested/image.png',
                    'nested//image.png', 'nested\\image.png', '.', '']:
            self.update_media('storage_key', key)
            with self.subTest(key=key), self.assertRaisesRegex(RuntimeError, 'path_refused'):
                recovery.verify_archive(self.archive)

    def malicious_archive(self, name, kind=None, duplicate=False):
        path = self.root / 'bad.tar'
        path.touch(mode=0o600)
        with tarfile.open(self.archive) as source, tarfile.open(path, 'w') as target:
            for member in source:
                target.addfile(member, source.extractfile(member) if member.isfile() else None)
            member = tarfile.TarInfo(name); member.mode = 0o600
            if kind:
                member.type = kind; member.linkname = '/etc/passwd'
            target.addfile(member)
            if duplicate:
                target.addfile(member)
        return path

    def test_unsafe_headers_duplicate_links_and_file_parents_refused_before_writes(self):
        cases = [('uploads/../../escape', None, False), ('uploads/./escape', None, False),
                 ('uploads/a\\b', None, False), ('uploads/link', tarfile.SYMTYPE, False),
                 ('uploads/link', tarfile.LNKTYPE, False), ('uploads/pipe', tarfile.FIFOTYPE, False),
                 ('uploads/duplicate', None, True), ('content.db', None, False),
                 ('uploads/cache.js/child', None, False)]
        for index, (name, kind, duplicate) in enumerate(cases):
            destination = self.root / f'drill-{index}'
            with self.subTest(name=name), self.assertRaises(RuntimeError):
                recovery.restore_asset_copy(self.malicious_archive(name, kind, duplicate), destination)
            self.assertFalse(destination.exists())
        self.assertFalse((self.root / 'escape').exists())

    def test_missing_required_members_and_database_integrity_refused(self):
        path = self.root / 'empty.tar'; path.touch(mode=0o600)
        with tarfile.open(path, 'w'):
            pass
        with self.assertRaisesRegex(RuntimeError, 'incomplete'):
            recovery.verify_archive(path)
        (self.root / 'content.db').write_bytes(b'not sqlite')
        (self.root / 'content.db').chmod(0o600)
        bad = self.root / 'corrupt.tar'; bad.touch(mode=0o600)
        with tarfile.open(bad, 'w') as target:
            target.add(self.root / 'content.db', arcname='content.db')
            target.add(self.root / 'uploads', arcname='uploads')
        with self.assertRaises(sqlite3.DatabaseError):
            recovery.verify_archive(bad)

    def test_archive_bounds_and_private_permissions_refused(self):
        for limit, value in [('MAX_MEMBERS', 1), ('MAX_FILE_BYTES', 1), ('MAX_TOTAL_BYTES', 1)]:
            with self.subTest(limit=limit), patch.object(recovery, limit, value):
                with self.assertRaisesRegex(RuntimeError, 'limit_refused'):
                    recovery.verify_archive(self.archive)
        self.archive.chmod(0o644)
        with self.assertRaisesRegex(RuntimeError, 'permissions_refused'):
            recovery.verify_archive(self.archive)

    def test_existing_destination_and_symlink_paths_refused(self):
        with self.assertRaises(FileExistsError):
            recovery.restore_asset_copy(self.archive, self.root)
        link = self.root / 'link'; link.symlink_to(self.root, target_is_directory=True)
        with self.assertRaisesRegex(RuntimeError, 'destination_refused'):
            recovery.restore_asset_copy(self.archive, link / 'new')
        archive_link = self.root / 'link.tar'; archive_link.symlink_to(self.archive)
        with self.assertRaises(RuntimeError):
            recovery.verify_archive(archive_link)
        self.assertFalse((self.root / 'new').exists())

    def test_temporary_copy_removed_on_success_and_failure(self):
        with patch.object(recovery.tempfile, 'tempdir', str(self.root)):
            recovery.verify_archive(self.archive)
            self.update_media('content_hash', None)
            with self.assertRaises(RuntimeError):
                recovery.verify_archive(self.archive)
        self.assertEqual(list(self.root.glob('brb-upload-recovery-*')), [])

    def test_cli_reports_only_aggregate_results_or_fixed_failure(self):
        command = [sys.executable, str(pathlib.Path(recovery.__file__)), str(self.archive)]
        result = subprocess.run(command, capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout)['readyMediaVerified'], 1)
        self.assertEqual(result.stderr, '')
        self.update_media('storage_key', 'private-never-print-this')
        result = subprocess.run(command[:-1] + [str(self.archive)], capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, '')
        self.assertEqual(result.stderr, 'Offline upload recovery check failed; live files were not replaced.\n')
        self.assertNotIn(str(self.root), result.stderr)


if __name__ == '__main__':
    unittest.main()
