// Runs only inside verify_runtime_recovery.py's disposable mount/network namespace.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { readBusinessSnapshot } from '../../scripts/inspect-backroadbum-business.mjs';
import { inspectEmDashCopy } from './verify-emdash-recovery.mjs';
import { confirmRecoveryWorkerd } from './start-recovery-runtime.mjs';

const root = '/var/lib/backroadbum';
const origin = 'http://127.0.0.1:4399';
const catalogPath = '/_emdash/api/plugins/r_gshdrqaldna3r7sn/catalog/public';
const feedPath = '/feeds/agent-catalog.json';
const noteSlug = /^field-note-[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const publicPaths = ['/', '/shop', '/products/creekside-camp-mug', '/products/long-way-cap', '/field-notes', '/cart'];

/** Only current published journal routes; never turn archived slugs into arbitrary API reads. */
export function recoveryFieldNotePaths(rows) {
  const notes = rows.filter(row => row.status === 'published' && row.deleted_at === null &&
    typeof row.slug === 'string' && row.slug.startsWith('field-note-'));
  assert.ok(notes.length <= 32, 'Bounded journal recovery reads required');
  assert.ok(notes.every(row => row.slug.length <= 160 && noteSlug.test(row.slug)), 'Unsafe journal slug');
  const paths = notes.map(row => '/' + row.slug).sort();
  assert.equal(new Set(paths).size, paths.length, 'Ambiguous journal routes');
  return paths;
}

/** Count the actual feed envelope, whose variants are an object, not an array. */
export function recoveryFeedCounts(feed) {
  assert.ok(Array.isArray(feed?.products) && feed.products.length <= 200, 'Bounded agent feed required');
  const products = feed.products;
  const ids = products.map(product => product.id);
  const members = products.flatMap(product => {
    if (product.variants === undefined) return [product.id];
    assert.ok(Array.isArray(product.variants?.members) && product.variants.members.length > 0 &&
      product.variants.members.length <= 200, 'Concrete feed members required');
    return product.variants.members.map(member => member.catalogItemId);
  });
  for (const group of [ids, members]) {
    assert.ok(group.every(id => typeof id === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(id)), 'Public identity required');
    assert.equal(new Set(group).size, group.length, 'Duplicate public identity');
  }
  return { products: products.length, members: members.length };
}

export function runtimeRecoveryRequestAllowed(input, method = 'GET', fieldNotePaths = []) {
  const url = new URL(input, origin);
  return method === 'GET' && url.origin === origin && !url.search && !url.hash && !url.username && !url.password &&
    (publicPaths.includes(url.pathname) || url.pathname === catalogPath || url.pathname === feedPath ||
      noteSlug.test(url.pathname.slice(1)) && fieldNotePaths.includes(url.pathname) || url.pathname === '/_emdash/admin' ||
      /^\/_emdash\/api\/media\/file\/[a-zA-Z0-9._/-]+$/.test(url.pathname) && !url.pathname.includes('..'));
}

export async function inspectRuntimeCopy() {
  assert.equal(process.env.BACKROADBUM_RESTORE_DRILL, '1');
  const hostNetwork = process.env.BACKROADBUM_RESTORE_HOST_NET;
  assert.match(hostNetwork ?? '', /^net:\[\d+\]$/);
  assert.notEqual(readlinkSync('/proc/self/ns/net'), hostNetwork, 'A private network namespace is required');
  assert.equal(readFileSync(`${root}/.runtime-recovery`, 'utf8'), 'backroadbum.runtime-recovery/v1\n');
  assert.equal(existsSync(`${root}/current`), false, 'Live release pointer must be hidden');
  assert.equal(existsSync('/etc/backroadbum/emdash.env'), false, 'Live private configuration must be hidden');
  const credentials = await inspectEmDashCopy(`${root}/content.db`, `${root}/recovery/emdash.env`);
  const encryption = readFileSync(`${root}/recovery/emdash.env`, 'utf8').trim().split('=', 2)[1];
  const snapshot = () => {
    const db = new DatabaseSync(`${root}/content.db`, { readOnly: true });
    try {
      const scoped = readBusinessSnapshot(db);
      // Include saved carts, capabilities and every other plugin collection,
      // not just the six named business groups used by the merchant diagnostic.
      for (const table of ['_plugin_storage', 'media']) {
        const rows = db.prepare(`SELECT * FROM ${table} ORDER BY ${table === '_plugin_storage' ? 'collection,id' : 'id'}`).all();
        scoped[table] = { source: 'runtime-table', count: rows.length,
          sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
      }
      return scoped;
    } finally { db.close(); }
  };
  const before = snapshot();
  const db = new DatabaseSync(`${root}/content.db`, { readOnly: true });
  let media, fieldNotePaths;
  try {
    media = db.prepare("SELECT storage_key,size,content_hash FROM media WHERE status='ready' ORDER BY id LIMIT 1").get();
    fieldNotePaths = recoveryFieldNotePaths(db.prepare('SELECT slug,status,deleted_at FROM ec_pages').all());
  } finally { db.close(); }
  assert.ok(media, 'Ready media required');
  const selectedDependencies = realpathSync(`${root}/node_modules`);
  const child = spawn('/opt/node/bin/node', ['ops/backroadbum/start-recovery-runtime.mjs'], {
    cwd: process.cwd(), stdio: 'ignore', env: { ...process.env, HOST: '127.0.0.1', PORT: '4399',
      EMDASH_ENCRYPTION_KEY: encryption, BACKROADBUM_CHECKOUT_ENABLED: '0', NODE_OPTIONS: '--max-old-space-size=400' },
  });
  let exited;
  child.once('exit', (code, signal) => { exited = { code, signal }; });
  child.once('error', () => { exited = { code: 1, signal: null }; });
  async function get(path) {
    assert.equal(runtimeRecoveryRequestAllowed(path, 'GET', fieldNotePaths), true);
    return fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  }
  try {
    let ready = false;
    for (let n = 0; n < 45; n++) {
      if (exited) throw Error('runtime_startup_refused');
      try { const response = await get('/'); await response.arrayBuffer(); ready = response.status === 200; } catch { /* startup only */ }
      if (ready) break;
      await delay(500);
    }
    assert.equal(ready, true, 'Restored runtime must become ready');
    const pages = [];
    for (const path of publicPaths) {
      const response = await get(path);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /<h1[\s>]/);
      assert.match(html, /Backroad Bum/);
      pages.push({ surface: path === '/' ? 'home' : path.split('/').at(-1), http: response.status });
    }
    for (const path of fieldNotePaths) {
      const response = await get(path);
      assert.equal(response.status, 200, 'Archived published journal page must render');
      const html = await response.text();
      assert.match(html, /<h1[\s>]/);
      assert.match(html, /Backroad Bum/);
      assert.ok(html.includes(`data-cms-page="${path.slice(1)}"`), 'Requested CMS page required');
      assert.ok(html.includes('data-field-note-page'), 'Journal reading shell required');
    }
    const feedResponse = await get(feedPath);
    assert.equal(feedResponse.status, 200);
    assert.match(feedResponse.headers.get('content-type') ?? '', /application\/json/);
    const agentCatalog = recoveryFeedCounts(await feedResponse.json());
    const catalogResponse = await get(catalogPath);
    assert.equal(catalogResponse.status, 200);
    const catalog = await catalogResponse.json();
    assert.equal(catalog.success, true);
    assert.ok(Array.isArray(catalog.data?.products) && catalog.data.products.length > 0);
    const mug = catalog.data.products.find(product => product.name === 'Creekside Camp Mug');
    assert.ok(mug?.gallery?.length >= 2, 'Archived native mug gallery required');
    confirmRecoveryWorkerd(child.pid, selectedDependencies);
    const mediaResponse = await get(`/_emdash/api/media/file/${media.storage_key}`);
    assert.equal(mediaResponse.status, 200);
    const bytes = Buffer.from(await mediaResponse.arrayBuffer());
    assert.equal(bytes.length, media.size);
    const [algorithm, hash] = media.content_hash.split(':');
    assert.equal(createHash(algorithm).update(bytes).digest('hex'), hash);
    const admin = await get('/_emdash/admin');
    assert.ok([302, 303, 307].includes(admin.status), 'Anonymous admin must require sign-in');
    const login = new URL(admin.headers.get('location'), origin);
    assert.equal(login.pathname, '/_emdash/admin/login');
    child.kill('SIGINT');
    for (let n = 0; n < 110 && !exited; n++) await delay(100);
    assert.equal(exited?.code, 0, 'Restored runtime must drain cleanly');
    assert.deepEqual(snapshot(), before, 'Runtime reads and shutdown must retain all scoped business rows');
    const business = Object.entries(before).filter(([, value]) => value.source !== 'runtime-table');
    return { schema: 'backroadbum.runtime-recovery-check/v1', checkedAt: new Date().toISOString(),
      outboundNetwork: 'isolated', liveFilesReplaced: false, hostPrivateConfigurationHidden: true,
      archivedCredentialDecryption: credentials.decryption, encryptedPlugins: credentials.encryptedPlugins,
      pages, fieldNotePagesVerified: fieldNotePaths.length, agentCatalog,
      businessCollectionsRetained: Object.fromEntries(business.map(([name, value]) => [name, value.count])),
      businessCollectionsSha256: createHash('sha256').update(JSON.stringify(Object.fromEntries(business))).digest('hex'),
      catalogProducts: catalog.data.products.length, catalogRegistryRuntime: 'ok',
      mediaHttpAndHash: 'ok', anonymousAdminRequiresSignIn: true, adminSignInTested: false,
      businessRowsUnchanged: true, allPluginStorageAndMediaRowsUnchanged: true,
      ordersRetained: before.orders.count, runtimeDrain: 'ok',
      hostedAuthorizationTested: false, offHostRecoveryTested: false, commerceActionsReplayed: 0,
      dependencyResolutionGuard: true, workerdFromDependencyTree: true };
  } finally {
    if (!exited) { child.kill('SIGINT'); await delay(1000); }
    // The transient systemd cgroup owns and bounds all descendant workerd processes.
  }
}

if (import.meta.main) {
  process.umask(0o077);
  try { console.log(JSON.stringify(await inspectRuntimeCopy())); }
  catch { console.error('Isolated runtime recovery check refused; private details withheld.'); process.exitCode = 1; }
}
