#!/usr/bin/env python3
"""Online SQLite + uploads and narrowly scoped private Ship recovery material."""
import argparse
import contextlib
import datetime
import fcntl
import json
import pathlib
import re
import sqlite3
import stat
import tarfile
import tempfile
import time

SHIP_NAMESPACE = pathlib.Path('ship/do/backroadbum-ship-practice-v1')


def regular_file(path):
    if path.is_symlink() or path.resolve() != path.absolute() or not stat.S_ISREG(path.stat().st_mode):
        raise RuntimeError('Recovery input must be a regular file without symlinks')
    return path


def ship_inputs(root, config_path):
    directory = root / SHIP_NAMESPACE
    if not (root / 'ship').exists() and not (root / 'ship').is_symlink():
        return [], None
    if config_path is None:
        raise RuntimeError('Ship recovery requires its private configuration')
    config_path = regular_file(pathlib.Path(config_path))
    if stat.S_IMODE(config_path.stat().st_mode) != 0o600:
        raise RuntimeError('Ship recovery configuration must have mode 0600')
    raw = config_path.read_bytes()
    config = json.loads(raw)
    if (set(config) != {'schema', 'generation', 'allowedOrderId', 'sessionSecret'} or
            config['schema'] != 'backroadbum.ship-node/v1' or
            not isinstance(config['generation'], str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', config['generation']) or
            not isinstance(config['allowedOrderId'], str) or not re.fullmatch(r'[A-Za-z0-9._:-]{0,200}', config['allowedOrderId']) or
            not isinstance(config['sessionSecret'], str) or not re.fullmatch(r'[A-Za-z0-9_-]{43,128}', config['sessionSecret'])):
        raise RuntimeError('Invalid private Ship recovery configuration')
    if directory.resolve() != directory.absolute() or not directory.is_dir():
        raise RuntimeError('Expected Ship persistence directory is missing or linked')
    paths = sorted(directory.glob('*.sqlite'))
    if not any(re.fullmatch(r'[a-f0-9]{64}\.sqlite', p.name) for p in paths) or not (directory / 'metadata.sqlite').is_file():
        raise RuntimeError('Ship recovery requires object storage and namespace metadata')
    for path in paths:
        regular_file(path)
        if path.name != 'metadata.sqlite' and not re.fullmatch(r'[a-f0-9]{64}\.sqlite', path.name):
            raise RuntimeError('Unexpected Ship SQLite filename')
    return [(str(p.relative_to(root)), p) for p in paths], (raw, config)


def copy_sqlite(path, copy):
    regular_file(path)
    copy.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    copy.touch(mode=0o600)
    deadline = time.monotonic() + 20

    def progress(*_):
        if time.monotonic() > deadline:
            raise TimeoutError('SQLite recovery copy exceeded time limit')

    with contextlib.closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True, timeout=5)) as source, contextlib.closing(sqlite3.connect(copy)) as destination:
        source.backup(destination, pages=128, progress=progress)
        if destination.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('SQLite integrity check failed')


def check_ship_binding(db, config):
    binding = db.execute('SELECT binding FROM merchant_profile WHERE id=1').fetchone()
    expected = ['https://backroadbum.com', 'backroadbum', 'backroadbum-ship', config['generation'], config['allowedOrderId'], 'practice']
    if not binding or json.loads(binding[0]) != expected:
        raise RuntimeError('Ship configuration and storage binding do not match')
    # Older fixed-admission snapshots have no table; the new host migrates them once.
    if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='merchant_admission'").fetchone():
        return
    rows = db.execute('SELECT id, revision, order_id, enabled, updated_at FROM merchant_admission').fetchall()
    if len(rows) != 1:
        raise RuntimeError('Invalid Ship admission state')
    row_id, revision, order_id, enabled, updated_at = rows[0]
    if (row_id != 1 or not isinstance(revision, int) or not 0 <= revision <= 9007199254740991 or
            order_id is not None and (not isinstance(order_id, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._:-]{0,199}', order_id)) or
            enabled not in (0, 1) or enabled == 1 and order_id is None or
            (revision == 0) != (updated_at is None) or
            config['allowedOrderId'] and (order_id != config['allowedOrderId'] or enabled != 1)):
        raise RuntimeError('Invalid Ship admission state')
    if updated_at is not None:
        try:
            datetime.datetime.fromisoformat(updated_at)
        except (TypeError, ValueError):
            raise RuntimeError('Invalid Ship admission timestamp') from None
    if db.execute('SELECT COUNT(*) FROM orders WHERE order_id != ? OR ? IS NULL', (order_id, order_id)).fetchone()[0]:
        raise RuntimeError('Ship admission does not match its orders')


def snapshot(root=pathlib.Path('/var/lib/backroadbum'), ship_config=None):
    root = pathlib.Path(root).absolute()
    backups = root / 'backups'
    backups.mkdir(mode=0o700, exist_ok=True)
    backups.chmod(0o700)
    # Serialize timer/manual/deploy runs. Only complete archives replace old recovery points.
    with (root / '.backup.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
        with tempfile.TemporaryDirectory(dir=root) as temp:
            temp = pathlib.Path(temp)
            sources = [('content.db', root / 'content.db')]
            payment_db = root / 'payments/attempts.db'
            if payment_db.exists():
                sources.append(('payments/attempts.db', payment_db))
            ship_sources, private = ship_inputs(root, ship_config)
            sources.extend(ship_sources)
            for name, path in sources:
                copy_sqlite(path, temp / name)
                if private and name.startswith(str(SHIP_NAMESPACE)) and path.name != 'metadata.sqlite':
                    with contextlib.closing(sqlite3.connect(temp / name)) as db:
                        check_ship_binding(db, private[1])
            # Refuse a mixed generation or a changing namespace rather than claim a coherent copy.
            after_sources, after_private = ship_inputs(root, ship_config)
            if ship_sources != after_sources or private != after_private:
                raise RuntimeError('Ship recovery inputs changed during snapshot')
            if private:
                secret = temp / 'recovery/ship.json'
                secret.parent.mkdir(mode=0o700)
                secret.touch(mode=0o600)
                secret.write_bytes(private[0])
            archive_path = temp / 'recovery.tar.gz'
            archive_path.touch(mode=0o600)
            with tarfile.open(archive_path, 'w:gz') as archive:
                for name, _ in sources:
                    archive.add(temp / name, arcname=name)
                archive.add(root / 'uploads', arcname='uploads')
                if private:
                    archive.add(temp / 'recovery/ship.json', arcname='recovery/ship.json')
            target = backups / f'{stamp}.tar.gz'
            archive_path.replace(target)
        for path in sorted(backups.glob('*.tar.gz'), key=lambda p: p.stat().st_mtime_ns, reverse=True)[3:]:
            path.unlink()
    return target


def restore_ship_copy(archive_path, destination):
    """Extract only Ship inputs into a NEW private drill directory, never live paths."""
    destination = pathlib.Path(destination).absolute()
    destination.mkdir(mode=0o700, parents=False, exist_ok=False)
    with tarfile.open(regular_file(pathlib.Path(archive_path).absolute())) as archive:
        selected = []
        for member in archive.getmembers():
            if member.name.startswith('ship/') or member.name.startswith('recovery/'):
                allowed = (member.name == 'recovery/ship.json' or
                           re.fullmatch(re.escape(str(SHIP_NAMESPACE)) + r'/(metadata|[a-f0-9]{64})\.sqlite', member.name))
                if not allowed or not member.isfile() or member.mode != 0o600:
                    raise RuntimeError('Unexpected Ship recovery archive member')
                selected.append(member)
        if len({m.name for m in selected}) != len(selected):
            raise RuntimeError('Duplicate Ship recovery archive member')
        if not any(m.name == 'recovery/ship.json' for m in selected):
            raise RuntimeError('Ship recovery configuration missing from archive')
        for member in selected:
            target = destination / member.name
            target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            with target.open('xb') as output, archive.extractfile(member) as source:
                target.chmod(0o600)
                while chunk := source.read(1024 * 1024):
                    output.write(chunk)
    sources, private = ship_inputs(destination, destination / 'recovery/ship.json')
    if not sources or not private:
        raise RuntimeError('Ship recovery storage missing from archive')
    for _, path in sources:
        with contextlib.closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)) as db:
            if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('Restored Ship SQLite integrity check failed')
            if path.name != 'metadata.sqlite':
                check_ship_binding(db, private[1])
    return len(sources)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=pathlib.Path, default=pathlib.Path('/var/lib/backroadbum'))
    parser.add_argument('--ship-config', type=pathlib.Path, default=pathlib.Path('/etc/backroadbum/ship.json'))
    args = parser.parse_args()
    snapshot(args.root, args.ship_config)
    print('Backroad Bum private recovery snapshot complete')
