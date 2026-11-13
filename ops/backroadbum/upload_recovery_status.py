#!/usr/bin/env python3
"""Check the latest local archive offline; publish only bounded aggregate status."""
import argparse
import datetime
import fcntl
import json
import os
import pathlib
import stat
import tempfile

from backup import regular_file
from verify_upload_recovery import verify_archive

SCHEMA = 'backroadbum.upload-recovery-status/v1'
RECEIPT = 'upload-recovery-check.json'
COUNTS = ('restoredUploadFiles', 'restoredUploadBytes', 'readyMediaVerified',
          'readyMediaBytesVerified', 'nonReadyMediaNotVerified')


def latest_archive(root):
    archives = list((root / 'backups').glob('*.tar.gz'))
    return max(archives, key=lambda p: (p.stat().st_mtime_ns, p.name)) if archives else None


def identity(archive):
    regular_file(archive)
    info = archive.stat()
    if stat.S_IMODE(info.st_mode) != 0o600:
        raise RuntimeError('archive_permissions_refused')
    # Private invalidation identity, not an authenticity/signature claim.
    return {'name': archive.name, 'device': info.st_dev, 'inode': info.st_ino,
            'bytes': info.st_size, 'mtimeNs': info.st_mtime_ns, 'ctimeNs': info.st_ctime_ns}


def write_receipt(root, receipt):
    target = root / RECEIPT
    if target.exists() or target.is_symlink():
        regular_file(target)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', dir=root, prefix='.upload-recovery-', delete=False) as output:
            temporary = pathlib.Path(output.name)
            os.chmod(temporary, 0o600)
            json.dump(receipt, output)
            output.flush()
            os.fsync(output.fileno())
        temporary.replace(target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def check_latest(root):
    """Serialize with the snapshot writer; never change its archives or retention."""
    root = pathlib.Path(root).absolute()
    with (root / '.backup.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        archive = latest_archive(root)
        if archive is None:
            raise RuntimeError('archive_unavailable')
        before = identity(archive)
        checked_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        receipt = {'schema': SCHEMA, 'archive': before, 'checkedAt': checked_at, 'state': 'failed'}
        try:
            result = verify_archive(archive)
            if identity(archive) != before:
                raise RuntimeError('archive_changed')
            receipt.update(state='verified', counts={key: result[key] for key in COUNTS})
        except Exception:
            # Persist the refusal, not an earlier green result or exception details.
            write_receipt(root, receipt)
            raise RuntimeError('upload_check_failed') from None
        write_receipt(root, receipt)
        status = public_status(root)
        if status['state'] != 'verified':
            raise RuntimeError('upload_receipt_unreadable')
        return status


def public_status(root):
    """Read cheap local evidence only. A different archive is NOT a passing check."""
    root = pathlib.Path(root).absolute()
    base = {'schema': SCHEMA, 'state': 'unavailable', 'checkedAt': None, 'counts': None}
    try:
        archive = latest_archive(root)
        if archive is None:
            return {**base, 'state': 'no-backup'}
        current = identity(archive)
        path = root / RECEIPT
        if not path.exists() and not path.is_symlink():
            return {**base, 'state': 'not-checked'}
        regular_file(path)
        if path.stat().st_size > 4096 or stat.S_IMODE(path.stat().st_mode) != 0o600:
            return base
        receipt = json.loads(path.read_text())
        if receipt['schema'] != SCHEMA:
            return base
        if receipt['archive'] != current:
            return {**base, 'state': 'not-checked'}
        checked_at = datetime.datetime.fromisoformat(receipt['checkedAt'])
        if checked_at.tzinfo is None or checked_at > datetime.datetime.now(datetime.timezone.utc):
            return base
        if receipt['state'] == 'failed':
            return {**base, 'state': 'failed', 'checkedAt': receipt['checkedAt']}
        counts = receipt['counts']
        if (receipt['state'] != 'verified' or set(counts) != set(COUNTS) or
                any(type(counts[key]) is not int or not 0 <= counts[key] <= 512 * 1024 * 1024 for key in COUNTS) or
                counts['readyMediaVerified'] > counts['restoredUploadFiles'] or
                counts['readyMediaBytesVerified'] > counts['restoredUploadBytes']):
            return base
        return {**base, 'state': 'verified', 'checkedAt': receipt['checkedAt'], 'counts': counts}
    except Exception:
        # No paths, hashes, storage keys, archive identity, exception text or configuration.
        return base


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=pathlib.Path, default=pathlib.Path('/var/lib/backroadbum'))
    args = parser.parse_args()
    try:
        print(json.dumps(check_latest(args.root)))
    except Exception:
        parser.exit(1, 'Latest offline upload check failed; live files were not replaced.\n')


if __name__ == '__main__':
    main()
