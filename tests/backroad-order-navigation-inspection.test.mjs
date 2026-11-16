import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { orderNavigationRequestAllowed as allowed, readOrderNavigationArgs as args } from '../scripts/lib/order-navigation-inspection.mjs';
const admin = 'https://backroadbum.com/_emdash/api/plugins/r_gshdrqaldna3r7sn/admin';
const action = action_id => ({ type: 'block_action', page: '/orders', action_id });

test('default invocation is inert and rejects arbitrary targets', () => {
  assert.equal(args([]), null);
  assert.deepEqual(args(['--check']), { order: 1010 });
  assert.deepEqual(args(['--order=1009', '--check']), { order: 1009 });
  for (const input of [['--order=1010'], ['--check', '--check'], ['--check', '--order=0'], ['--check', '--order=1.0'], ['--check', '--state=/private'], ['--url=https://example.test']]) assert.throws(() => args(input));
  const result = spawnSync(process.execPath, ['scripts/inspect-backroadbum-order-navigation.mjs'], { cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /No check run/u);
});

test('allows only same-store reads and native staff authentication', () => {
  assert.equal(allowed(admin, 'GET'), true);
  assert.equal(allowed(admin, 'HEAD'), true);
  assert.equal(allowed('https://backroadbum.com/_emdash/api/auth/passkey/authenticate', 'POST', {}), true);
  for (const url of ['https://ship.dinkuskit.com/', 'https://dinkuskit.com/account', 'https://checkout.stripe.com/', 'https://backroadbum.com.evil.test/', 'http://backroadbum.com/', 'not a URL']) assert.equal(allowed(url, 'GET'), false);
});

test('allows Orders page load, inspect and back only', () => {
  assert.equal(allowed(admin, 'POST', { type: 'page_load', page: '/orders' }), true);
  assert.equal(allowed(admin, 'POST', action('orders.open:synthetic-order')), true);
  assert.equal(allowed(admin, 'POST', { input: action('orders.list') }), true);
  for (const body of [{ type: 'page_load', page: 'settings' }, { type: 'page_load' }, action('orders.open:'), action('orders.open:bad\nvalue'), action('orders.list:other'), null, 'invalid']) assert.equal(allowed(admin, 'POST', body), false);
});

test('refuses every order, catalog, payment, mail and shipment mutation', () => {
  for (const id of ['orders.reopen:2:synthetic', 'orders.finish:synthetic', 'orders.complete:1:synthetic', 'orders.address:synthetic', 'orders.save:2:synthetic', 'orders.pack:synthetic', 'buy', 'sync', 'connect']) assert.equal(allowed(admin, 'POST', action(id)), false);
  assert.equal(allowed(admin, 'POST', { type: 'form_submit', page: '/orders', action_id: 'orders.save:1:synthetic' }), false);
  for (const method of ['PUT', 'PATCH', 'DELETE']) assert.equal(allowed(admin, method, action('orders.list')), false);
  for (const path of ['/checkout', '/api/checkout/status', '/_emdash/api/settings/email', '/_emdash/api/plugins/r_gshdrqaldna3r7sn/account/start', '/_emdash/api/plugins/r_ehdlg5cxkb3ffqvr/admin']) assert.equal(allowed('https://backroadbum.com' + path, 'POST', action('orders.list')), false);
});
