#!/usr/bin/env python3
"""Offline local-media recovery drill; no server, network, or live-file replacement."""
import argparse
import contextlib
import hashlib
import hmac
import json
import pathlib
import re
import sqlite3
import stat
import tarfile
import tempfile

from backup import regular_file

# Bound a malformed archive on this small host. Increase deliberately if the store grows.
MAX_MEMBERS = 10000
MAX_FILE_BYTES = 128 * 1024 * 1024
MAX_TOTAL_BYTES = 512 * 1024 * 1024


def safe_relative(value):
    if not isinstance(value, str) or not value or '\\' in value:
        raise RuntimeError('asset_path_refused')
    path = pathlib.PurePosixPath(value)
    if not path.parts or path.is_absolute() or '..' in path.parts or str(path) != value:
        raise RuntimeError('asset_path_refused')
    return path


def restore_asset_copy(archive_path, destination):
    """Extract content.db and uploads only, into a NEW private directory.

    Never extract the archived encryption ring or retired transport credentials.
    Ignore unrelated members; validate every scoped header before writing any file.
    """
    source = regular_file(pathlib.Path(archive_path).absolute())
    if stat.S_IMODE(source.stat().st_mode) != 0o600:
        raise RuntimeError('asset_archive_permissions_refused')
    destination = pathlib.Path(destination).absolute()
    if destination.resolve() != destination:
        raise RuntimeError('asset_destination_refused')
    with tarfile.open(source) as archive:
        selected, total = {}, 0
        for index, member in enumerate(archive):
            if index >= MAX_MEMBERS:
                raise RuntimeError('asset_archive_limit_refused')
            if member.name != 'content.db' and member.name != 'uploads' and not member.name.startswith('uploads/'):
                continue
            safe_relative(member.name)
            if member.name in selected or not (member.isfile() or member.isdir()):
                raise RuntimeError('asset_member_refused')
            if member.name == 'content.db' and (not member.isfile() or member.mode != 0o600):
                raise RuntimeError('asset_database_refused')
            if member.name == 'uploads' and not member.isdir():
                raise RuntimeError('asset_root_refused')
            if member.size < 0 or member.size > MAX_FILE_BYTES or member.isdir() and member.size != 0:
                raise RuntimeError('asset_archive_limit_refused')
            total += member.size
            if total > MAX_TOTAL_BYTES:
                raise RuntimeError('asset_archive_limit_refused')
            selected[member.name] = member
        if not {'content.db', 'uploads'} <= selected.keys():
            raise RuntimeError('asset_archive_incomplete')
        for name in selected:
            for parent in pathlib.PurePosixPath(name).parents:
                if str(parent) in selected and not selected[str(parent)].isdir():
                    raise RuntimeError('asset_parent_refused')
        destination.mkdir(mode=0o700, parents=False, exist_ok=False)
        for name, member in selected.items():
            target = destination / name
            target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            if member.isdir():
                target.mkdir(mode=0o700, exist_ok=True)
                continue
            with target.open('xb') as output, archive.extractfile(member) as data:
                target.chmod(0o600)
                while chunk := data.read(1024 * 1024):
                    output.write(chunk)
            if target.stat().st_size != member.size:
                raise RuntimeError('asset_extraction_size_refused')


def inspect_asset_copy(root):
    root = pathlib.Path(root).absolute()
    database = regular_file(root / 'content.db')
    with contextlib.closing(sqlite3.connect(database.as_uri() + '?mode=ro', uri=True)) as db:
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('asset_integrity_refused')
        rows = db.execute('SELECT storage_key, size, content_hash FROM media WHERE status = ?', ('ready',)).fetchall()
        other = db.execute('SELECT COUNT(*) FROM media WHERE status != ? OR status IS NULL', ('ready',)).fetchone()[0]
    verified_bytes = 0
    for key, size, expected in rows:
        relative = safe_relative(key)
        path = regular_file(root / 'uploads' / str(relative))
        if not isinstance(size, int) or size < 0 or path.stat().st_size != size:
            raise RuntimeError('asset_media_size_refused')
        match = re.fullmatch(r'(sha1:[a-f0-9]{40}|sha256:[a-f0-9]{64})', expected or '')
        if not match:
            raise RuntimeError('asset_media_hash_unverifiable')
        algorithm, digest = expected.split(':', 1)
        with path.open('rb') as data:
            actual = hashlib.file_digest(data, algorithm).hexdigest()
        if not hmac.compare_digest(actual, digest):
            raise RuntimeError('asset_media_hash_mismatch')
        verified_bytes += size
    files = [p for p in (root / 'uploads').rglob('*') if p.is_file()]
    return {'schema': 'backroadbum.upload-recovery-check/v1', 'integrity': 'ok',
            'restoredUploadFiles': len(files), 'restoredUploadBytes': sum(p.stat().st_size for p in files),
            'readyMediaVerified': len(rows), 'readyMediaBytesVerified': verified_bytes,
            'nonReadyMediaNotVerified': other, 'mediaSizeAndHash': 'ok',
            'privateConfigurationExtracted': False, 'liveFilesReplaced': False,
            'runtimeRestartTested': False, 'outboundRequests': 0}


def verify_archive(archive):
    with tempfile.TemporaryDirectory(prefix='brb-upload-recovery-') as temp:
        root = pathlib.Path(temp) / 'restored'
        restore_asset_copy(archive, root)
        return inspect_asset_copy(root)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=pathlib.Path)
    args = parser.parse_args()
    try:
        print(json.dumps(verify_archive(args.archive)))
    except Exception:
        # Never relay archive paths, storage keys, SQLite rows, or exception details.
        parser.exit(1, 'Offline upload recovery check failed; live files were not replaced.\n')
