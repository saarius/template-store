import assert from 'node:assert/strict';
import { test } from 'node:test';
import { options, assertIsolated, isPrivateArchivePath, retainedOnly, safeMediaKey } from '../scripts/qualify-backroadbum-installed-retained.mjs';

const archive = '/var/lib/backroadbum/backups/20261123T042007.391546Z.tar.gz';
test('does nothing unless explicitly armed for one candidate and one private archive', () => {
  assert.equal(options([]), null);
  assert.deepEqual(options(['--check', '--candidate=/source', `--archive=${archive}`]), { candidate: '/source', archive, storefront: false });
  for (const args of [['--check', '--candidate=/source'], ['--check', '--candidate=', `--archive=${archive}`],
    ['--check', '--check', `--archive=${archive}`], ['--check', '--db=/private', `--archive=${archive}`],
    ['--check', '--candidate=/source', `--archive=${archive}`, '--url=https://elsewhere.test']]) assert.throws(() => options(args));
});
test('admits only completed archive names in the private backup directory', () => {
  assert.equal(isPrivateArchivePath(archive), true);
  for (const path of [undefined, '/var/lib/backroadbum/content.db', '/tmp/archive.tar.gz', archive.replace('/backups/', '/backups/../'), archive + '.partial', archive + '\n'])
    assert.equal(isPrivateArchivePath(path), false);
});
test('accepts only loopback with no external route and private low-port binding enabled', () => {
  assert.doesNotThrow(() => assertIsolated(['lo'], [], '0\n'));
});
test('refuses the host network even when it has no default route', () => {
  assert.throws(() => assertIsolated(['eth0', 'lo'], [], '0'));
  assert.throws(() => assertIsolated([], [], '0'));
});
test('refuses any external routes or ordinary host low-port settings', () => {
  assert.throws(() => assertIsolated(['lo'], [{ dst: 'default', dev: 'eth0' }], '0'));
  assert.throws(() => assertIsolated(['lo'], [], '1024'));
});
test('copies only canonical retained storage verbatim and never cookies or other state', () => {
  const checkout = { name: 'dinkus.guest-checkout.v1', value: '{ "fixture": true }' };
  const cart = { name: 'dinkus.guest-cart.v1', value: '["fixture"]' };
  const origin = 'https://backroadbum.com';
  const saved = { cookies: [{ name: 'unrelated' }], origins: [
    { origin, localStorage: [checkout, { name: 'unrelated', value: 'fixture' }, cart], indexedDB: [] },
    { origin: 'https://foreign.test', localStorage: [checkout] },
  ] };
  assert.deepEqual(retainedOnly(saved), { cookies: [], origins: [{ origin, localStorage: [checkout, cart] }] });
  assert.equal(saved.origins[0].localStorage.length, 3);
  assert.throws(() => retainedOnly({ origins: [saved.origins[1]] }));
  assert.throws(() => retainedOnly({ origins: [{ origin, localStorage: [cart] }] }));
  assert.throws(() => retainedOnly({ origins: [{ origin, localStorage: [checkout, checkout] }] }));
});
test('accepts only bounded relative upload keys, never traversal or URL input', () => {
  for (const key of ['picture.svg', 'catalog/picture-1.webp', '2026/11/16/photo.png']) assert.equal(safeMediaKey(key), true);
  for (const key of ['', '/etc/private', '../private', 'a/../private', 'a/./private', 'a//private', 'https://host/pic.png', 'x%2f..', 'x?query', 'x#fragment', 'x'.repeat(1024), null]) assert.equal(safeMediaKey(key), false);
});
