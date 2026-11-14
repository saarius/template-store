#!/usr/bin/env python3
"""Opt-in local runtime drill in a private systemd mount/network namespace."""
import argparse
import json
import os
import pathlib
import subprocess
import tarfile
import tempfile
import uuid

from backup import check_emdash_keys, emdash_inputs, regular_file
from verify_upload_recovery import MAX_MEMBERS, inspect_asset_copy, restore_asset_copy

ROOT = pathlib.Path('/var/lib/backroadbum')
REPO = pathlib.Path(__file__).resolve().parents[2]


def restore_runtime_copy(archive, destination):
    """Use the bounded media extractor, then add only the validated archived key ring."""
    destination = pathlib.Path(destination)
    restore_asset_copy(archive, destination)
    with tarfile.open(regular_file(pathlib.Path(archive).absolute())) as source:
        selected = []
        for index, member in enumerate(source):
            if index >= MAX_MEMBERS:
                raise RuntimeError('runtime_archive_limit_refused')
            if member.name == 'recovery/emdash.env':
                selected.append(member)
        if (len(selected) != 1 or not selected[0].isfile() or selected[0].mode != 0o600 or
                not 1 <= selected[0].size <= 4096):
            raise RuntimeError('runtime_key_refused')
        directory = destination / 'recovery'
        directory.mkdir(mode=0o700)
        target = directory / 'emdash.env'
        with target.open('xb') as output, source.extractfile(selected[0]) as data:
            target.chmod(0o600)
            output.write(data.read(4097))
        if target.stat().st_size != selected[0].size:
            raise RuntimeError('runtime_key_size_refused')
    check_emdash_keys(destination / 'content.db', emdash_inputs(target))
    return inspect_asset_copy(destination)


def unit_command(destination, release, unit, host_namespace):
    """The live data root is hidden; no host private config or external network is available."""
    return ['sudo', '-n', 'systemd-run', '--quiet', '--pipe', '--wait', '--collect',
            '--service-type=exec', f'--unit={unit}',
            '-p', 'User=agent', '-p', f'WorkingDirectory={REPO}',
            '-p', 'PrivateNetwork=yes', '-p', 'PrivateTmp=yes', '-p', 'ProtectSystem=strict',
            '-p', 'NoNewPrivileges=yes', '-p', 'ProtectHome=yes', '-p', 'UMask=0077',
            '-p', 'RuntimeMaxSec=150', '-p', 'TimeoutStopSec=10', '-p', 'KillMode=control-group',
            '-p', 'MemoryMax=850M', '-p', 'TasksMax=160',
            '-p', f'BindPaths={destination}:{ROOT}',
            '-p', f'BindReadOnlyPaths={release}:{ROOT}/restored-release',
            '-p', f'ReadWritePaths={ROOT}',
            '-p', 'InaccessiblePaths=/etc/backroadbum /etc/trialrun /var/lib/trialrun/state /var/lib/trialrun/sessions',
            '--setenv=NODE_ENV=production', '--setenv=BACKROADBUM_RESTORE_DRILL=1',
            f'--setenv=BACKROADBUM_RESTORE_HOST_NET={host_namespace}',
            '/opt/node/bin/node', str(REPO / 'ops/backroadbum/verify-runtime-recovery.mjs')]


def verify_archive(archive):
    # Host artifacts are deliberate inputs, not claimed to have come from the archive.
    release = (ROOT / 'current').resolve(strict=True)
    if release.parent != ROOT / 'releases' or not (release / 'server/entry.mjs').is_file():
        raise RuntimeError('runtime_release_refused')
    host_namespace = os.readlink('/proc/self/ns/net')
    unit = 'backroadbum-restore-' + uuid.uuid4().hex[:12]
    with tempfile.TemporaryDirectory(prefix='.brb-runtime-recovery-', dir=REPO.parent.parent) as temp:
        destination = pathlib.Path(temp) / 'restored'
        media = restore_runtime_copy(archive, destination)
        (destination / 'restored-release').mkdir(mode=0o700)
        (destination / 'node_modules').symlink_to(REPO / 'node_modules', target_is_directory=True)
        (destination / '.runtime-recovery').write_text('backroadbum.runtime-recovery/v1\n')
        try:
            result = subprocess.run(unit_command(destination, release, unit, host_namespace),
                                    capture_output=True, text=True, timeout=180)
            if result.returncode != 0:
                raise RuntimeError('runtime_drill_refused')
            report = json.loads(result.stdout)
            if (report.get('schema') != 'backroadbum.runtime-recovery-check/v1' or
                    report.get('outboundNetwork') != 'isolated' or report.get('businessRowsUnchanged') is not True):
                raise RuntimeError('runtime_report_refused')
            report['readyMediaVerified'] = media['readyMediaVerified']
            report['restoredUploadFiles'] = media['restoredUploadFiles']
            return report
        finally:
            # Also runs on timeout/interruption, before deleting the mounted private copy.
            subprocess.run(['sudo', '-n', 'systemctl', 'stop', unit], capture_output=True, timeout=20)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--archive', type=pathlib.Path)
    args = parser.parse_args()
    os.umask(0o077)
    if not args.check:
        print('No action. --check --archive PRIVATE_ARCHIVE boots a disposable restored copy with external networking blocked. No live files replaced or commerce actions replayed.')
    elif not args.archive:
        parser.exit(1, 'An explicit private archive is required.\n')
    else:
        try:
            print(json.dumps(verify_archive(args.archive)))
        except (Exception, KeyboardInterrupt):
            # Never relay runtime logs, keys, rows, archive paths or subprocess exceptions.
            parser.exit(1, 'Isolated runtime recovery check failed; live files were not replaced.\n')
