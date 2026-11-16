#!/usr/bin/env node
/** Private operator qualification. Run ONLY in a loopback-only network namespace.
 * Copies selected merchant rows into disposable SQLite, never production settings,
 * users, hosted consents or Payments. Uses original browser state without saving it.
 * Source-built sandbox mount, NOT a signed installation or a live upgrade.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { spawnQualificationProcess as spawn, stopQualificationProcess as stop } from './lib/qualification-process.mjs';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync, chmodSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:https';
import http from 'node:http';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { copyPublicContent, isolatedServerCommand, proveStorefrontHTTPS, localHTTPS } from './lib/storefront-https-proof.mjs';

const PRIMARY = '/var/lib/trialrun/workspace/repos/template-store';
const ORIGIN = 'https://backroadbum.com';
const ID = 'r_gshdrqaldna3r7sn';
const FILES = [['field-book-test-browser.json', 1009], ['shopper-email-test-browser.json', 1010]];
const COLLECTIONS = ['catalog_items', 'catalog_media', 'product_pages', 'orders', 'order_numbers', 'checkout_carts', 'checkout_guest_capabilities'];
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pause = ms => new Promise(done => setTimeout(done, ms));

export function options(args) {
  if (!args.length) return null;
  const storefront = args.includes('--storefront');
  assert.equal(args.length, storefront ? 3 : 2);
  assert.equal(args.filter(x => x === '--check').length, 1);
  assert.ok(args.every(x => x === '--check' || x === '--storefront' || x.startsWith('--candidate=')));
  const candidate = args.find(x => x.startsWith('--candidate='))?.slice(12);
  assert.ok(candidate);
  return { candidate: resolve(candidate), storefront };
}

export function assertIsolated(interfaces, routes, unprivilegedPort) {
  assert.deepEqual(interfaces, ['lo'], 'Loopback-only network namespace required');
  assert.deepEqual(routes, [], 'External routes forbidden');
  assert.equal(unprivilegedPort.trim(), '0', 'Enable local HTTPS binding only in this private network namespace');
}

export function safeMediaKey(key) {
  return typeof key === 'string' && key.length > 0 && key.length < 1024 &&
    !key.startsWith('/') && !key.split('/').some(x => !x || x === '.' || x === '..') && /^[a-zA-Z0-9._/-]+$/.test(key);
}

export async function qualify({ candidate, storefront = false }) {
  let stage = 'isolation admission';
  const artifacts = process.env.BACKROADBUM_QUALIFICATION_ARTIFACTS;
  let site, db, source, server, tls, assets, browser, linkedPeers, staged;
  const originalUmask = process.umask(0o077);
  try {
    if (artifacts) {
      assert.ok(resolve(artifacts).startsWith('/var/lib/trialrun/workspace/evidence/'), 'Painted artifacts must stay outside git');
      mkdirSync(artifacts, { recursive: true });
    }
    const command = (file, args, cwd) => {
      const result = spawnSync(file, args, { cwd, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME }, maxBuffer: 1024 * 1024 });
      assert.equal(result.status, 0, 'Local command failed');
      return result.stdout.trim();
    };
    assertIsolated(JSON.parse(command('ip', ['-j', 'link'])).map(x => x.ifname).sort(), JSON.parse(command('ip', ['-j', 'route'])), readFileSync('/proc/sys/net/ipv4/ip_unprivileged_port_start', 'utf8'));
    const git = (...args) => command('git', ['-C', candidate, ...args]);
    assert.equal(git('status', '--porcelain'), '');
    const head = git('rev-parse', 'HEAD');
    assert.equal(head, git('rev-parse', 'v0.9.0-beta.2^{commit}'));
    const merchant = resolve(import.meta.dirname, '..');
    // Imported merchant files resolve their own tsconfig peers. Reuse installed
    // primary dependencies without copying or deleting that serving directory.
    if (!existsSync(join(merchant, 'node_modules'))) {
      linkedPeers = join(merchant, 'node_modules');
      symlinkSync(join(PRIMARY, 'node_modules'), linkedPeers, 'dir');
    }
    const require = createRequire(join(PRIMARY, 'package.json'));
    const { Kysely, sql } = await import(pathToFileURL(require.resolve('kysely')).href);
    const { createDialect } = await import(pathToFileURL(require.resolve('emdash/db/sqlite')).href);
    const { runMigrations } = await import(pathToFileURL(require.resolve('emdash/db')).href);
    const Database = require('better-sqlite3');
    const { chromium, expect } = require('@playwright/test');
    mkdirSync(join(PRIMARY, 'runs'), { recursive: true });
    site = mkdtempSync(join(PRIMARY, 'runs', 'private-retained-'));
    const file = join(site, 'private.sqlite');
    db = new Kysely({ dialect: createDialect({ url: `file:${file}` }) });
    await runMigrations(db);
    chmodSync(file, 0o600);
    stage = 'selected read-only merchant snapshot';
    source = new Database('/var/lib/backroadbum/content.db', { readonly: true, fileMustExist: true });
    source.pragma('query_only = ON'); source.exec('BEGIN');
    const originalRows = source.prepare('SELECT * FROM _plugin_storage WHERE plugin_id=? ORDER BY collection,id').all(ID).filter(x => COLLECTIONS.includes(x.collection));
    const baseline = digest(originalRows.map(({ collection, id, data, revision }) => ({ collection, id, data, revision })));
    for (const row of originalRows) await db.insertInto('_plugin_storage').values(row).execute();
    const contentCounts = storefront ? await copyPublicContent(source, db, sql) : null;
    const originalKeys = new Set(originalRows.map(x => `${x.collection}:${x.id}`));
    const orders = originalRows.filter(x => x.collection === 'orders').map(x => JSON.parse(x.data));
    assert.equal(orders.length, 10);
    const mediaIds = new Set(originalRows.filter(x => x.collection === 'catalog_media').flatMap(x => {
      const data = JSON.parse(x.data); return [data.image, ...(data.gallery ?? [])].flatMap(x => x?.mediaId ? [x.mediaId] : []);
    }));
    const media = [...mediaIds].map(id => source.prepare('SELECT * FROM media WHERE id=?').get(id));
    assert.ok(media.every(Boolean));
    mkdirSync(join(site, 'uploads'), { recursive: true });
    for (const row of media) {
      assert.ok(safeMediaKey(row.storage_key));
      await db.insertInto('media').values(row).execute();
      const target = join(site, 'uploads', row.storage_key);
      mkdirSync(resolve(target, '..'), { recursive: true });
      copyFileSync(join('/var/lib/backroadbum/uploads', row.storage_key), target);
    }
    await db.insertInto('options').values({ name: 'emdash:site_url', value: JSON.stringify(ORIGIN) }).execute();
    const originals = FILES.map(([name, number]) => {
      const path = join('/etc/backroadbum/operator', name);
      assert.equal(statSync(path).mode & 0o777, 0o600);
      const bytes = readFileSync(path); assert.ok(bytes.length < 2 * 1024 * 1024);
      const storageState = JSON.parse(bytes);
      const origin = storageState.origins.filter(x => x.origin === ORIGIN);
      assert.equal(origin.length, 1);
      const retained = origin[0].localStorage.filter(x => x.name === 'dinkus.guest-checkout.v1');
      assert.equal(retained.length, 1);
      const retention = JSON.parse(retained[0].value);
      const order = orders.find(x => x.number === number); assert.ok(order);
      return { path, bytes, storageState, retention, number, order };
    });
    source.exec('ROLLBACK'); source.close(); source = null;
    await db.destroy(); db = null;
    stage = 'build actual merchant page and wrapper';
    mkdirSync(join(site, 'src/pages/api/checkout'), { recursive: true });
    mkdirSync(join(site, 'src/pages/checkout'), { recursive: true });
    writeFileSync(join(site, 'src/pages/api/checkout/status.ts'), `export { POST, prerender } from ${JSON.stringify(join(merchant, 'src/pages/api/checkout/status.ts'))};\n`);
    writeFileSync(join(site, 'src/pages/checkout/retained.astro'), `---\nimport Page from ${JSON.stringify(join(merchant, 'src/pages/checkout/retained.astro'))};\nAstro.response.headers.set('Cache-Control','no-store');\n---\n<Page />`);
    writeFileSync(join(site, 'src/pages/index.astro'), '<h1>Private offline qualification</h1>');
    symlinkSync(join(merchant, 'public'), join(site, 'public'), 'dir');
    writeFileSync(join(site, 'astro.config.mjs'), `
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import emdash, { local } from 'emdash/astro';
import { sqlite } from 'emdash/db';
import descriptor from ${JSON.stringify(pathToFileURL(join(candidate, 'dist/sandbox/index.mjs')).href)};
export default defineConfig({output:'server',adapter:node({mode:'standalone'}),trailingSlash:'never',
  ${storefront ? `srcDir:${JSON.stringify(join(merchant, 'src'))},` : ''}
  integrations:[react(),emdash({database:sqlite({url:${JSON.stringify(`file:${file}`)}}),
    storage:local({directory:${JSON.stringify(join(site, 'uploads'))},baseUrl:'/_emdash/api/media/file'}),
    siteUrl:${JSON.stringify(ORIGIN)},sandboxRunner:'@emdash-cms/sandbox-workerd/sandbox',
    sandboxed:[{...descriptor,id:${JSON.stringify(ID)},entrypoint:${JSON.stringify(join(candidate, 'dist/sandbox/plugin.mjs'))}}]})],
  vite:{define:{__DINKUS_COMMERCE_PROFILE__:JSON.stringify('stable')},resolve:{alias:${JSON.stringify(Object.fromEntries(['checkout', 'customers', 'orders', 'structured-data', 'feeds', 'store-policies'].map(name => [`@dinkuskit/commerce/features/${name}`, join(candidate, 'dist/features', name, 'index.js')]).concat([['@dinkuskit/commerce', join(candidate, 'dist/index.js')]])))}},server:{fs:{allow:[${JSON.stringify(PRIMARY)},${JSON.stringify(merchant)},${JSON.stringify(candidate)}]}}},devToolbar:{enabled:false}});
`);
    command('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(site, 'key.pem'), '-out', join(site, 'cert.pem'), '-days', '1', '-subj', '/CN=backroadbum.com', '-addext', 'subjectAltName=DNS:backroadbum.com']);
    const env = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_OPTIONS: '--max-old-space-size=1000', NODE_ENV: 'production',
      EMDASH_SITE_URL: ORIGIN, BACKROADBUM_MERCHANT_PROFILE: '1', BACKROADBUM_RECOVERY_PROTOCOL: 'cart-v1', BACKROADBUM_CHECKOUT_ENABLED: '1', HOST: '127.0.0.1', PORT: '4398',
      NO_PROXY: '*', no_proxy: '*' };
    const build = spawnSync(process.execPath, [join(PRIMARY, 'node_modules/astro/bin/astro.mjs'), 'build'], { cwd: site, env, encoding: 'utf8', timeout: 180_000 });
    if (artifacts) writeFileSync(join(artifacts, 'build.log'), (build.stdout ?? '') + (build.stderr ?? ''), { mode: 0o600 });
    assert.equal(build.status, 0);
    const launch = (enabled = '1') => {
      const serverEnv = { ...env, BACKROADBUM_CHECKOUT_ENABLED: enabled };
      const [file, args] = storefront ? isolatedServerCommand(site, serverEnv, join(site, 'dist/server/entry.mjs')) : [process.execPath, [join(site, 'dist/server/entry.mjs')]];
      return spawn(file, args, { cwd: site, detached: true, env: serverEnv, stdio: 'ignore' });
    };
    server = launch();
    stage = 'local HTTPS runtime';
    tls = createServer({ key: readFileSync(join(site, 'key.pem')), cert: readFileSync(join(site, 'cert.pem')) }, (request, response) => {
      const upstream = http.request({ hostname: '127.0.0.1', port: 4398, path: request.url, method: request.method,
        headers: { ...request.headers, host: 'backroadbum.com', 'x-forwarded-proto': 'https', 'x-forwarded-host': 'backroadbum.com',
          ...(storefront ? { 'x-backroadbum-client-ip': '192.0.2.10' } : {}) } }, result => {
        response.writeHead(result.statusCode, result.headers); result.pipe(response);
      });
      upstream.on('error', () => { response.writeHead(502); response.end('Not ready'); }); request.pipe(upstream);
    });
    await new Promise((done, fail) => { tls.once('error', fail); tls.listen(443, '127.0.0.1', done); });
    const ready = async () => {
      for (let i = 0; i < 120; i++) {
        try { const r = await fetch('http://127.0.0.1:4398/', { signal: AbortSignal.timeout(1000) }); if (r.ok) return; } catch {}
        assert.ok(i < 119); await pause(500);
      }
    };
    await ready();
    staged = new Database(file, { readonly: true });
    const business = () => digest(staged.prepare('SELECT collection,id,data,revision FROM _plugin_storage WHERE plugin_id=? ORDER BY collection,id').all(ID).filter(x => originalKeys.has(`${x.collection}:${x.id}`)));
    assert.equal(business(), baseline);
    stage = 'original-browser receipt recovery';
    browser = await chromium.launch({ args: ['--host-resolver-rules=MAP backroadbum.com 127.0.0.1', '--no-proxy-server'] });
    const reports = [];
    let paintedSnapshot = false;
    for (const original of originals) for (const width of [390, 1440]) for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, storageState: original.storageState, ignoreHTTPSErrors: true });
      const page = await context.newPage(); page.setDefaultTimeout(30_000);
      const writes = [], errors = [];
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== ORIGIN) return route.abort();
        if (request.method() === 'GET') return route.continue();
        writes.push(url.pathname);
        if (request.method() === 'POST' && url.pathname === '/api/checkout/status') return route.continue();
        return route.abort();
      });
      page.on('pageerror', () => errors.push('pageerror'));
      const response = await page.goto(ORIGIN + '/checkout/retained');
      assert.equal(response.status(), 200); assert.match(response.headers()['cache-control'], /no-store/);
      const before = await page.evaluate(() => ({ checkout: localStorage.getItem('dinkus.guest-checkout.v1'), cart: localStorage.getItem('dinkus.guest-cart.v1') }));
      assert.equal(JSON.parse(before.checkout).capability, original.retention.capability);
      assert.equal(writes.length, 0);
      await context.addCookies([{ name: 'dk_cart', value: 'offline-new-cart.untouched', url: ORIGIN, httpOnly: true, sameSite: 'Lax', secure: true }]);
      const statusResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/checkout/status' && response.request().method() === 'POST');
      await page.locator('[data-retained-check]').click();
      const received = await statusResponse;
      stage = `receipt HTTP ${received.status()}`;
      assert.equal(received.status(), 200);
      // The page's real protocol reader owns the response stream. Assert its
      // painted canonical order rather than adding a second CDP body consumer.
      stage = 'original-browser receipt recovery';
      const receipt = page.locator('[data-retained-order]');
      await expect(receipt).toBeVisible();
      const paid = original.order.paidOrder;
      await expect(receipt.locator('.guest-checkout-order-heading')).toContainText(paid.orderId.replace(/^order:/u, ''));
      const text = await receipt.innerText();
      assert.ok(text.includes(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(paid.total.minor) / 100)));
      assert.ok(text.includes(`${paid.lines[0].name} × ${paid.lines[0].quantity}`));
      const image = receipt.locator('img');
      await expect(image).toHaveCount(1);
      await expect(image).toHaveJSProperty('complete', true);
      assert.ok(await image.evaluate(x => x.naturalWidth > 0));
      await expect(receipt.locator('.guest-checkout-fulfillment')).toContainText('Completed');
      if (original.order.completed?.tracking) await expect(receipt.locator('.guest-checkout-fulfillment')).toContainText(original.order.completed.tracking);
      assert.deepEqual(await page.evaluate(() => ({ checkout: localStorage.getItem('dinkus.guest-checkout.v1'), cart: localStorage.getItem('dinkus.guest-cart.v1') })), before);
      assert.equal((await context.cookies()).find(x => x.name === 'dk_cart')?.value, 'offline-new-cart.untouched');
      await page.emulateMedia({ media: 'print' });
      await expect(receipt).toBeVisible(); await expect(image).toBeHidden(); await expect(page.locator('[data-retained-check]')).toBeHidden();
      await expect(receipt.locator('[data-guest-checkout-order-items]')).toBeVisible();
      await expect(receipt.locator('[data-guest-checkout-order-totals]')).toBeVisible();
      await page.emulateMedia({ media: 'screen' });
      if (artifacts && !paintedSnapshot && width === 1440 && colorScheme === 'light') {
        // Paint-only clone: remove all scripts and private receipt/contact/tracking
        // before writing anything. Actual browser assertions above use original facts.
        const html = await page.evaluate(() => {
          const copy = document.documentElement.cloneNode(true);
          copy.querySelectorAll('script').forEach(x => x.remove());
          copy.querySelector('.guest-checkout-order-heading h2').textContent = 'Earlier demo order';
          const destination = copy.querySelector('.guest-checkout-destination');
          if (destination) destination.innerHTML = '<h3>Shipping &amp; confirmation details</h3><p>Example shopper</p><p>Address withheld for review</p>';
          const fulfillment = copy.querySelector('.guest-checkout-fulfillment');
          if (fulfillment) fulfillment.innerHTML = '<h3>Order status</h3><p>Completed</p><p>Carrier: USPS</p><p>Tracking number: DEMO-TRACKING</p>';
          copy.querySelectorAll('[src]').forEach(x => { const src = x.getAttribute('src'); if (src.startsWith('https://backroadbum.com/')) x.setAttribute('src', src.slice('https://backroadbum.com'.length)); });
          copy.querySelector('head').insertAdjacentHTML('afterbegin', '<base href="http://127.0.0.1:4399/">');
          return '<!doctype html>' + copy.outerHTML;
        });
        for (const secret of [original.retention.capability, paid.orderId, paid.receiptId, paid.contactSnapshot?.contact?.email, original.order.completed?.tracking].filter(Boolean)) assert.ok(!html.includes(secret));
        writeFileSync(join(artifacts, 'redacted-painted.html'), html, { mode: 0o600 });
        paintedSnapshot = true;
      }
      const tab = await context.newPage(); await tab.goto(ORIGIN);
      await tab.evaluate(() => localStorage.removeItem('dinkus.guest-checkout.v1'));
      await expect(receipt).toBeHidden(); await expect(page.locator('[data-retained-status]')).toContainText('changed in another tab');
      await tab.close();
      assert.deepEqual([...new Set(writes)], ['/api/checkout/status']); assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(readFileSync(original.path), original.bytes);
      assert.equal(business(), baseline);
      reports.push({ order: `TEST${original.number}`, width, colorScheme, originalStateLoaded: true, sourceSandboxHTTP: true,
        frozenTotalAndItem: true, actualMediaLoaded: true, completionTrackingEqual: true, print: true,
        crossTabRevocation: true, originalFileUnchanged: true, newCartCookieUnchanged: true, onlyStatusPosts: true, noOverflow: true });
      await context.close();
    }
    let storefrontProof = null;
    if (storefront) {
      stage = 'whole storefront HTTPS';
      storefrontProof = await proveStorefrontHTTPS({ browser, expect, origin: ORIGIN,
        assertBusiness: () => assert.equal(business(), baseline), artifacts });
      stage = 'durable HTTPS admission';
      let limited;
      for (let i = 0; i < 9; i++) {
        limited = await localHTTPS('/cart/add');
        if (limited.status === 429) break;
        assert.equal(limited.status, 303);
      }
      assert.equal(limited.status, 429); assert.ok(Number(limited.headers['retry-after']) > 0);
      await stop(server); server = launch(); await ready();
      assert.equal((await localHTTPS('/cart/add')).status, 429);
      await stop(server); server = launch('0'); await ready();
      assert.equal((await localHTTPS('/cart/add')).status, 503);
      assert.equal((await localHTTPS('/checkout')).status, 503);
      const recovery = await browser.newContext({ storageState: originals[1].storageState, ignoreHTTPSErrors: true });
      const page = await recovery.newPage();
      await page.goto(ORIGIN + '/checkout/retained');
      await page.locator('[data-retained-check]').click();
      await expect(page.locator('[data-retained-order]')).toBeVisible();
      assert.equal(business(), baseline); await recovery.close();
      storefrontProof.push({ durable429: true, positiveRetryAfter: true, restartKeepsBudget: true,
        pauseRefusesCartAndCheckout: true, pausedOriginalReceiptRecovers: true,
        limiterStateAndKey: 'disposable private mount namespace; real production directories hidden' });
    }
    await browser.close(); browser = null;
    assert.equal(business(), baseline);
    const addedRecords = staged.prepare('SELECT collection,id FROM _plugin_storage WHERE plugin_id=?').all(ID).filter(x => !originalKeys.has(`${x.collection}:${x.id}`));
    assert.ok(addedRecords.every(x => storefront && ['checkout_carts', 'checkout_guest_capabilities'].includes(x.collection)));
    staged.close(); staged = null;
    let audit = null;
    if (artifacts && paintedSnapshot) {
      stage = 'redacted painted audit';
      // A loopback HTTP asset proxy avoids granting the audit browser trust in the
      // temporary certificate. Only already-public media/styles/fonts are requested.
      assets = http.createServer((request, response) => {
        const upstream = http.request({ hostname: '127.0.0.1', port: 4398, path: request.url, method: 'GET', headers: { host: 'backroadbum.com' } }, result => {
          response.writeHead(result.statusCode, { ...result.headers, 'access-control-allow-origin': '*' }); result.pipe(response);
        });
        upstream.on('error', () => { response.writeHead(502); response.end(); }); upstream.end();
      });
      await new Promise((done, fail) => { assets.once('error', fail); assets.listen(4399, '127.0.0.1', done); });
      const checked = await new Promise((done, fail) => {
        const child = spawn(process.execPath, ['/var/lib/trialrun/workspace/.pi/skills/ui-design/scripts/audit-dom.mjs', join(artifacts, 'redacted-painted.html'), '--screenshots', join(artifacts, 'audit')], {
          detached: true, stdio: ['ignore', 'pipe', 'ignore'], env: { PATH: process.env.PATH, HOME: process.env.HOME } });
        let stdout = '';
        child.stdout.on('data', chunk => { stdout += chunk; });
        const timer = setTimeout(() => { void stop(child); }, 120_000);
        child.on('error', error => { clearTimeout(timer); fail(error); });
        child.on('exit', status => { clearTimeout(timer); done({ status, stdout }); });
      });
      writeFileSync(join(artifacts, 'audit.md'), checked.stdout ?? '', { mode: 0o600 });
      assert.equal(checked.status, 0);
      assert.match(checked.stdout, /0 error\(s\), 0 warning\(s\)/);
      if (storefront) for (const surface of ['cart', 'checkout']) {
        const result = await new Promise((done, fail) => {
          const child = spawn(process.execPath, ['/var/lib/trialrun/workspace/.pi/skills/ui-design/scripts/audit-dom.mjs', join(artifacts, `${surface}-painted.html`), '--screenshots', join(artifacts, `${surface}-audit`)], {
            detached: true, stdio: ['ignore', 'pipe', 'ignore'], env: { PATH: process.env.PATH, HOME: process.env.HOME } });
          let stdout = ''; child.stdout.on('data', chunk => { stdout += chunk; });
          const timer = setTimeout(() => { void stop(child); }, 120_000);
          child.on('error', error => { clearTimeout(timer); fail(error); });
          child.on('exit', status => { clearTimeout(timer); done({ status, stdout }); });
        });
        writeFileSync(join(artifacts, `${surface}-audit.md`), result.stdout, { mode: 0o600 });
        assert.equal(result.status, 0); assert.match(result.stdout, /0 error\(s\), 0 warning\(s\)/);
      }
      audit = 'painted DOM clones: 390/1440 Light/Dark clean; actual facts asserted before cloning';
    }
    return { checkedAt: new Date().toISOString(), candidate: head, candidateBundleSHA256: createHash('sha256').update(readFileSync(join(candidate, 'dist/sandbox/plugin.mjs'))).digest('hex'),
      scope: storefront ? 'All merchant src routes/middleware + selected published CMS/catalog/orders + original saved states; source sandbox on isolated local canonical HTTPS, not production configuration' : 'Actual merchant row subset + original browser state + source-built sandbox + merchant page/wrapper; isolated local canonical HTTPS',
      copiedCollections: COLLECTIONS, mediaFiles: media.length, canonicalOrders: orders.length, hostedConsentsCopied: false,
      paymentsMounted: false, network: 'loopback-only namespace; canonical hostname resolved locally', businessUnchanged: true,
      signedInstallation: false, appliedUpgrade: false, paintedAudit: audit, contexts: reports, contentCounts, storefrontProof,
      newRecordsOnlyCartCapabilities: true };
  } catch (error) {
    const line = /qualify-backroadbum-installed-retained\.mjs:(\d+):\d+/.exec(error.stack ?? '')?.[1] ?? 'unknown';
    const category = ['AssertionError', 'SyntaxError', 'TypeError', 'Error'].includes(error.name) ? error.name : 'Error';
    const protocol = /Protocol error/.test(error.message ?? '') ? '; browser protocol' : '';
    const helperLine = /storefront-https-proof\.mjs:(\d+):\d+/.exec(error.stack ?? '')?.[1];
    if (/^Public schema [a-z_]+ column [a-z_]+$/.test(error.message)) stage += `; ${error.message}`;
    const safeCode = typeof error.code === 'string' && /^[A-Z_0-9]+$/.test(error.code) ? `; ${error.code}` : '';
    throw new Error(`Private installed recovery failed at ${stage} (checker line ${line}; ${category}${protocol}${safeCode}${helperLine ? `; helper line ${helperLine}` : ''})`);
  } finally {
    await browser?.close();
    if (assets) await new Promise(done => assets.close(done));
    if (tls) await new Promise(done => tls.close(done));
    await stop(server);
    staged?.close();
    if (source?.open) { try { source.exec('ROLLBACK'); } catch {} source.close(); }
    await db?.destroy();
    if (site) rmSync(site, { recursive: true, force: true });
    if (linkedPeers) rmSync(linkedPeers);
    process.umask(originalUmask);
  }
}

if (import.meta.main) {
  try {
    const input = options(process.argv.slice(2));
    if (input) console.log(JSON.stringify(await qualify(input), null, 2));
    else console.log('No action. Private operator check requires --check --candidate=<built beta2> in a loopback-only network namespace.');
  } catch (error) { console.error(error.message.startsWith('Private installed') ? error.message : 'Invalid check arguments or missing isolation'); process.exitCode = 1; }
}
