// Synthetic CLI entrypoints only: no live archive, provider or host is opened.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

for (const [tool, failure] of [
  ['emdash', 'Offline EmDash credential recovery check failed; live files were not replaced.'],
  ['ship', 'Isolated Ship recovery check failed; live files were not replaced.'],
]) {
  test(`${tool} CLI refuses missing arguments/archives through real, file-linked and directory-linked paths`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'brb-recovery-cli-'));
    try {
      const source = fileURLToPath(new URL(`./verify-${tool}-recovery.mjs`, import.meta.url));
      const fileLink = join(root, 'linked-command.mjs');
      const directoryLink = join(root, 'linked-directory');
      await symlink(source, fileLink);
      await symlink(fileURLToPath(new URL('.', import.meta.url)), directoryLink, 'dir');
      for (const entry of [source, fileLink, join(directoryLink, `verify-${tool}-recovery.mjs`)]) {
        for (const args of [[], [join(root, 'private-name-must-not-be-printed.tar.gz')]]) {
          const result = spawnSync(process.execPath, [entry, ...args], {
            cwd: root, encoding: 'utf8', timeout: 20000, env: { ...process.env, NODE_NO_WARNINGS: '1' },
          });
          assert.equal(result.error, undefined, 'CLI must finish without a spawn/timeout error');
          assert.equal(result.status, 1, 'Invalid CLI input must fail, never silently exit successfully');
          assert.equal(result.stdout, '', 'Refusal must not print recovery success or private data');
          assert.equal(result.stderr.trim(), args.length ? failure : `Usage: node ops/backroadbum/verify-${tool}-recovery.mjs PRIVATE_ARCHIVE`);
          assert.ok(!result.stderr.includes(root), 'Private input paths must not be relayed');
        }
      }
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  test(`${tool} module imports through a symlink without running its CLI`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'brb-recovery-import-'));
    try {
      const link = join(root, 'imported-tool.mjs');
      await symlink(fileURLToPath(new URL(`./verify-${tool}-recovery.mjs`, import.meta.url)), link);
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', 'await import(process.argv[1])', link], {
        cwd: root, encoding: 'utf8', timeout: 20000, env: { ...process.env, NODE_NO_WARNINGS: '1' },
      });
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, '');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}
