"""Reusable recovery tests; no production files or credentials are read."""
import contextlib
import importlib.util
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
        with self.assertRaises(sqlite3.OperationalError):
            backup.snapshot(self.root)
        self.assertFalse((self.root / 'content.db').exists())
        self.assertEqual(list((self.root / 'backups').glob('*.tar.gz')), [])

    def test_failed_copy_does_not_publish_or_remove_a_good_archive(self):
        good = backup.snapshot(self.root)
        (self.root / 'payments').mkdir()
        (self.root / 'payments/attempts.db').write_text('not sqlite')
        with self.assertRaises(sqlite3.DatabaseError):
            backup.snapshot(self.root)
        self.assertEqual(list((self.root / 'backups').glob('*.tar.gz')), [good])


if __name__ == '__main__':
    unittest.main()
