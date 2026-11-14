// Read-only deployed feed verification. Empty exports are explicit, never populated-behavior proof.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.BACKROADBUM_VERIFY_URL ?? 'https://backroadbum.com';
const headers = { 'user-agent': 'BackroadBum-SelfCheck/1.0' };
async function get(path) {
  const response = await fetch(origin + path, { headers, redirect: 'manual' });
  assert.equal(response.status, 200, path);
  return response;
}
const catalog = (await (await get('/_emdash/api/plugins/r_gshdrqaldna3r7sn/catalog/public')).json()).data;
assert.ok(Array.isArray(catalog.products));
assert.equal(catalog.cursor, undefined, 'This bounded store must fit one catalog page; extend the verifier before increasing its size.');
const response = await get('/feeds/agent-catalog.json');
assert.match(response.headers.get('content-type'), /^application\/json\b/);
assert.equal(response.headers.get('cache-control'), 'no-store');
const feed = await response.json();
assert.equal(feed.schema, 'dinkuskit.commerce.agent-catalog-feed/v1');
assert.equal(feed.siteOrigin, origin);
assert.equal(feed.storeName, 'Backroad Bum');
assert.deepEqual(feed.policies.map(p => p.url).sort(), [origin + '/returns', origin + '/shipping']);
const shop = await (await get('/shop')).text();
const paths = [...new Set([...shop.matchAll(/href="(\/products\/[a-z0-9-]+)"/g)].map(m => m[1]))];
const published = new Map();
for (const path of paths) {
  const page = await (await get(path)).text();
  const id = page.match(/data-commerce-item="([a-zA-Z0-9_-]+)"/)?.[1];
  assert.ok(id, `Commerce identity on ${path}`);
  published.set(id, path);
}
const eligible = catalog.offCatalog === true ? [] : catalog.products.filter(p =>
  published.has(p.id) && p.feedChannels?.length && p.availability.listable &&
  (p.price || p.variants?.members.some(m => m.availability.listable && m.price)));
assert.deepEqual(feed.products.map(p => p.id).sort(), eligible.map(p => p.id).sort());
for (const product of feed.products) {
  const authority = catalog.products.find(p => p.id === product.id);
  assert.equal(product.canonicalUrl, origin + published.get(product.id));
  assert.equal(product.title, authority.name);
  assert.equal(product.availability.status, authority.availability.status);
  if (authority.price) assert.equal(product.price.minor, authority.price.minor);
  else assert.equal(product.price, undefined, 'Do not invent a parent price.');
  const members = authority.variants?.options.length ? authority.variants.members.filter(m => m.availability.listable && m.price) : [];
  if (members.length) {
    assert.deepEqual(product.variants.members.map(m => ({ id: m.catalogItemId, price: m.price.minor, selections: m.selections.map(s => [s.optionLabel, s.valueLabel]), status: m.availability.status, sellable: m.availability.sellable })),
      members.map(m => ({ id: m.catalogItemId, price: m.price.minor, selections: m.selections.map(s => [s.optionLabel, s.valueLabel]), status: m.availability.status, sellable: m.availability.sellable })));
  }
}
const slash = await fetch(origin + '/feeds/agent-catalog.json/', { headers, redirect: 'manual' });
assert.ok([301, 302, 307, 308, 404].includes(slash.status), 'Slash must not serve a second feed.');
if (slash.status !== 404) assert.equal(new URL(slash.headers.get('location'), origin).href, origin + '/feeds/agent-catalog.json');
const report = {
  checkedAt: new Date().toISOString(), origin,
  publicFamilies: catalog.products.length, publicMembers: catalog.products.flatMap(p => p.variants?.members ?? [p]).length,
  publishedShopFamilies: published.size, channelApprovedFamilies: eligible.length, exportedFamilies: feed.products.length,
  emptyExport: feed.products.length === 0,
  populatedRouteVerified: feed.products.length > 0,
  explanation: feed.products.length ? 'Export matches published, channel-approved public Commerce facts.' : 'Valid empty feed under the existing Google/Meta channel eligibility contract; no populated route qualification.',
  limitations: 'No Regular/Sale pair is reconstructed from the signed effective price. Draft mutations, native catalog toggle and remote catalog admission are not exercised.',
  products: catalog.products.map(p => ({ name: p.name, channels: p.feedChannels, priceMinor: p.price?.minor ?? null, status: p.availability.status, variants: p.variants?.members.map(m => ({ selections: m.selections.map(s => [s.optionLabel, s.valueLabel]), priceMinor: m.price?.minor, status: m.availability.status, sellable: m.availability.sellable })) })),
};
const output = new URL('../runs/backroadbum/agent-catalog/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('verification.json', output), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
