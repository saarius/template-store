#!/usr/bin/env node
/**
 * Private operator check: actual merchant storage + original retained capabilities.
 * READ ONLY. No snapshot file, server, Payments host, mail, or network transport.
 * Source-kernel read compatibility, NOT a signed Registry upgrade or browser test.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MERCHANT = '/var/lib/trialrun/workspace/repos/template-store';
const DATABASE = '/var/lib/backroadbum/content.db';
const OPERATOR = '/etc/backroadbum/operator';
const ID = 'r_gshdrqaldna3r7sn';
const ORIGIN = 'https://backroadbum.com';
const BROWSERS = [['field-book-test-browser.json', 1009], ['shopper-email-test-browser.json', 1010]];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function options(args) {
  if (!args.length) return null;
  assert.equal(args.length, 2, 'Use --check --candidate=<built clean Commerce beta.2 checkout>');
  assert.equal(args.filter(x => x === '--check').length, 1, 'Explicit --check required');
  const candidate = args.find(x => x.startsWith('--candidate='))?.slice(12);
  assert.ok(candidate, 'Only a source checkout argument is accepted');
  return { candidate: resolve(candidate) };
}

export function retainedCapability(state) {
  const stores = state?.origins?.filter(x => x.origin === ORIGIN);
  assert.equal(stores?.length, 1, 'Expected one canonical browser origin');
  const rows = stores[0].localStorage?.filter(x => x.name === 'dinkus.guest-checkout.v1');
  assert.equal(rows?.length, 1, 'Expected one retained checkout');
  const kept = JSON.parse(rows[0].value);
  assert.ok(typeof kept.capability === 'string' && kept.capability.startsWith(`${kept.capabilityId}.`) && kept.attemptId);
  return kept;
}

/** A method allowlist also catches attempted writes before SQLite's read-only guard. */
export function readOnlyCollection(repository, counters) {
  const reads = new Set(['get', 'getVersioned', 'query', 'getMany']);
  return new Proxy(repository, { get(target, property) {
    if (reads.has(property)) return target[property]?.bind(target);
    return () => { counters.writes++; throw new Error('Read-only qualification refuses this operation'); };
  } });
}

export async function qualify({ candidate }) {
  let stage = 'source admission';
  let db;
  let raw;
  const counters = { writes: 0, network: 0 };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { counters.network++; throw new Error('Network forbidden'); };
  try {
    const git = (...args) => {
      const result = spawnSync('git', ['-C', candidate, ...args], { encoding: 'utf8' });
      assert.equal(result.status, 0);
      return result.stdout.trim();
    };
    assert.equal(git('status', '--porcelain'), '');
    const head = git('rev-parse', 'HEAD');
    assert.equal(head, git('rev-parse', 'v0.9.0-beta.2^{commit}'), 'This check currently qualifies exact beta.2 only');
    const load = path => import(pathToFileURL(join(candidate, path)).href);
    const checkout = await load('dist/features/checkout/index.js');
    const { createPaidOrderReceiver } = await load('dist/features/orders/index.js');
    const { resolveCatalogItemPrice, resolveCatalogVariantMember, variantSelections } = await load('dist/features/catalog/kernel/index.js');
    const { quoteCatalogBasket, resolveStorefrontAvailability } = await load('dist/features/storefront-availability/kernel/index.js');
    const require = createRequire(join(MERCHANT, 'package.json'));
    const { Kysely, SqliteDialect } = await import(pathToFileURL(require.resolve('kysely')).href);
    const { PluginStorageRepository } = await import(pathToFileURL(require.resolve('emdash')).href);
    const Database = require('better-sqlite3');
    stage = 'read-only merchant transaction';
    raw = new Database(DATABASE, { readonly: true, fileMustExist: true });
    raw.pragma('query_only = ON');
    raw.exec('BEGIN');
    db = new Kysely({ dialect: new SqliteDialect({ database: raw }) });
    const rows = () => raw.prepare('SELECT collection,id,data,revision FROM _plugin_storage WHERE plugin_id=? ORDER BY collection,id').all(ID);
    const initial = rows();
    const baseline = hash(initial);
    const records = name => initial.filter(row => row.collection === name).map(row => JSON.parse(row.data));
    const storage = Object.fromEntries([...new Set([...initial.map(row => row.collection), ...Object.values(checkout.SANDBOX_GUEST_CHECKOUT_STORAGE)])]
      .map(name => [name, readOnlyCollection(new PluginStorageRepository(db, ID, name, []), counters)]));
    const paidOrders = createPaidOrderReceiver(storage.orders, storage.order_numbers);
    // No provider host is bound. A cart read cannot reconcile with hosted Payments.
    const runtime = checkout.bindGuestCheckoutRuntime(storage, checkout.SANDBOX_GUEST_CHECKOUT_STORAGE,
      { runtimeSiteUrl: ORIGIN, host: {}, paidOrders });
    stage = 'ten canonical Orders and frozen attempts';
    const orders = records('orders').sort((a, b) => a.number - b.number);
    assert.equal(orders.length, 10);
    assert.deepEqual(orders.map(x => x.number), Array.from({ length: 10 }, (_, i) => 1001 + i));
    const attempts = records('checkout_carts').flatMap(row => row.attempts);
    const orderReport = [];
    for (const record of orders) {
      const order = record.paidOrder;
      assert.equal(order.mode, 'test');
      assert.equal(await paidOrders.receive(order), 'duplicate');
      const matches = attempts.filter(x => x.order?.orderId === order.orderId);
      assert.equal(matches.length, 1);
      // Checkout keeps the order facts; Orders adds its handoff schema.
      const { schema, ...frozenFacts } = order;
      assert.equal(schema, 'dinkuskit.commerce.paid-order/v1');
      assert.deepEqual(matches[0].order, frozenFacts);
      const projected = checkout.projectGuestCheckout(matches[0], Date.now() / 1000);
      assert.equal(projected.state, 'paid');
      for (const key of ['orderId', 'receiptId', 'total']) assert.deepEqual(projected.order[key], order[key]);
      assert.deepEqual(projected.order.lines, order.lines.map(({ catalogItemId, name, quantity, unitPrice }) => ({ catalogItemId, name, quantity, unitPrice })));
      assert.deepEqual(projected.order.contact, order.contactSnapshot?.contact);
      assert.deepEqual(await paidOrders.status(order.orderId), { status: record.completed ? 'completed' : 'processing', completed: record.completed ?? null });
      orderReport.push({ number: `TEST${record.number}`, canonicalFactsEqual: true, duplicateHandoff: true, status: record.completed ? 'completed' : 'processing' });
    }
    stage = 'actual catalog price, stock and size resolution';
    const items = records('catalog_items').filter(x => x.recordKind === 'catalog-item');
    assert.equal(items.length, 11);
    const catalogReport = [];
    for (const item of items) {
      const resolved = await resolveCatalogVariantMember(runtime.catalog.catalog, item.itemId);
      assert.ok(resolved);
      const price = await resolveCatalogItemPrice(runtime.catalog.prices, item.itemId, runtime.catalog.catalog);
      assert.equal(price.listable, true);
      const availability = await resolveStorefrontAvailability(runtime.catalog, { catalogItemId: item.itemId }, {});
      const quote = await quoteCatalogBasket(runtime.catalog, [item.itemId], {});
      assert.equal(quote.ok, availability.sellable);
      if (quote.ok) {
        assert.deepEqual(quote.lines[0].unitPrice, price.customerPays);
        assert.equal(quote.lines[0].fulfillment, 'physical');
        if (resolved.product && resolved.member) assert.deepEqual(quote.lines[0].variant.selections, variantSelections(resolved.product, resolved.member));
      }
      catalogReport.push({ sku: item.sku, name: item.name, regular: price.regular, sale: price.sale ?? null,
        effective: price.customerPays, availability: availability.status, sellable: availability.sellable,
        selections: resolved.product && resolved.member ? variantSelections(resolved.product, resolved.member) : [] });
    }
    assert.equal(new Set(catalogReport.map(x => x.sku)).size, 11, 'Actual SKUs, never fixture aliases');
    assert.deepEqual(catalogReport.filter(x => x.availability === 'out-of-stock').map(x => x.sku), ['BRB-TEE-XL']);
    assert.deepEqual(catalogReport.filter(x => x.availability === 'available-on-backorder').map(x => x.sku).sort(), ['BRB-FLEECE-XL', 'BRB-TOTE-NATURAL']);
    for (const family of ['BRB-TEE', 'BRB-FLEECE']) {
      const sizes = catalogReport.filter(x => x.sku.startsWith(`${family}-`));
      assert.equal(sizes.length, 3);
      for (const size of sizes) {
        assert.equal(size.selections.length, 1);
        assert.equal(size.selections[0].optionLabel, 'Size');
        assert.equal(size.selections[0].valueLabel, size.sku.slice(family.length + 1));
      }
    }
    const sale = catalogReport.filter(x => x.sale);
    assert.equal(sale.length, 3);
    for (const [sku, regular, effective] of [['BRB-BANDANA', '1600', '1400'], ['BRB-MUG-BLUE', '2200', '1800'], ['BRB-CAP-OCHRE', '2800', '2400']]) {
      const price = sale.find(x => x.sku === sku);
      assert.deepEqual(price?.regular, { currency: 'USD', minor: regular });
      assert.deepEqual(price?.sale, { currency: 'USD', minor: effective });
    }
    stage = 'original private browser capabilities';
    const browserReport = [];
    for (const [name, number] of BROWSERS) {
      const file = join(OPERATOR, name);
      const stat = statSync(file);
      assert.equal(stat.mode & 0o777, 0o600);
      assert.ok(stat.size < 2 * 1024 * 1024);
      const bytes = readFileSync(file);
      const kept = retainedCapability(JSON.parse(bytes));
      const headers = { 'x-commerce-guest-capability': kept.capability };
      const read = await checkout.cartGuestCheckout(runtime, {}, headers);
      assert.equal(read.ok, true);
      const record = orders.find(x => x.number === number);
      assert.equal(read.checkout.attemptId, kept.attemptId);
      assert.equal(read.checkout.state, 'paid');
      assert.equal(read.checkout.order.orderId, record.paidOrder.orderId);
      assert.deepEqual(read.checkout.order.total, record.paidOrder.total);
      assert.deepEqual(read.checkout.order.contact, record.paidOrder.contactSnapshot?.contact);
      assert.deepEqual(read.checkout.order.completed, record.completed ?? null);
      assert.equal(read.checkout.order.status, record.completed ? 'completed' : 'processing');
      assert.deepEqual(read.cart.lines, []);
      const forged = await checkout.cartGuestCheckout(runtime, {}, { 'x-commerce-guest-capability': `${kept.capabilityId}.wrong` });
      assert.equal(forged.error?.code, 'CAPABILITY_DENIED');
      const foreignRuntime = { ...runtime, runtimeSiteUrl: 'https://foreign.example.test' };
      const foreign = await checkout.cartGuestCheckout(foreignRuntime, {}, headers);
      assert.equal(foreign.error?.code, 'CAPABILITY_DENIED');
      const mutation = await checkout.cartGuestCheckout(runtime, { lines: [], version: read.cart.version }, headers);
      assert.equal(mutation.error?.code, 'CHECKOUT_FROZEN');
      assert.deepEqual(readFileSync(file), bytes);
      browserReport.push({ number: `TEST${number}`, originalCapabilityAccepted: true, sameAttemptAndOrder: true,
        frozenTotalAndContactEqual: true, currentFulfillmentEqual: true, forgedAndForeignRefused: true,
        mutationFrozen: true, originalFileUnchanged: true });
    }
    stage = 'preservation';
    assert.equal(hash(rows()), baseline);
    assert.deepEqual(counters, { writes: 0, network: 0 });
    return { checkedAt: new Date().toISOString(), candidate: head, kind: 'actual-merchant-read-only-source-kernel',
      paymentsHostBound: false, signedRegistryUpgrade: false, browserRuntimeTest: false, sourceTransactionUnchanged: true,
      businessDigest: baseline, counters, orders: orderReport, catalog: catalogReport, retained: browserReport,
      limitations: ['No installed Registry or database upgrade', 'No browser rendering or receipt recovery HTTP request',
        'No hosted Payments, mail or Ship calls', 'Guest canonical number and test-mode fields still absent (Commerce283)'] };
  } catch (error) {
    // Only the checker line number is diagnostic; never print assertion values,
    // stored records, capabilities, contacts, or a dependency exception message.
    const line = /qualify-backroadbum-retained-storage\.mjs:(\d+):\d+/.exec(error.stack ?? '')?.[1] ?? 'unknown';
    throw new Error(`Merchant read-only qualification failed at: ${stage} (checker line ${line})`);
  } finally {
    globalThis.fetch = originalFetch;
    if (raw?.open) { try { raw.exec('ROLLBACK'); } catch {} }
    if (db) await db.destroy();
    else if (raw?.open) raw.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    const parsed = options(process.argv.slice(2));
    if (!parsed) console.log('Read-only private merchant check. Use --check --candidate=<exact built beta.2 checkout>.');
    else console.log(JSON.stringify(await qualify(parsed), null, 2));
  } catch (error) { console.error(error.message.startsWith('Merchant read-only') ? error.message : 'Invalid check arguments or unavailable source'); process.exitCode = 1; }
}
