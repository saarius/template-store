#!/usr/bin/env python3
"""Private, consistent SQLite copies + uploads; exclude dependencies and secrets."""
import contextlib
import datetime
import fcntl
import pathlib
import sqlite3
import tarfile
import tempfile


def snapshot(root=pathlib.Path('/var/lib/backroadbum')):
    root = pathlib.Path(root)
    backups = root / 'backups'
    backups.mkdir(mode=0o700, exist_ok=True)
    # Serialize the timer and manual/deploy backups. Publish only complete archives.
    with (root / '.backup.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
        with tempfile.TemporaryDirectory(dir=root) as temp:
            temp = pathlib.Path(temp)
            sources = [('content.db', root / 'content.db')]
            payment_db = root / 'payments/attempts.db'
            if payment_db.exists():
                sources.append(('payments/attempts.db', payment_db))
            for name, path in sources:
                copy = temp / name
                copy.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                copy.touch(mode=0o600)
                with contextlib.closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as source, contextlib.closing(sqlite3.connect(copy)) as destination:
                    source.backup(destination)
                    if destination.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                        raise RuntimeError('SQLite integrity check failed')
            archive_path = temp / 'recovery.tar.gz'
            archive_path.touch(mode=0o600)
            with tarfile.open(archive_path, 'w:gz') as archive:
                for name, _ in sources:
                    archive.add(temp / name, arcname=name)
                archive.add(root / 'uploads', arcname='uploads')
            target = backups / f'{stamp}.tar.gz'
            archive_path.replace(target)
        for path in sorted(backups.glob('*.tar.gz'), key=lambda p: p.stat().st_mtime_ns, reverse=True)[3:]:
            path.unlink()
    return target


if __name__ == '__main__':
    snapshot()
    print('Backroad Bum SQLite and upload backup complete')
