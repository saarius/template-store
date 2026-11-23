/** Operator-only source qualification helpers. No production writes or outbound requests. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { request as httpsRequest } from 'node:https';

export async function localHTTPS(path, { origin = 'https://backroadbum.com', method = 'POST', body = 'id=unused&quantity=1', headers = {} } = {}) {
  return new Promise((done, fail) => {
    const request = httpsRequest({ hostname: '127.0.0.1', port: 443, path, method, rejectUnauthorized: false,
      headers: { host: 'backroadbum.com', origin, 'content-type': 'application/x-www-form-urlencoded', ...headers } }, response => {
      response.resume(); response.on('end', () => done({ status: response.statusCode, headers: response.headers }));
    });
    request.setTimeout(10_000, () => request.destroy(new Error('Local HTTPS timed out')));
    request.on('error', fail); request.end(body);
  });
}

export const PUBLIC_CONTENT_TABLES = ['ec_products', 'ec_categories', 'ec_pages'];
// Block schemas are metadata, not content revisions or merchant configuration.
// Omitting them makes EmDash's manifest drop every collection when a blocks
// field refers to a missing type, even though public content queries still work.
const METADATA = ['_emdash_collections', '_emdash_fields', '_emdash_block_types', '_emdash_block_type_versions', 'content_taxonomies', 'taxonomies', '_emdash_taxonomy_defs'];
const PUBLIC_OPTIONS = ['dinkus:storefront-upgrades', 'emdash:seed_complete', 'emdash:setup_complete', 'site:tagline', 'site:title'];

/** Preserve native collection membership only between the public rows we copied.
 * Relations point at translation groups, not slugs or author identities.
 */
export async function copyPublicProductMembership(source, db) {
  const relations = source.prepare(`SELECT * FROM _emdash_relations
    WHERE slug='product_categories' AND parent_collection='categories' AND child_collection='products'`).all();
  const references = source.prepare(`SELECT reference.* FROM _emdash_content_references AS reference
    JOIN _emdash_relations AS relation ON relation.id=reference.relation_id
    WHERE relation.slug='product_categories' AND relation.parent_collection='categories' AND relation.child_collection='products'
    AND EXISTS (SELECT 1 FROM ec_categories AS category
      WHERE coalesce(category.translation_group,category.id)=reference.parent_group
      AND category.status='published' AND category.deleted_at IS NULL)
    AND EXISTS (SELECT 1 FROM ec_products AS product
      WHERE coalesce(product.translation_group,product.id)=reference.child_group
      AND product.status='published' AND product.deleted_at IS NULL)`).all();
  for (const [table, rows] of [['_emdash_relations', relations], ['_emdash_content_references', references]]) {
    for (const row of rows) await db.insertInto(table).values(row).onConflict(oc => oc.doNothing()).execute();
  }
  return { _emdash_relations: relations.length, _emdash_content_references: references.length };
}

export async function copyPublicContent(source, db, sql) {
  const counts = {};
  for (const table of [...METADATA, ...PUBLIC_CONTENT_TABLES]) {
    if (PUBLIC_CONTENT_TABLES.includes(table)) {
      const schema = source.prepare('SELECT sql FROM sqlite_master WHERE type=\'table\' AND name=?').get(table);
      assert.ok(schema?.sql);
      await sql.raw(schema.sql).execute(db);
    }
    const rows = source.prepare(`SELECT * FROM ${table}${PUBLIC_CONTENT_TABLES.includes(table) ? " WHERE status='published' AND deleted_at IS NULL" : ''}`).all();
    // Content authors are not copied: this is a public read surface, not an admin clone.
    for (const row of rows) {
      if ('author_id' in row) row.author_id = null;
      if ('primary_byline_id' in row) row.primary_byline_id = null;
      if ('live_revision_id' in row) row.live_revision_id = null;
      if ('draft_revision_id' in row) row.draft_revision_id = null;
      try { await db.insertInto(table).values(row).onConflict(oc => oc.doNothing()).execute(); }
      catch (error) {
        // Only fixed public schema identifiers, never statement values.
        const column = /(?:column named|column:) ([a-z_]+)/i.exec(error.message)?.[1] ?? 'unknown';
        throw new Error(`Public schema ${table} column ${column}`, { cause: error });
      }
    }
    counts[table] = rows.length;
  }
  Object.assign(counts, await copyPublicProductMembership(source, db));
  for (const name of PUBLIC_OPTIONS) {
    const row = source.prepare('SELECT * FROM options WHERE name=?').get(name);
    if (row) await db.insertInto('options').values(row).onConflict(oc => oc.column('name').doUpdateSet({ value: row.value })).execute();
  }
  return counts;
}

/** Hide BOTH operational directories in the server's private mount namespace.
 * The real limiter's hardcoded db/key paths cannot touch serving state or secrets.
 * Parent checker still holds only its read-only production snapshot connection.
 */
export function isolatedServerCommand(site, env, entry) {
  mkdirSync(join(site, 'host-state'), { recursive: true });
  mkdirSync(join(site, 'host-config'), { recursive: true });
  if (!existsSync(join(site, 'host-config/admission.key'))) writeFileSync(join(site, 'host-config/admission.key'), randomBytes(32), { mode: 0o600 });
  return ['sudo', ['-n', 'unshare', '--mount', '--propagation', 'private', 'bash', '-euc',
    'mount --bind "$1/host-state" /var/lib/backroadbum; mount --bind "$1/host-config" /etc/backroadbum; test ! -e /var/lib/backroadbum/content.db; test ! -e /etc/backroadbum/stripe.env; shift; exec setpriv --reuid=agent --regid=agent --init-groups env -i "$@"',
    '--', site, ...Object.entries(env).map(([key, value]) => `${key}=${value}`), process.execPath, entry]];
}

async function savePainted(page, path) {
  const html = await page.evaluate(() => {
    const copy = document.documentElement.cloneNode(true);
    copy.querySelectorAll('script').forEach(x => x.remove());
    copy.querySelectorAll('[src]').forEach(x => { const src = x.getAttribute('src'); if (src.startsWith('https://backroadbum.com/')) x.setAttribute('src', src.slice('https://backroadbum.com'.length)); });
    copy.querySelector('head').insertAdjacentHTML('afterbegin', '<base href="http://127.0.0.1:4399/">');
    return '<!doctype html>' + copy.outerHTML;
  });
  writeFileSync(path, html, { mode: 0o600 });
}

export async function proveStorefrontHTTPS({ browser, expect, origin, assertBusiness, artifacts }) {
  const reports = [];
  for (const javaScriptEnabled of [false, true]) {
    const context = await browser.newContext({ javaScriptEnabled, ignoreHTTPSErrors: true, viewport: { width: javaScriptEnabled ? 390 : 1440, height: 900 }, colorScheme: javaScriptEnabled ? 'dark' : 'light' });
    const page = await context.newPage(); page.setDefaultTimeout(20_000);
    const errors = []; page.on('pageerror', () => errors.push('pageerror'));
    // Browser fetch uses Chromium's canonical hostname map; APIRequestContext
    // would use the intentionally unavailable external DNS in this namespace.
    const request = async (path, method = 'GET', form, headers = {}) => {
      const responseEvent = page.waitForResponse(r => new URL(r.url()).pathname === path && r.request().method() === method);
      const body = await page.evaluate(async ({ path, method, form, headers }) => {
        const response = await fetch(path, { method, headers, ...(form ? { body: new URLSearchParams(form) } : {}) });
        return response.headers.get('content-type')?.includes('application/json') ? response.json() : null;
      }, { path, method, form, headers });
      const response = await responseEvent;
      return { status: () => response.status(), headers: () => response.headers(), json: async () => body };
    };
    const get = path => request(path);
    const post = (path, form, headers = {}) => request(path, 'POST', form, headers);
    // The full storefront, including the actual middleware, runs in this lane.
    for (const path of ['/', '/shop', '/products/creekside-camp-mug', '/field-notes', '/dashboard/', '/account']) {
      const response = await page.goto(origin + path);
      assert.equal(response.status(), 200, `Public route ${path}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    const feed = await (await get('/feeds/agent-catalog.json')).json();
    assert.equal(feed.products.length, 7);
    await page.goto(origin + '/products/creekside-camp-mug');
    const form = page.locator('form[action="/cart/add"]');
    await expect(form).toBeVisible();
    const id = await form.locator('[name="id"]').inputValue();
    assert.equal((await localHTTPS('/cart/add', { origin: 'https://foreign.invalid' })).status, 403);
    await form.locator('[name="quantity"]').fill('2');
    const addedEvent = page.waitForResponse(r => new URL(r.url()).pathname === (javaScriptEnabled ? '/cart/add.js' : '/cart/add') && r.request().method() === 'POST');
    await form.locator('[type="submit"]').click();
    const added = await addedEvent;
    assert.equal(added.status(), javaScriptEnabled ? 200 : 303);
    assert.match(added.headers()['cache-control'], /no-store/);
    if (javaScriptEnabled) await expect(page.locator('[data-add-to-cart-status]')).toHaveText('Added to your cart.');
    else await page.waitForURL('**/cart?added=2');
    const cookie = (await context.cookies()).find(x => x.name === 'dk_cart');
    assert.ok(cookie?.httpOnly && cookie.secure && cookie.sameSite === 'Lax');
    await page.goto(origin + '/cart');
    await expect(page.locator('main')).toContainText('Creekside Camp Mug');
    const cart = await (await get('/cart.js')).json();
    assert.equal(cart.cart.lines.length, 1); assert.equal(cart.cart.lines[0].quantity, 2);
    await expect(page.locator('main')).toContainText('$36.00');
    await page.locator('[data-guest-cart-qty]').fill('3');
    const changed = page.waitForResponse(r => new URL(r.url()).pathname === '/cart/change' && r.request().method() === 'POST');
    await page.locator('[data-guest-cart-update]').click();
    assert.equal((await changed).status(), 303);
    await expect(page.locator('[data-guest-cart-subtotal-amount]')).toHaveText('$54.00');
    await page.reload();
    await expect(page.locator('[data-guest-cart-qty]')).toHaveValue('3');
    const before = JSON.stringify(await (await get('/cart.js')).json());
    if (artifacts) await savePainted(page, join(artifacts, 'cart-painted.html'));
    const invalid = await post('/cart/change', { id, quantity: '' });
    assert.equal(invalid.status(), 303);
    assert.match(invalid.headers().location, /INVALID_CART/);
    assert.equal(JSON.stringify(await (await get('/cart.js')).json()), before);
    // A second browser has no authority over the first browser's cart.
    const foreign = await browser.newContext({ ignoreHTTPSErrors: true });
    const foreignPage = await foreign.newPage();
    await foreignPage.goto(origin + '/cart.js');
    assert.equal((await foreignPage.evaluate(() => JSON.parse(document.body.innerText))).cart.lines.length, 0);
    await foreign.close();
    await page.goto(origin + '/checkout');
    await expect(page.locator('main')).toContainText('Creekside Camp Mug');
    // No Payments or hosted consents were copied. It must remain unavailable.
    await expect(page.locator('main')).toContainText(/unavailable|not available/i);
    if (artifacts) {
      await page.screenshot({ path: join(artifacts, `checkout-${javaScriptEnabled ? 'mobile-dark' : 'desktop-light'}.png`), fullPage: true });
      await savePainted(page, join(artifacts, 'checkout-painted.html'));
    }
    assert.deepEqual(errors, []);
    assertBusiness();
    reports.push({ javaScriptEnabled, canonicalHTTPS: true, fullStorefront: true, families: 7, mugSubtotalAtThree: '$54.00', secureHttpOnlyCookie: true, foreignOriginRefused: true, realAddAndChangeForms: true, reloadQuantity: 3, blankQuantityPreserved: true, foreignBrowserIsolated: true, unavailableWithoutPayments: true });
    await context.close();
  }
  return reports;
}
