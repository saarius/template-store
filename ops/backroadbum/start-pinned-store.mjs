import { lstatSync, realpathSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStore } from './start-store.mjs';

export function strictlyUnder(root, path) {
  const child = relative(root, path);
  return child !== '' && child !== '..' && !child.startsWith('..' + sep) && !isAbsolute(child);
}

export function pinRuntimeModules(release, dependencies) {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context);
      if (resolved.url.startsWith('file:')) {
        const file = realpathSync(fileURLToPath(resolved.url));
        const inBundle = strictlyUnder(release, file) && !relative(release, file).split(sep).includes('node_modules');
        if (!inBundle && !strictlyUnder(dependencies, file)) {
          throw new Error('Runtime resolved a file outside the selected release and dependency tree.');
        }
      }
      return resolved;
    },
  });
}

/** Resolve current once. The release and its installed packages then travel together. */
export function pinnedRelease(entry, workspace = fileURLToPath(new URL('../../../../', import.meta.url))) {
  const release = realpathSync(resolve(dirname(entry), '..'));
  const path = join(release, 'server', 'entry.mjs');
  const link = join(release, 'node_modules');
  if (realpathSync(entry) !== path || !lstatSync(path).isFile() || !lstatSync(link).isSymbolicLink()) {
    throw new Error('Expected a built release with its own dependency link.');
  }
  const dependencies = realpathSync(link);
  if (!strictlyUnder(workspace, dependencies) || basename(dependencies) !== 'node_modules' ||
      strictlyUnder(release, dependencies) || !lstatSync(dependencies).isDirectory()) {
    throw new Error('Expected a separate installed dependency tree under the workspace.');
  }
  return { release, entry: path, dependencies };
}

if (import.meta.main) {
  try {
    if (process.argv.length !== 3) throw new Error('Expected exactly one server entry.');
    const selected = pinnedRelease(resolve(process.argv[2]));
    pinRuntimeModules(selected.release, selected.dependencies);
    await startStore(selected.entry);
  } catch {
    console.error('[store] Startup failed.');
    process.exitCode = 1;
  }
}
