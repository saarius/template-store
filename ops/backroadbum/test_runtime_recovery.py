"""Synthetic recovery archives and unit configuration only; no live secrets or systemd starts."""
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
import verify_runtime_recovery as recovery


class RuntimeRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        (self.root / 'uploads').mkdir()
        self.image = b'synthetic local media'
        (self.root / 'uploads/image.png').write_bytes(self.image)
        with contextlib.closing(sqlite3.connect(self.root / 'content.db')) as db:
            db.execute('CREATE TABLE media (storage_key TEXT, size INTEGER, content_hash TEXT, status TEXT)')
            db.execute('INSERT INTO media VALUES (?,?,?,?)', ('image.png', len(self.image),
                       'sha256:' + hashlib.sha256(self.image).hexdigest(), 'ready'))
            db.commit()
        self.key = self.root / 'key.env'
        self.key.touch(mode=0o600)
        self.key.write_text('EMDASH_ENCRYPTION_KEY=emdash_enc_v1_' + 'A' * 43 + '\n')
        self.archive = backup.snapshot(self.root, emdash_config=self.key)

    def rewrite_key(self, content=b'', kind=tarfile.REGTYPE, duplicate=False, include=True, mode=0o600):
        path = self.root / 'changed.tar'; path.touch(mode=0o600)
        with tarfile.open(self.archive) as source, tarfile.open(path, 'w') as target:
            for member in source:
                if member.name == 'recovery/emdash.env':
                    continue
                target.addfile(member, source.extractfile(member) if member.isfile() else None)
            if include:
                member = tarfile.TarInfo('recovery/emdash.env')
                member.type = kind; member.mode = mode; member.linkname = '/etc/passwd'
                member.size = len(content) if kind == tarfile.REGTYPE else 0
                target.addfile(member, io.BytesIO(content) if kind == tarfile.REGTYPE else None)
                if duplicate:
                    target.addfile(member, io.BytesIO(content) if kind == tarfile.REGTYPE else None)
        return path

    def test_only_archived_content_uploads_and_validated_key_restored_privately(self):
        before = (self.root / 'content.db').read_bytes()
        destination = self.root / 'restored'
        result = recovery.restore_runtime_copy(self.archive, destination)
        self.assertEqual(result['readyMediaVerified'], 1)
        self.assertEqual((destination / 'recovery/emdash.env').read_bytes(), self.key.read_bytes())
        self.assertEqual((destination / 'uploads/image.png').read_bytes(), self.image)
        self.assertFalse((destination / 'recovery/ship.json').exists())
        self.assertEqual((self.root / 'content.db').read_bytes(), before)
        for path in [destination, *destination.rglob('*')]:
            self.assertEqual(path.stat().st_mode & 0o777, 0o700 if path.is_dir() else 0o600)

    def test_missing_duplicate_link_large_or_public_key_refused(self):
        cases = [{'include': False}, {'content': self.key.read_bytes(), 'duplicate': True},
                 {'kind': tarfile.SYMTYPE}, {'kind': tarfile.LNKTYPE}, {'kind': tarfile.FIFOTYPE},
                 {'content': b'x' * 4097}, {'content': self.key.read_bytes(), 'mode': 0o644}]
        for index, case in enumerate(cases):
            with self.subTest(case=case), self.assertRaises(RuntimeError):
                recovery.restore_runtime_copy(self.rewrite_key(**case), self.root / f'bad-{index}')

    def test_unexpected_env_assignments_and_noncanonical_keys_refused(self):
        for index, content in enumerate([b'OTHER_PRIVATE_KEY=synthetic\n',
                                          self.key.read_bytes() + b'OTHER_PRIVATE_KEY=synthetic\n',
                                          b'EMDASH_ENCRYPTION_KEY=bad\n']):
            with self.subTest(index=index), self.assertRaises(RuntimeError):
                recovery.restore_runtime_copy(self.rewrite_key(content=content), self.root / f'env-{index}')

    def test_key_must_cover_archived_encrypted_setting(self):
        with contextlib.closing(sqlite3.connect(self.root / 'content.db')) as db:
            db.execute('CREATE TABLE options (name TEXT, value TEXT)')
            db.execute('INSERT INTO options VALUES (?,?)', ('plugin:synthetic:settings:key',
                       json.dumps({'$emdash': 'plugin-setting', 'kid': 'missing'})))
            db.commit()
        # Create fixture without asking the backup writer to certify this deliberately invalid ring.
        path = self.root / 'uncovered.tar'; path.touch(mode=0o600)
        with tarfile.open(self.archive) as source, tarfile.open(path, 'w') as target:
            for member in source:
                if member.name != 'content.db':
                    target.addfile(member, source.extractfile(member) if member.isfile() else None)
            (self.root / 'content.db').chmod(0o600)
            target.add(self.root / 'content.db', arcname='content.db')
        with self.assertRaisesRegex(RuntimeError, 'matching encryption key'):
            recovery.restore_runtime_copy(path, self.root / 'uncovered')

    def test_unit_hides_live_data_secrets_and_network_with_bounded_children(self):
        command = recovery.unit_command(pathlib.Path('/synthetic/copy'), pathlib.Path('/synthetic/release'),
                                        'synthetic-unit', 'net:[123]')
        self.assertIn('PrivateNetwork=yes', command)
        self.assertIn('PrivateTmp=yes', command)
        self.assertIn('ProtectSystem=strict', command)
        self.assertIn('BindPaths=/synthetic/copy:/var/lib/backroadbum', command)
        self.assertIn('BindReadOnlyPaths=/synthetic/release:/var/lib/backroadbum/restored-release', command)
        self.assertIn('RuntimeMaxSec=150', command)
        self.assertIn('KillMode=control-group', command)
        self.assertIn('User=agent', command)
        self.assertTrue(any('InaccessiblePaths=/etc/backroadbum' in arg for arg in command))
        self.assertFalse(any('EnvironmentFile' in arg for arg in command))
        self.assertFalse(any('ENCRYPTION_KEY=' in arg for arg in command))

    def test_pinned_drill_mounts_compiled_files_without_using_live_links(self):
        command = recovery.unit_command(pathlib.Path('/synthetic/copy'), pathlib.Path('/synthetic/release'),
                                        'synthetic-unit', 'net:[123]', pinned_launcher=True)
        self.assertIn('--setenv=BACKROADBUM_RESTORE_PINNED_LAUNCHER=1', command)
        self.assertIn('BindReadOnlyPaths=/synthetic/release/server:/var/lib/backroadbum/restored-release/server '
                      '/synthetic/release/client:/var/lib/backroadbum/restored-release/client', command)
        self.assertIn('PrivateNetwork=yes', command)

    def create_release(self, name):
        release = self.root / 'releases' / name
        (release / 'server').mkdir(parents=True)
        (release / 'server/entry.mjs').write_text('// synthetic code, never executed')
        return release

    def test_retained_release_rejects_path_aliases_and_linked_entries(self):
        release = self.create_release('20261123T103500Z')
        (self.root / 'current').symlink_to(release, target_is_directory=True)
        (release.parent / '20261123T100000Z').symlink_to(release, target_is_directory=True)
        linked = self.create_release('20261123T101500Z')
        (linked / 'server/entry.mjs').unlink()
        (linked / 'server/entry.mjs').symlink_to(release / 'server/entry.mjs')
        with patch.object(recovery, 'ROOT', self.root):
            self.assertEqual(recovery.retained_release(), release)
            for invalid in ('', str(release), '../' + release.name, '20261123T100000Z',
                            '20261123T101500Z', '20261123T101000Z'):
                with self.subTest(invalid=invalid), self.assertRaises((RuntimeError, FileNotFoundError)):
                    recovery.retained_release(invalid)

    def test_dependency_selection_refuses_aliases_missing_or_outside_trees(self):
        repo = self.root / 'workspace/repos/template-store'
        primary = repo / 'node_modules'
        alternate = self.root / 'workspace/candidate/node_modules'
        outside = self.root / 'outside/node_modules'
        alias = self.root / 'workspace/alias/node_modules'
        for path in (primary, alternate, outside, alias.parent):
            path.mkdir(parents=True)
        alias.symlink_to(alternate, target_is_directory=True)
        with patch.object(recovery, 'REPO', repo):
            self.assertEqual(recovery.dependency_tree(), primary)
            self.assertEqual(recovery.dependency_tree(alternate), alternate)
            missing = self.root / 'workspace/missing/node_modules'
            for invalid in (outside, alias, missing, alternate.parent, primary.parent / '../../candidate/node_modules'):
                with self.subTest(invalid=invalid), self.assertRaises((RuntimeError, FileNotFoundError)):
                    recovery.dependency_tree(invalid)

    def test_parent_stops_unit_and_removes_private_copy_on_success_failure_and_timeout(self):
        current = self.create_release('20261123T103500Z')
        release = self.create_release('20261123T100000Z')
        (self.root / 'current').symlink_to(current, target_is_directory=True)
        repo = self.root / 'workspace/repos/template-store'
        (repo / 'node_modules').mkdir(parents=True)
        alternate = self.root / 'workspace/candidate/node_modules'
        alternate.mkdir(parents=True)
        report = {'schema': 'backroadbum.runtime-recovery-check/v1', 'outboundNetwork': 'isolated',
                  'businessRowsUnchanged': True, 'businessCollectionsSha256': 'a' * 64,
                  'dependencyResolutionGuard': True, 'workerdFromDependencyTree': True}
        success = subprocess.CompletedProcess([], 0, json.dumps(report), '')
        missing_digest = subprocess.CompletedProcess([], 0, json.dumps({**report, 'businessCollectionsSha256': ''}), '')
        missing_worker = subprocess.CompletedProcess([], 0, json.dumps({**report, 'workerdFromDependencyTree': False}), '')
        failure = subprocess.CompletedProcess([], 1, 'private-never-relay', 'private-never-relay')
        timeout = subprocess.TimeoutExpired('synthetic', 1, output='private-never-relay')
        for outcome in [success, missing_digest, missing_worker, failure, timeout]:
            with self.subTest(outcome=type(outcome).__name__), patch.object(recovery, 'ROOT', self.root), \
                    patch.object(recovery, 'REPO', repo), patch.object(recovery.subprocess, 'run') as run:
                def fixture_run(command, **_kwargs):
                    mounted = next((item for item in command if item.startswith('BindPaths=')), None)
                    if mounted:
                        source = pathlib.Path(mounted.removeprefix('BindPaths=').split(':', 1)[0])
                        self.assertEqual((source / 'node_modules').resolve(),
                                         alternate if outcome is success else repo / 'node_modules')
                        if isinstance(outcome, Exception):
                            raise outcome
                        return outcome
                    return subprocess.CompletedProcess([], 0, '', '')
                run.side_effect = fixture_run
                if outcome is success:
                    result = recovery.verify_archive(self.archive, release.name, alternate)
                    self.assertEqual(result['readyMediaVerified'], 1)
                    self.assertEqual(result['retainedRelease'], release.name)
                    self.assertEqual(result['dependencySelection'], 'explicit')
                    self.assertIn(f'BindReadOnlyPaths={release}:{self.root}/restored-release',
                                  run.call_args_list[0].args[0])
                    self.assertEqual((self.root / 'current').resolve(), current)
                else:
                    with self.assertRaises(Exception):
                        recovery.verify_archive(self.archive)
                self.assertEqual(run.call_count, 2)
                self.assertEqual(run.call_args_list[-1].args[0][:4], ['sudo', '-n', 'systemctl', 'stop'])
                self.assertEqual(list((self.root / 'workspace').glob('.brb-runtime-recovery-*')), [])

    def test_cli_no_action_and_missing_input_are_safe(self):
        command = [sys.executable, str(pathlib.Path(recovery.__file__))]
        result = subprocess.run(command, capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0)
        self.assertTrue(result.stdout.startswith('No action.'))
        result = subprocess.run(command + ['--check'], capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, '')
        self.assertEqual(result.stderr, 'An explicit private archive is required.\n')


if __name__ == '__main__':
    unittest.main()
