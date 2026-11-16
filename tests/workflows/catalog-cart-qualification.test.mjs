import assert from 'node:assert/strict';
import test from 'node:test';
import { options, projectPublicCatalog, PUBLIC_CATALOG_URL, readPublicSnapshot } from '../../scripts/qualify-backroadbum-catalog-cart.mjs';

const selection = (id, label) => ({ optionId: 'size', optionLabel: 'Size', valueId: id, valueLabel: label });
function fixture() {
  return { success: true, data: { products: [{ id: 'parent', name: 'Fixture shirt', sku: 'PARENT-M', variants: {
    productId: 'parent', options: [{ optionId: 'size', label: 'Size', values: [{ valueId: 'm', label: 'M' }, { valueId: 'l', label: 'L' }] }],
    members: [{ catalogItemId: 'parent', selections: [selection('m', 'M')], price: { currency: 'USD', minor: '1400' },
      availability: { status: 'in-stock', sellable: true }, fulfillment: 'physical' },
    { catalogItemId: 'child', selections: [selection('l', 'L')], price: { currency: 'USD', minor: '1600' },
      availability: { status: 'available-on-backorder', sellable: true }, fulfillment: 'physical' }],
  } }] } };
}

test('no-argument qualification is inert; explicit check accepts only a source checkout', () => {
  assert.equal(options([]), null);
  assert.ok(options(['--check', '--candidate=fixture-source']).candidate.endsWith('/fixture-source'));
  for (const args of [['--candidate=x'], ['--check'], ['--check', '--database=private.db'],
    ['--check', '--candidate=x', '--url=https://example.test'], ['--check', '--candidate=']]) {
    assert.throws(() => options(args));
  }
});

test('projection preserves identity, choice, current price and stock without mutating input', () => {
  const original = fixture(), before = structuredClone(original);
  const projected = projectPublicCatalog(original);
  assert.deepEqual(original, before);
  assert.equal(projected.products[0].members[1].catalogItemId, 'child');
  assert.deepEqual(projected.products[0].members[1].selections, [selection('l', 'L')]);
  assert.equal(projected.products[0].members[1].price.minor, '1600');
  assert.equal(projected.products[0].members[1].availability.status, 'available-on-backorder');
  assert.equal(projected.products[0].members[0].sku, 'PARENT-M');
  assert.equal(projected.products[0].members[1].sku, 'FIXTURE-ONLY-child');
  assert.equal(projected.aliases, 1);
});

test('a member own SKU is used; its sibling SKU is never borrowed', () => {
  const body = fixture();
  body.data.products[0].variants.members[1].sku = 'OWN-L';
  const projected = projectPublicCatalog(body);
  assert.equal(projected.products[0].members[1].sku, 'OWN-L');
  assert.equal(projected.aliases, 0);
});

for (const [name, mutate] of [
  ['duplicate identity', x => { x.data.products[0].variants.members[1].catalogItemId = 'parent'; }],
  ['missing price', x => { delete x.data.products[0].variants.members[0].price; }],
  ['unsafe price', x => { x.data.products[0].variants.members[0].price.minor = '9007199254740992'; }],
  ['unknown stock', x => { x.data.products[0].variants.members[0].availability.status = 'unknown'; }],
  ['contradictory stock', x => { x.data.products[0].variants.members[0].availability.sellable = false; }],
  ['missing selection', x => { x.data.products[0].variants.members[0].selections = []; }],
  ['mismatched label', x => { x.data.products[0].variants.members[0].selections[0].valueLabel = 'XL'; }],
  ['unimplemented extra dimension', x => { x.data.products[0].variants.options.push({}); }],
]) test(`fixture refuses ${name} rather than silently weakening the projection`, () => {
  const body = fixture(); mutate(body); assert.throws(() => projectPublicCatalog(body));
});

test('network read is fixed-origin, anonymous, bounded and redirect-refusing', async () => {
  const projected = await readPublicSnapshot(async (url, init) => {
    assert.equal(url, PUBLIC_CATALOG_URL);
    assert.equal(init.redirect, 'error');
    assert.deepEqual(init.headers, { accept: 'application/json' });
    assert.ok(init.signal instanceof AbortSignal);
    return Response.json(fixture());
  });
  assert.match(projected.sha256, /^[a-f0-9]{64}$/);
});

test('network read refuses non-JSON and unsuccessful responses', async () => {
  await assert.rejects(readPublicSnapshot(async () => new Response('error', { status: 503 })));
  await assert.rejects(readPublicSnapshot(async () => new Response('{}', { headers: { 'content-type': 'text/html' } })));
  await assert.rejects(readPublicSnapshot(async () => Response.json({ success: false })));
});

test('oversize bodies cancel their stream, including chunked responses without Content-Length', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(300_000)); }, cancel() { cancelled = true; } });
  await assert.rejects(readPublicSnapshot(async () => new Response(stream, { headers: { 'content-type': 'application/json' } })), /exceeds fixture limit/);
  assert.equal(cancelled, true);
});
