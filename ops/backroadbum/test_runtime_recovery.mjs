import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
test('guard allows bundle and selected packages, rejects another tree even through a link', t => {
  const root = mkdtempSync(join(tmpdir(), 'brb-runtime-selection-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const release = join(root, 'release');
  const dependencies = join(root, 'selected', 'node_modules');
  const other = join(root, 'other', 'node_modules');
  const nested = join(release, 'node_modules');
  for (const path of [release, dependencies, other, nested]) mkdirSync(path, { recursive: true });
  for (const [dir, val] of [[release, 'bundle'], [dependencies, 'selected'], [other, 'other'], [nested, 'nested']]) {
    writeFileSync(join(dir, 'item.mjs'), `export default ${JSON.stringify(val)};`);
  }
  symlinkSync(join(other, 'item.mjs'), join(dependencies, 'fallback.mjs'));
  const guard = new URL('./start-pinned-store.mjs', import.meta.url).href;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { join } from 'node:path';
    import { pinRuntimeModules } from ${JSON.stringify(guard)};
    const [release, dependencies, other, nested] = process.argv.slice(1);
    pinRuntimeModules(release, dependencies);
    assert.equal((await import(join(release, 'item.mjs'))).default, 'bundle');
    assert.equal((await import(join(dependencies, 'item.mjs'))).default, 'selected');
    for (const path of [join(other, 'item.mjs'), join(nested, 'item.mjs'), join(dependencies, 'fallback.mjs')]) {
      await assert.rejects(import(path), /outside the selected release and dependency tree/);
    }
  `, release, dependencies, other, nested], { encoding: 'utf8', timeout: 15000 });
  assert.equal(child.status, 0, child.stderr);
});

test('pinned serving CLI follows one pointer for build and dependencies and refuses global fallback', t => {
  const workspace = fileURLToPath(new URL('../../../../', import.meta.url));
  const root = mkdtempSync(join(workspace, '.brb-release-selection-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const releases = join(root, 'releases');
  const entry = 'server/entry.mjs';
  for (const lane of ['old', 'new', 'incomplete', 'legacy']) {
    const release = join(releases, lane);
    mkdirSync(join(release, 'server'), { recursive: true });
    writeFileSync(join(release, entry), `
      import value from 'fixture-version';
      export function startServer() {
        console.log(${JSON.stringify(lane)} + ':' + value);
        return { done: Promise.resolve() };
      }
    `);
    if (lane !== 'legacy') {
      const tree = join(root, 'installed', lane, 'node_modules');
      mkdirSync(tree, { recursive: true });
      symlinkSync(tree, join(release, 'node_modules'), 'dir');
      if (lane !== 'incomplete') mkdirSync(join(tree, 'fixture-version'));
      if (lane !== 'incomplete') writeFileSync(join(tree, 'fixture-version/index.js'), `module.exports = '${lane}';`);
    }
  }
  // A good legacy parent would silently satisfy an import from the incomplete release.
  symlinkSync(join(root, 'installed', 'old', 'node_modules'), join(root, 'node_modules'), 'dir');
  const start = (lane, pinned = true) => {
    const cli = fileURLToPath(new URL(pinned ? './start-pinned-store.mjs' : './start-store.mjs', import.meta.url));
    symlinkSync(join('releases', lane), join(root, 'current.next'), 'dir');
    renameSync(join(root, 'current.next'), join(root, 'current'));
    return spawnSync(process.execPath, [cli, join(root, 'current', entry)],
      { encoding: 'utf8', timeout: 10000 });
  };
  for (const lane of ['old', 'new', 'old']) {
    const result = start(lane);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), `${lane}:${lane}`);
  }
  assert.equal(start('incomplete', false).stdout.trim(), 'incomplete:old');
  for (const lane of ['incomplete', 'legacy']) {
    const result = start(lane);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /(?:incomplete|legacy):old/);
    assert.match(result.stderr, /^\[store\] Startup failed\./m);
    assert.doesNotMatch(result.stderr, /fixture-version|node_modules|brb-release-selection/);
  }
});

test('direct execution outside the isolated namespace refuses before live reads', () => {
  const env = { ...process.env };
  delete env.BACKROADBUM_RESTORE_DRILL;
  delete env.BACKROADBUM_RESTORE_HOST_NET;
  for (const [script, message] of [[command, /Isolated runtime recovery check refused; private details withheld\./],
    [fileURLToPath(new URL('./start-recovery-runtime.mjs', import.meta.url)), /Isolated recovery startup refused\./]]) {
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8', env, timeout: 15000 });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, message);
  }
});
