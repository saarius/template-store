#!/usr/bin/env node
/**
 * Public catalog projection -> disposable source-kernel server-cart qualification.
 * NOT a database migration, signed Registry installation, or hosted payment test.
 * Only the fixed anonymous merchant endpoint is fetched; all writes are local fixtures.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PUBLIC_CATALOG_URL = 'https://backroadbum.com/_emdash/api/plugins/r_gshdrqaldna3r7sn/catalog/public';
const MAX_BYTES = 512 * 1024;

export function options(args) {
  if (!args.length) return null;
  assert.equal(args.length, 2, 'Use --check --candidate=<built clean Commerce source checkout>');
  assert.equal(args.filter(x => x === '--check').length, 1, 'Explicit --check required');
  const candidate = args.find(x => x.startsWith('--candidate='))?.slice(12);
  assert.ok(candidate, 'Candidate source checkout required; no database, URL or capability arguments accepted');
  return { candidate: resolve(candidate) };
}

/** Public data is intentionally not a lossless catalog export. Do not infer missing purchase facts. */
export function projectPublicCatalog(body) {
  assert.equal(body?.success, true, 'Catalog request unsuccessful');
  assert.ok(Array.isArray(body.data?.products) && body.data.products.length > 0, 'No public catalog products');
  const ids = new Set();
  let aliases = 0;
  const products = body.data.products.map(product => {
    assert.equal(typeof product.name, 'string');
    assert.ok(product.id && product.sku);
    const variants = product.variants;
    assert.equal(variants?.productId, product.id);
    assert.ok(Array.isArray(variants.options) && variants.options.length <= 1, 'Fixture supports zero or one option, never silently drops extra dimensions');
    assert.ok(Array.isArray(variants.members) && variants.members.length > 0);
    const members = variants.members.map(member => {
      assert.ok(typeof member.catalogItemId === 'string' && !ids.has(member.catalogItemId), 'Duplicate/missing item identity');
      ids.add(member.catalogItemId);
      assert.equal(member.price?.currency, 'USD');
      assert.match(member.price.minor, /^(0|[1-9][0-9]*)$/);
      assert.ok(Number.isSafeInteger(Number(member.price.minor)), 'Unsafe price');
      assert.ok(['in-stock', 'out-of-stock', 'available-on-backorder'].includes(member.availability?.status));
      assert.equal(member.availability.sellable, member.availability.status !== 'out-of-stock');
      assert.equal(member.fulfillment, 'physical');
      assert.equal(member.selections?.length, variants.options.length);
      for (const selection of member.selections) {
        const option = variants.options.find(x => x.optionId === selection.optionId);
        assert.equal(option?.label, selection.optionLabel);
        assert.equal(option?.values.find(x => x.valueId === selection.valueId)?.label, selection.valueLabel);
      }
      // Signed 0.8 lacks child SKUs. Aliases are conspicuous test-only placeholders,
      // never a family SKU borrowed for a sibling or an asserted merchant fact.
      const sku = member.sku ?? (member.catalogItemId === product.id ? product.sku : null);
      if (!sku) aliases++;
      return { ...member, sku: sku ?? `FIXTURE-ONLY-${member.catalogItemId}` };
    });
    assert.equal(members[0].catalogItemId, product.id, 'Default identity must be retained');
    return { id: product.id, name: product.name, options: variants.options, members };
  });
  return { products, aliases };
}

export async function readPublicSnapshot(fetcher = fetch) {
  const response = await fetcher(PUBLIC_CATALOG_URL, {
    redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { accept: 'application/json' },
  });
  assert.equal(response.status, 200, 'Public catalog unavailable');
  assert.match(response.headers.get('content-type') ?? '', /application\/json/i);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      assert.ok(size <= MAX_BYTES, 'Public snapshot exceeds fixture limit');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  const text = Buffer.concat(chunks).toString('utf8');
  const projection = projectPublicCatalog(JSON.parse(text));
  return { ...projection, sha256: createHash('sha256').update(text).digest('hex') };
}

export async function qualify({ candidate }, fetcher = fetch) {
  const git = (...args) => {
    const result = spawnSync('git', ['-C', candidate, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, 'Source identity unavailable');
    return result.stdout.trim();
  };
  assert.equal(git('status', '--porcelain'), '', 'Candidate must be unchanged');
  const head = git('rev-parse', 'HEAD');
  const snapshot = await readPublicSnapshot(fetcher);
  const load = path => import(pathToFileURL(join(candidate, path)).href);
  const checkout = await load('dist/features/checkout/index.js');
  const kernel = await load('dist/features/catalog/kernel/index.js');
  const { initializeGuestCheckoutDatabase, openGuestCollections, syntheticCheckoutHost } =
    await load('tests/features/checkout/guest-dispatch.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'brb-public-catalog-cart-'));
  let opened;
  try {
    const file = join(directory, 'fixture.sqlite');
    initializeGuestCheckoutDatabase(file);
    opened = openGuestCollections(file);
    const s = opened.storage;
    const require = createRequire(join(candidate, 'package.json'));
    const { PluginStorageRepository } = await import(pathToFileURL(require.resolve('emdash')).href);
    const { COMMERCE_PLUGIN_ID } = await load('dist/index.js');
    // The upstream read fixture omits query admission indexes; owning catalog writes need them.
    s.catalogItems = new PluginStorageRepository(opened.db, COMMERCE_PLUGIN_ID, 'catalogItems', ['commandId', 'skuKey']);
    const writes = { catalog: s.catalogItems, prices: s.catalogPrices, availability: s.catalogManualAvailability };
    for (const product of snapshot.products) {
      const first = product.members[0];
      await kernel.createCatalogItem(s.catalogItems, {
        commandId: `fixture:${product.id}`, name: product.name, sku: first.sku, fulfillment: first.fulfillment,
      }, { createId: () => product.id });
      if (product.options.length) {
        const option = product.options[0];
        const remaining = product.members.slice(1).map(x => x.catalogItemId);
        await kernel.addCatalogVariantOption(writes, {
          productId: product.id, optionId: option.optionId, optionLabel: option.label,
          values: option.values.map(value => {
            const member = product.members.find(x => x.selections[0].valueId === value.valueId);
            assert.ok(member, 'No member for option value');
            return { valueId: value.valueId, label: value.label, member: member.catalogItemId === product.id
              ? { catalogItemId: product.id, fulfillment: member.fulfillment }
              : { commandId: `fixture:${member.catalogItemId}`, name: product.name, sku: member.sku, fulfillment: member.fulfillment } };
          }),
        }, { createId: () => remaining.shift() });
      }
      for (const member of product.members) {
        // Effective-only snapshot: this is not evidence of the merchant's Regular/Sale records.
        const minor = BigInt(member.price.minor);
        const result = await kernel.saveCatalogProductPrices(writes, {
          catalogItemId: member.catalogItemId, regular: `${minor / 100n}.${String(minor % 100n).padStart(2, '0')}`,
          sale: '', stockStatus: member.availability.status === 'available-on-backorder' ? 'on-backorder' : member.availability.status,
          expectedRevision: null,
        });
        assert.equal(result.saved, true, 'Fixture price/stock write refused');
      }
    }
    const synth = syntheticCheckoutHost({ managed: false });
    const runtime = {
      carts: s[checkout.CHECKOUT_COLLECTION], capabilities: s[checkout.CHECKOUT_GUEST_CAPABILITY_COLLECTION],
      catalog: { catalog: s.catalogItems, prices: s.catalogPrices, backorderPolicies: s.catalogBackorderPolicies,
        configurations: s.storeInventoryConfigurations, settings: s.storefrontAvailabilitySettings,
        listing: s.storefrontOutOfStockListing, manualAvailability: s.catalogManualAvailability },
      constructorSiteUrl: synth.host.siteUrl, host: synth.host,
    };
    const address = { name: 'Synthetic Shopper', line1: '1 Fixture Way', city: 'Fixture', region: 'OR', postalCode: '97001', country: 'US' };
    const contact = { email: 'fixture@example.test', billing: address, delivery: address };
    const results = [];
    for (const product of snapshot.products) for (const member of product.members) {
      const prepared = await checkout.prepareGuestCheckout(runtime);
      assert.equal(prepared.ok, true);
      const headers = { [checkout.GUEST_CAPABILITY_HEADER]: prepared.capability.capability };
      const cart = input => checkout.cartGuestCheckout(runtime, input, headers);
      const line = { catalogItemId: member.catalogItemId, quantity: 2 };
      const exact = await cart({ version: null, lines: [line] });
      if (!member.availability.sellable) {
        assert.equal(exact.error?.code, 'PRODUCT_UNAVAILABLE');
        if (product.options.length) {
          const byChoice = await cart({ version: null, lines: [{ productId: product.id,
            options: Object.fromEntries(member.selections.map(x => [x.optionLabel, x.valueLabel])), quantity: 2 }] });
          assert.equal(byChoice.error?.code, 'PRODUCT_UNAVAILABLE');
        }
        assert.deepEqual((await cart({})).cart.lines, []);
        results.push({ name: product.name, itemId: member.catalogItemId, choices: member.selections, status: 'refused-sold-out' });
        continue;
      }
      assert.equal(exact.ok, true, JSON.stringify(exact));
      assert.deepEqual(exact.cart.lines, [line]);
      let saved = exact;
      if (product.options.length) {
        saved = await cart({ version: exact.cart.version, lines: [{ productId: product.id,
          options: Object.fromEntries(member.selections.map(x => [x.optionLabel, x.valueLabel])), quantity: 2 }] });
        assert.equal(saved.ok, true, JSON.stringify(saved));
        assert.deepEqual(saved.cart.lines, [line]);
        const unknown = await cart({ version: saved.cart.version, lines: [{ productId: product.id, options: { Size: 'not-a-size' }, quantity: 2 }] });
        assert.equal(unknown.error?.code, 'PRODUCT_UNAVAILABLE');
        assert.deepEqual((await cart({})).cart, saved.cart, 'Refused options changed saved intent');
      }
      const started = await checkout.startGuestCheckout(runtime, { contact }, headers);
      assert.equal(started.ok, true, JSON.stringify(started));
      assert.deepEqual(started.checkout.lines.map(x => ({ catalogItemId: x.catalogItemId, quantity: x.quantity, unitPrice: x.unitPrice })),
        [{ ...line, unitPrice: member.price }]);
      assert.equal(started.checkout.lines[0].name, product.name);
      assert.equal(started.checkout.total.minor, String(2n * BigInt(member.price.minor)));
      if (member.selections.length) {
        const frozen = started.checkout.variantSelections.find(x => x.catalogItemId === member.catalogItemId);
        assert.equal(frozen.productId, product.id);
        assert.deepEqual(frozen.selections, member.selections, 'Checkout lost the selected size');
      }
      assert.equal((await cart({ version: saved.cart.version, lines: [] })).error?.code, 'CHECKOUT_FROZEN');
      results.push({ name: product.name, itemId: member.catalogItemId, choices: member.selections,
        status: member.availability.status, effectiveUnitMinor: member.price.minor, quantity: 2, totalMinor: started.checkout.total.minor });
    }
    assert.equal(synth.counts().paymentCreates, results.filter(x => x.status !== 'refused-sold-out').length);
    return { scope: 'public-projection-source-kernel-only', candidateHead: head, snapshotSha256: snapshot.sha256,
      families: snapshot.products.length, members: results.length, fixtureOnlySkuAliases: snapshot.aliases,
      syntheticPaymentCreates: synth.counts().paymentCreates,
      limitations: ['Not a storage/order/browser migration or signed Registry proof.',
        'Only public effective prices; no Regular/Sale persistence claim.',
        'Missing child SKUs use explicitly synthetic aliases.',
        'Payments, address and checkout policies are synthetic; no hosted calls.'], results };
  } finally {
    await opened?.db.destroy();
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const selected = options(process.argv.slice(2));
  if (!selected) console.log('Read-only public projection; disposable source qualification only. Use --check --candidate=<built Commerce checkout>.');
  else console.log(JSON.stringify(await qualify(selected), null, 2));
}
