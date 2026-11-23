// The recovery drill uses the normal launcher, with module resolution pinned
// to this disposable release and its selected dependency tree.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { basename, isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = '/var/lib/backroadbum';
const launcher = new URL('./start-store.mjs', import.meta.url);

export function strictlyUnder(root, path) {
  const child = relative(root, path);
  return child !== '' && child !== '..' && !child.startsWith('..' + sep) && !isAbsolute(child);
}

export function pinRecoveryModules(release, dependencies, launcherPath) {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context);
      if (resolved.url.startsWith('file:')) {
        const file = realpathSync(fileURLToPath(resolved.url));
        // A nested node_modules in the release would make the selected lane
        // ambiguous. Aside from the shared launcher, only bundle files and
        // actual files from the selected dependency tree are allowed.
        const inBundle = strictlyUnder(release, file) && !relative(release, file).split(sep).includes('node_modules');
        if (!inBundle && file !== launcherPath && !strictlyUnder(dependencies, file)) {
          throw new Error('Recovery runtime resolved a file outside the selected release and dependency tree.');
        }
      }
      return resolved;
    },
  });
}

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
    pinRecoveryModules(release, dependencies, realpathSync(fileURLToPath(launcher)));
    const { startStore } = await import(launcher.href);
    await startStore(`${release}/server/entry.mjs`);
  } catch {
    console.error('Isolated recovery startup refused.');
    process.exitCode = 1;
  }
}
