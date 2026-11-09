#!/usr/bin/env python3
"""Consistent SQLite + upload snapshot; never include dependencies or secrets."""
import datetime, pathlib, sqlite3, tarfile, tempfile
root = pathlib.Path('/var/lib/backroadbum')
backups = root/'backups'; backups.mkdir(mode=0o700,exist_ok=True)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
with tempfile.TemporaryDirectory(dir=root) as temp:
    copy = pathlib.Path(temp)/'content.db'
    with sqlite3.connect(root/'content.db') as source, sqlite3.connect(copy) as destination:
        source.backup(destination)
        if destination.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('SQLite integrity check failed')
    target = backups/f'{stamp}.tar.gz'
    target.touch(mode=0o600)
    with tarfile.open(target, 'w:gz') as archive:
        archive.add(copy,arcname='content.db')
        archive.add(root/'uploads',arcname='uploads')
for p in sorted(backups.glob('*.tar.gz'),reverse=True)[3:]: p.unlink()
print('Backroad Bum SQLite and upload backup complete')
