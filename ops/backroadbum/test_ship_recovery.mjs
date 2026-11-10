// Reusable local-only integration proof using the peer merchant Ship composition.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createPracticeHost } from '../../../ship/ops/backroadbum/runtime.mjs';
import { withRestoredShip } from './verify-ship-recovery.mjs';
const require = createRequire(new URL('../../../ship/service/package.json', import.meta.url));
const { generateKeyPair, exportJWK, SignJWT } = require('jose');

async function store(host) {
  const ns = await host.mf.getDurableObjectNamespace('SHIP_STORES');
  return ns.get(ns.idFromName('backroadbum'));
}

test('online archive restores synthetic practice label, PDF capability and unacknowledged event through restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brb-ship-recovery-test-'));
  let host;
  try {
    await build();
    const config = { schema: 'backroadbum.ship-node/v1', generation: 'recovery-fixture', allowedOrderId: 'synthetic-recovery-order',
      sessionSecret: 'synthetic-recovery-secret-not-deployed-'.padEnd(48, 'x') };
    const configPath = join(root, 'private-ship.json');
    await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
    const keys = await generateKeyPair('ES256');
    const jwk = { ...await exportJWK(keys.publicKey), kid: 'recovery-fixture', alg: 'ES256', use: 'sig' };
    host = await createPracticeHost({ config, stateDir: join(root, 'ship'), fetchJwks: async () => Response.json({ keys: [jwk] }) });
    const source = await store(host);
    assert.equal((await source.receiveOrder({ schema: 'dinkuskit.commerce.ship-order/v1', orderId: config.allowedOrderId,
      number: 9999, version: 1, status: 'processing', test: true, completed: null,
      shipTo: { name: 'Fixture', line1: '1 Example Way', city: 'Example', region: 'CA', postalCode: '90000', country: 'US' },
      lines: [{ catalogItemId: 'fixture-item', name: 'Fixture mug', quantity: 1, weightOz: 8 }] })).ok, true);
    assert.equal((await source.saveShipFrom({ name: 'Fixture store', line1: '2 Example Way', city: 'Example', region: 'CA', postalCode: '90000' })).ok, true);
    assert.equal((await source.addBox({ name: 'Fixture box', lengthIn: '6', widthIn: '4', heightIn: '3', weightOz: '1' })).ok, true);
    const boxId = (await source.getSettings()).boxes[0].boxId;
    const bought = await source.buyLabel({ orderId: config.allowedOrderId, fields: { kind: 'practice', version: 1, boxId, weightOz: 9, service: 'PM' }, uid: 'fixture' });
    assert.equal(bought.status, 201);
    assert.equal(bought.body.practice, true);
    const events = await source.listLabels();
    assert.equal(events.body.length, 1);
    const pass = await new SignJWT({ site_id: 'backroadbum', site_origin: 'https://backroadbum.com', scope: 'ship:admin' })
      .setProtectedHeader({ alg: 'ES256', kid: 'recovery-fixture' }).setIssuer('https://backroadbum.com').setAudience('backroadbum-ship')
      .setSubject('fixture').setIssuedAt().setExpirationTime('5m').sign(keys.privateKey);
    const print = await host.fetch('/v1/admin/labels/' + bought.body.labelId + '/print-link', {
      method: 'POST', headers: { authorization: 'Bearer ' + pass, 'content-type': 'application/json' }, body: '{}' });
    assert.equal(print.status, 200);
    const printPath = new URL((await print.json()).url).pathname;
    // Source host remains running: committed WAL state, never a raw copy of live files.
    const result = spawnSync('python3', ['-c', `
import importlib.util, pathlib, sqlite3, sys
root = pathlib.Path(sys.argv[2])
(root / 'uploads').mkdir()
with sqlite3.connect(root / 'content.db') as db:
    db.execute('CREATE TABLE fixture (id TEXT)')
spec = importlib.util.spec_from_file_location('backup', sys.argv[1])
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)
print(backup.snapshot(root, pathlib.Path(sys.argv[3])))
`, fileURLToPath(new URL('./backup.py', import.meta.url)), root, configPath], { encoding: 'utf8', timeout: 60000 });
    assert.equal(result.status, 0, 'synthetic archive created');
    const proof = await withRestoredShip(result.stdout.trim(), async restored => {
      const target = await store(restored);
      const restoredEvents = await target.listLabels();
      assert.equal(restoredEvents.body.length, 1);
      assert.equal(restoredEvents.body[0].eventId, events.body[0].eventId);
      assert.equal(restoredEvents.body[0].tracking, bought.body.tracking);
      assert.equal((await target.getOrder(config.allowedOrderId)).test, true);
      const pdf = await restored.fetch(printPath);
      assert.equal(pdf.status, 200);
      assert.match(await pdf.text(), /TEST - NOT POSTAGE/);
    });
    assert.equal(proof.restart, 'ok');
    assert.equal(proof.outboundRequests, 0);
    assert.equal((await source.listLabels()).body[0].eventId, events.body[0].eventId, 'live fixture was not acknowledged or changed');
  } finally {
    try { if (host) await host.dispose(); } finally { await rm(root, { recursive: true, force: true }); }
  }
});
