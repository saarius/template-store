import assert from 'node:assert/strict';
import { test } from 'node:test';
import { options, assertIsolated, safeMediaKey } from '../scripts/qualify-backroadbum-installed-retained.mjs';

test('does nothing unless explicitly armed for exactly one source candidate', () => {
  assert.equal(options([]), null);
  assert.ok(options(['--check', '--candidate=/source']).candidate.endsWith('/source'));
  for (const args of [['--candidate=/source'], ['--check', '--candidate='], ['--check', '--check'],
    ['--check', '--db=/private'], ['--check', '--candidate=/source', '--url=https://elsewhere.test']]) assert.throws(() => options(args));
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
test('accepts only bounded relative upload keys, never traversal or URL input', () => {
  for (const key of ['picture.svg', 'catalog/picture-1.webp', '2026/11/16/photo.png']) assert.equal(safeMediaKey(key), true);
  for (const key of ['', '/etc/private', '../private', 'a/../private', 'a/./private', 'a//private', 'https://host/pic.png', 'x%2f..', 'x?query', 'x#fragment', 'x'.repeat(1024), null]) assert.equal(safeMediaKey(key), false);
});
