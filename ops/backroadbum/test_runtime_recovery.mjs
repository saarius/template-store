import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runtimeRecoveryRequestAllowed, publicPaths } from './verify-runtime-recovery.mjs';

const command = fileURLToPath(new URL('./verify-runtime-recovery.mjs', import.meta.url));
test('recovery HTTP reader admits only named public reads, media and anonymous admin challenge', () => {
  for (const path of [...publicPaths, '/_emdash/admin', '/_emdash/api/plugins/r_gshdrqaldna3r7sn/catalog/public',
    '/_emdash/api/media/file/media/synthetic.png']) {
    assert.equal(runtimeRecoveryRequestAllowed(path), true, path);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
      assert.equal(runtimeRecoveryRequestAllowed(path, method), false);
    }
  }
});
test('reader refuses hosted URLs, checkout, owner mutations and query capabilities', () => {
  for (const path of ['https://backroadbum.com/shop', 'https://payments.dinkuskit.com/',
    'http://localhost:4399/shop', '/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/start',
    '/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/prepare',
    '/_emdash/api/plugins/r_ehdlg5cxkb3ffqvr/shipping', '/shop?q=capability',
    '/_emdash/api/media/file/%2e%2e/private', '/_emdash/api/media/file/../../private']) {
    assert.equal(runtimeRecoveryRequestAllowed(path), false, path);
  }
});
test('direct execution outside the isolated namespace refuses before live reads', () => {
  const env = { ...process.env };
  delete env.BACKROADBUM_RESTORE_DRILL;
  delete env.BACKROADBUM_RESTORE_HOST_NET;
  const result = spawnSync(process.execPath, [command], { encoding: 'utf8', env, timeout: 15000 });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Isolated runtime recovery check refused; private details withheld\./);
});
