import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Merchant-only Node launcher; does not change Astro or any Registry plugin. */
export async function startStore(entry, { shutdownMs = 8000 } = {}) {
  if (!Number.isInteger(shutdownMs) || shutdownMs < 1 || shutdownMs > 8000) {
    throw new Error('Shutdown deadline must fit inside the systemd stop timeout.');
  }
  let runtime;
  let stopping = false;
  let releaseStartup;
  const started = new Promise(resolveStartup => { releaseStartup = resolveStartup; });

  async function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    console.info('[store] Shutdown requested; closing HTTP admission.');
    // A stuck request/handle is a failed shutdown, not a successful drain.
    // unref permits a clean natural exit once HTTP and workerd release handles.
    setTimeout(() => {
      console.error('[store] Shutdown deadline exceeded.');
      process.exit(1);
    }, shutdownMs).unref();
    await started;
    if (runtime) {
      await new Promise((resolveClose, reject) => {
        runtime.server.server.close(error => {
          if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
          else resolveClose();
        });
      });
    }
    console.info('[store] HTTP drained; releasing sandbox resources.');
    // systemd sends SIGINT to the main process only (KillMode=mixed), leaving
    // workerd available for admitted requests. After HTTP drains, the runner's
    // existing SIGTERM listener owns worker/backing-server cleanup. Do not
    // remove library listeners, call private runner APIs, or force success exit.
    // Direct external SIGTERM is bounded too, but does not promise worker drain.
    if (signal !== 'SIGTERM') process.kill(process.pid, 'SIGTERM');
  }

  const onSignal = signal => {
    void shutdown(signal).catch(() => {
      console.error('[store] Shutdown failed.');
      process.exit(1);
    });
  };
  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));
  process.env.ASTRO_NODE_AUTOSTART = 'disabled';
  try {
    const app = await import(pathToFileURL(resolve(entry)).href);
    if (typeof app.startServer !== 'function') throw new Error('Missing standalone startServer export.');
    if (!stopping) {
      runtime = app.startServer();
      void runtime.done.catch(() => {
        process.exitCode = 1;
        onSignal('server-error');
      });
    }
    return runtime;
  } catch {
    process.exitCode = 1;
    onSignal('startup-error');
    throw new Error('Store startup failed.');
  } finally {
    releaseStartup();
  }
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  if (!process.argv[2]) {
    console.error('Usage: node start-store.mjs <standalone server entry>');
    process.exitCode = 1;
  } else {
    await startStore(process.argv[2]).catch(() => {
      // Never serialize startup errors that could contain private configuration.
      console.error('[store] Startup failed.');
      process.exitCode = 1;
    });
  }
}
