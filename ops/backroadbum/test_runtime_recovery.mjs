import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runtimeRecoveryRequestAllowed, publicPaths, recoveryFieldNotePaths, recoveryFeedCounts } from './verify-runtime-recovery.mjs';

const command = fileURLToPath(new URL('./verify-runtime-recovery.mjs', import.meta.url));
test('recovery HTTP reader admits only named public reads, media and anonymous admin challenge', () => {
  for (const path of [...publicPaths, '/feeds/agent-catalog.json', '/_emdash/admin', '/_emdash/api/plugins/r_gshdrqaldna3r7sn/catalog/public',
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
test('journal routes come only from published undeleted field notes', () => {
  const row = (slug, status = 'published', deleted_at = null) => ({ slug, status, deleted_at });
  assert.deepEqual(recoveryFieldNotePaths([
    row('field-note-two'), row('field-note-one'), row('field-note-private', 'draft'),
    row('field-note-deleted', 'published', '2026-01-01'), row('test-store'), row('home'), row(null),
  ]), ['/field-note-one', '/field-note-two']);
  for (const slug of ['field-note-../private', 'field-note-a?capability=synthetic', 'field-note-a#fragment', 'field-note-a/'.repeat(20)]) {
    assert.throws(() => recoveryFieldNotePaths([row(slug)]));
  }
  assert.throws(() => recoveryFieldNotePaths([row('field-note-same'), row('field-note-same')]));
  assert.throws(() => recoveryFieldNotePaths(Array.from({ length: 33 }, (_, n) => row(`field-note-${n}`))));
});
test('dynamic route grants cannot admit APIs, drafts, hosted URLs, queries or fragments', () => {
  const allowed = ['/field-note-public', '/_emdash/api/plugins/private/checkout/start', '/unknown'];
  assert.equal(runtimeRecoveryRequestAllowed('/field-note-public', 'GET', allowed), true);
  for (const path of ['/field-note-draft', '/field-note-public?token=synthetic', '/field-note-public#private',
    'https://backroadbum.com/field-note-public', 'http://synthetic@127.0.0.1:4399/field-note-public',
    '/_emdash/api/plugins/private/checkout/start', '/unknown']) {
    assert.equal(runtimeRecoveryRequestAllowed(path, 'GET', allowed), false, path);
  }
  for (const method of ['POST', 'HEAD', 'PUT', 'DELETE', 'PATCH']) {
    assert.equal(runtimeRecoveryRequestAllowed('/field-note-public', method, allowed), false);
  }
});
test('agent feed counts simple items and the real object-shaped option members', () => {
  assert.deepEqual(recoveryFeedCounts({ products: [
    { id: 'tee', variants: { members: [{ catalogItemId: 'tee-m' }, { catalogItemId: 'tee-xl' }] } },
    { id: 'mug' },
  ] }), { products: 2, members: 3 });
  assert.deepEqual(recoveryFeedCounts({ products: [] }), { products: 0, members: 0 });
});
test('agent feed refuses malformed, duplicated, missing or unbounded public identities', () => {
  for (const feed of [null, {}, { products: {} }, { products: [{ id: '../private' }] },
    { products: [{ id: 'same' }, { id: 'same' }] },
    { products: [{ id: 'tee', variants: [] }] },
    { products: [{ id: 'tee', variants: { members: [] } }] },
    { products: [{ id: 'tee', variants: { members: [{ catalogItemId: 'same' }, { catalogItemId: 'same' }] } }] },
    { products: [{ id: 'tee', variants: { members: [{}] } }] },
    { products: Array.from({ length: 201 }, (_, n) => ({ id: `product-${n}` })) },
    { products: [{ id: 'tee', variants: { members: Array.from({ length: 201 }, (_, n) => ({ catalogItemId: `tee-${n}` })) } }] },
  ]) assert.throws(() => recoveryFeedCounts(feed));
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
