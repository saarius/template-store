// The recovery drill uses the normal launcher, with module resolution pinned
// to this disposable release and its selected dependency tree.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { basename } from 'node:path';
import { pinRuntimeModules, strictlyUnder } from './start-pinned-store.mjs';
import { startStore } from './start-store.mjs';

const root = '/var/lib/backroadbum';

export function confirmRecoveryWorkerd(runtimePid, dependencies) {
  assert.ok(Number.isSafeInteger(runtimePid) && runtimePid > 1, 'Valid runtime process required');
  const children = readFileSync(`/proc/${runtimePid}/task/${runtimePid}/children`, 'utf8').trim().split(/\s+/);
  const executables = [];
  for (const pid of children.filter(pid => /^[0-9]+$/.test(pid))) {
    try { executables.push(readlinkSync(`/proc/${pid}/exe`)); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; } // child just exited
  }
  const workers = executables.filter(path => basename(path).replace(/ \(deleted\)$/, '') === 'workerd');
  assert.ok(workers.length > 0 && workers.every(path => !path.endsWith(' (deleted)') && strictlyUnder(dependencies, path)),
    'Running workerd must come from the selected dependency tree');
}

if (import.meta.main) {
  try {
    assert.equal(process.env.BACKROADBUM_RESTORE_DRILL, '1');
    const host = process.env.BACKROADBUM_RESTORE_HOST_NET;
    assert.match(host ?? '', /^net:\[\d+\]$/);
    assert.notEqual(readlinkSync('/proc/self/ns/net'), host);
    assert.equal(readFileSync(`${root}/.runtime-recovery`, 'utf8'), 'backroadbum.runtime-recovery/v1\n');
    assert.equal(existsSync(`${root}/current`), false);
    const release = realpathSync(`${root}/restored-release`);
    const dependencies = realpathSync(`${root}/node_modules`);
    pinRuntimeModules(release, dependencies);
    await startStore(`${release}/server/entry.mjs`);
  } catch {
    console.error('Isolated recovery startup refused.');
    process.exitCode = 1;
  }
}
