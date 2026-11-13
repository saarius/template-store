// Isolated merchant restore drill. Never replaces live files, binds a public port or admits an order.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPracticeHost } from '../../../ship/ops/backroadbum/runtime.mjs';

export async function withRestoredShip(archive, inspect = async () => {}) {
  const temp = await mkdtemp(join(tmpdir(), 'brb-ship-recovery-'));
  let host;
  try {
    const extracted = join(temp, 'restored');
    const result = spawnSync('python3', ['-c', `
import importlib.util, pathlib, sys
spec = importlib.util.spec_from_file_location('backup', sys.argv[1])
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)
backup.restore_ship_copy(sys.argv[2], pathlib.Path(sys.argv[3]))
`, fileURLToPath(new URL('./backup.py', import.meta.url)), resolve(archive), extracted], { encoding: 'utf8', timeout: 60000 });
    // Do not relay private filenames, config values or database contents on error.
    if (result.status !== 0) throw Error('ship_recovery_extraction_refused');
    const config = JSON.parse(await readFile(join(extracted, 'recovery/ship.json'), 'utf8'));
    const options = { config, stateDir: join(extracted, 'ship'), fetchJwks: async () => { throw Error('restore_network_disabled'); } };
    host = await createPracticeHost(options);
    const health = await (await host.fetch('/health')).json();
    assert.equal(health.mode, 'test'); assert.equal(health.provider, 'practice'); assert.equal(health.commerceConnected, false);
    const namespace = await host.mf.getDurableObjectNamespace('SHIP_STORES');
    const admission = await namespace.get(namespace.idFromName('backroadbum')).getMerchantAdmission();
    assert.equal(health.admission, admission.enabled ? 'selected-order' : 'closed');
    if (config.allowedOrderId) assert.equal(admission.orderId, config.allowedOrderId);
    assert.equal((await host.fetch('/v1/admin/orders')).status, 401);
    await inspect(host);
    assert.deepEqual(host.network(), { allowedFetches: 0, refusedFetches: 0 });
    await host.dispose(); host = undefined;
    host = await createPracticeHost(options);
    assert.deepEqual(await (await host.fetch('/health')).json(), health);
    await inspect(host);
    assert.deepEqual(host.network(), { allowedFetches: 0, refusedFetches: 0 });
    return { schema: 'backroadbum.ship-recovery-check/v1', integrity: 'ok', healthHttp: 200, restart: 'ok',
      mode: health.mode, admission: health.admission, commerceConnected: false, outboundRequests: 0 };
  } finally {
    try { if (host) await host.dispose(); } finally { await rm(temp, { recursive: true, force: true }); }
  }
}

// Node 24 tracks the entrypoint even when argv names a file/directory symlink.
if (import.meta.main) {
  process.umask(0o077);
  if (process.argv.length !== 3) { console.error('Usage: node ops/backroadbum/verify-ship-recovery.mjs PRIVATE_ARCHIVE'); process.exitCode = 1; }
  else try { console.log(JSON.stringify(await withRestoredShip(process.argv[2]))); }
  catch { console.error('Isolated Ship recovery check failed; live files were not replaced.'); process.exitCode = 1; }
}
