"""Reusable recovery tests; no production files or credentials are read."""
import contextlib
import importlib.util
import io
import json
import os
import pathlib
import sqlite3
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('backroadbum_backup', pathlib.Path(__file__).with_name('backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        (self.root / 'uploads').mkdir()
        (self.root / 'uploads/art.svg').write_text('<svg/>')
        with contextlib.closing(sqlite3.connect(self.root / 'content.db')) as db:
            db.execute('CREATE TABLE content (title TEXT)')
            db.execute("INSERT INTO content VALUES ('Field note')")
            db.commit()

    def test_includes_consistent_payment_wal_and_content_without_secrets(self):
        (self.root / 'payments').mkdir()
        db = sqlite3.connect(self.root / 'payments/attempts.db')
        self.addCleanup(db.close)
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('CREATE TABLE attempts (id TEXT)')
        db.execute("INSERT INTO attempts VALUES ('commerce-attempt')")
        db.commit()
        (self.root / 'secret.env').write_text('never include me')
        path = backup.snapshot(self.root)
        self.assertEqual(os.stat(path).st_mode & 0o777, 0o600)
        with tarfile.open(path) as archive:
            self.assertEqual(set(archive.getnames()), {'content.db', 'payments/attempts.db', 'uploads', 'uploads/art.svg'})
            extracted = self.root / 'restored'
            archive.extractall(extracted, filter='data')
        with contextlib.closing(sqlite3.connect(extracted / 'payments/attempts.db')) as restored:
            self.assertEqual(restored.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
            self.assertEqual(restored.execute('SELECT id FROM attempts').fetchone()[0], 'commerce-attempt')
        with contextlib.closing(sqlite3.connect(extracted / 'content.db')) as restored:
            self.assertEqual(restored.execute('SELECT title FROM content').fetchone()[0], 'Field note')

    def test_unconnected_payments_is_optional(self):
        with tarfile.open(backup.snapshot(self.root)) as archive:
            self.assertNotIn('payments/attempts.db', archive.getnames())

    def test_retains_only_three_snapshots(self):
        paths = [backup.snapshot(self.root) for _ in range(5)]
        self.assertEqual(set((self.root / 'backups').glob('*.tar.gz')), set(paths[-3:]))

    def test_missing_content_never_creates_an_empty_database(self):
        (self.root / 'content.db').unlink()
        with self.assertRaises(FileNotFoundError):
            backup.snapshot(self.root)
        self.assertFalse((self.root / 'content.db').exists())
        self.assertEqual(list((self.root / 'backups').glob('*.tar.gz')), [])

    def ship_fixture(self):
        directory = self.root / backup.SHIP_NAMESPACE
        directory.mkdir(parents=True)
        self.config = {'schema': 'backroadbum.ship-node/v1', 'generation': 'fixture-generation',
                       'allowedOrderId': '', 'sessionSecret': 'fixture-not-a-deployed-secret-'.ljust(48, 'x')}
        self.config_path = self.root / 'private-ship.json'
        self.config_path.touch(mode=0o600)
        self.config_path.write_text(json.dumps(self.config))
        with contextlib.closing(sqlite3.connect(directory / 'metadata.sqlite')) as db:
            db.execute('CREATE TABLE metadata (value TEXT)')
            db.execute("INSERT INTO metadata VALUES ('namespace fixture')")
            db.commit()
        self.object_path = directory / ('a' * 64 + '.sqlite')
        db = sqlite3.connect(self.object_path)
        self.addCleanup(db.close)
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('CREATE TABLE merchant_profile (id INTEGER PRIMARY KEY, binding TEXT)')
        binding = ['https://backroadbum.com', 'backroadbum', 'backroadbum-ship', self.config['generation'], '', 'practice']
        db.execute('INSERT INTO merchant_profile VALUES (1, ?)', (json.dumps(binding),))
        db.execute('CREATE TABLE labels (id TEXT)')
        db.execute("INSERT INTO labels VALUES ('synthetic-practice-label')")
        db.commit()
        return directory

    def test_ship_wal_metadata_and_exact_private_configuration_restore(self):
        directory = self.ship_fixture()
        (self.root / 'ship/cache').mkdir()
        (self.root / 'ship/cache/never-copy').write_text('cache is disposable')
        (directory / 'unrelated.key').write_text('not a recovery input')
        path = backup.snapshot(self.root, self.config_path)
        extracted = self.root / 'restored'
        with tarfile.open(path) as archive:
            names = archive.getnames()
            self.assertIn(str(backup.SHIP_NAMESPACE / 'metadata.sqlite'), names)
            self.assertIn('recovery/ship.json', names)
            self.assertFalse(any(n.endswith(('-wal', '-shm', '.key')) or 'cache' in n for n in names))
            self.assertEqual(archive.getmember('recovery/ship.json').mode, 0o600)
        self.assertEqual(backup.restore_ship_copy(path, extracted), 2)
        self.assertEqual((extracted / 'recovery/ship.json').read_bytes(), self.config_path.read_bytes())
        with contextlib.closing(sqlite3.connect(extracted / self.object_path.relative_to(self.root))) as db:
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
            self.assertEqual(db.execute('SELECT id FROM labels').fetchone()[0], 'synthetic-practice-label')

    def test_ship_missing_config_wrong_mode_or_binding_keeps_last_good_archive(self):
        self.ship_fixture()
        good = backup.snapshot(self.root, self.config_path)
        for config in [None, self.root / 'missing.json']:
            with self.assertRaises((RuntimeError, FileNotFoundError)):
                backup.snapshot(self.root, config)
        self.config_path.chmod(0o640)
        with self.assertRaises(RuntimeError):
            backup.snapshot(self.root, self.config_path)
        self.config_path.chmod(0o600)
        self.config['generation'] = 'wrong-generation'
        self.config_path.write_text(json.dumps(self.config))
        with self.assertRaisesRegex(RuntimeError, 'binding'):
            backup.snapshot(self.root, self.config_path)
        self.assertEqual(list((self.root / 'backups').glob('*.tar.gz')), [good])

    def test_ship_corrupt_database_or_symlink_refuses_publication(self):
        directory = self.ship_fixture()
        extra = directory / ('b' * 64 + '.sqlite')
        extra.symlink_to(self.object_path)
        with self.assertRaises(RuntimeError):
            backup.snapshot(self.root, self.config_path)
        extra.unlink()
        extra.write_text('not sqlite')
        with self.assertRaises(sqlite3.DatabaseError):
            backup.snapshot(self.root, self.config_path)
        self.assertEqual(list((self.root / 'backups').glob('*.tar.gz')), [])

    def test_ship_missing_metadata_refuses_incomplete_snapshot(self):
        directory = self.ship_fixture()
        (directory / 'metadata.sqlite').unlink()
        with self.assertRaises(RuntimeError):
            backup.snapshot(self.root, self.config_path)
        self.assertEqual(list((self.root / 'backups').glob('*.tar.gz')), [])

    def test_restore_refuses_existing_destination_and_unsafe_members(self):
        self.ship_fixture()
        path = backup.snapshot(self.root, self.config_path)
        with self.assertRaises(FileExistsError):
            backup.restore_ship_copy(path, self.root)
        for name in ['ship/../../escape', 'recovery/other.key', str(backup.SHIP_NAMESPACE / 'metadata.sqlite')]:
            bad = self.root / 'bad.tar.gz'
            with tarfile.open(bad, 'w:gz') as archive:
                member = tarfile.TarInfo(name)
                member.mode = 0o600
                member.type = tarfile.SYMTYPE
                member.linkname = '/etc/passwd'
                archive.addfile(member)
            with tempfile.TemporaryDirectory(dir=self.root) as parent:
                with self.assertRaises(RuntimeError):
                    backup.restore_ship_copy(bad, pathlib.Path(parent) / 'drill')
        self.assertFalse((self.root / 'escape').exists())

    def test_restore_refuses_configuration_without_storage(self):
        self.ship_fixture()
        bad = self.root / 'config-only.tar.gz'
        with tarfile.open(bad, 'w:gz') as archive:
            archive.add(self.config_path, arcname='recovery/ship.json')
        with self.assertRaisesRegex(RuntimeError, 'storage missing'):
            backup.restore_ship_copy(bad, self.root / 'drill')

    def test_restore_refuses_duplicate_configuration(self):
        bad = self.root / 'duplicate.tar.gz'
        with tarfile.open(bad, 'w:gz') as archive:
            for _ in range(2):
                member = tarfile.TarInfo('recovery/ship.json')
                member.mode = 0o600
                member.size = 2
                archive.addfile(member, io.BytesIO(b'{}'))
        with self.assertRaisesRegex(RuntimeError, 'Duplicate'):
            backup.restore_ship_copy(bad, self.root / 'drill')

    def test_failed_copy_does_not_publish_or_remove_a_good_archive(self):
        good = backup.snapshot(self.root)
        (self.root / 'payments').mkdir()
        (self.root / 'payments/attempts.db').write_text('not sqlite')
        with self.assertRaises(sqlite3.DatabaseError):
            backup.snapshot(self.root)
        self.assertEqual(list((self.root / 'backups').glob('*.tar.gz')), [good])


if __name__ == '__main__':
    unittest.main()
