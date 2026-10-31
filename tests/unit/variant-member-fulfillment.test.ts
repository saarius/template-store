// Commerce's grouped public DTO supplies fulfillment for each concrete member.
import { expect, it, vi } from 'vitest';
vi.mock('emdash', () => ({ PluginStorageRepository: class {}, handleMediaGet: vi.fn() }));
vi.mock('emdash/runtime', () => ({ getDb: vi.fn() }));
import { readCommerceCatalogSnapshots } from '../../src/features/commerce-catalog/index.js';
const available = { status: 'in-stock', listable: true, sellable: true };
it.each([[false, 8], [true, 8], [false, 9], [true, 9]] as const)('preserves digital fulfillment (default=%s, lines=%i)', async (isDefault, count) => {
  const target = isDefault ? 'family' : 'download';
  const product = { id: 'family', name: 'Synthetic print', sku: 'SYNTHETIC', availability: { ...available, sellable: false }, variants: {
    schema: 'dinkuskit.commerce.product-variants/v1', productId: 'family', options: [], members: [
      { catalogItemId: 'family', price: { currency: 'USD', minor: '1800' }, fulfillment: isDefault ? 'digital' : 'physical', availability: available,
        selections: [{ optionLabel: 'Format', valueLabel: 'Default' }] },
      { catalogItemId: 'download', price: { currency: 'USD', minor: '600' }, fulfillment: 'digital', availability: available,
        selections: [{ optionLabel: 'Format', valueLabel: 'PDF' }] },
    ],
  } };
  const dispatch = vi.fn(async (_id: string, _method: string, route: string) => ({ success: true, data: route === 'catalog/public' ? { products: [product] } : product }));
  const snapshots = await readCommerceCatalogSnapshots([target, ...Array.from({ length: count - 1 }, (_, i) => 'missing-' + i)], {
    request: new Request('https://shop.example.test/api/guest-cart/snapshot'), runtime: { getPluginRouteMeta: () => ({ public: true, methods: ['GET'] }), handlePublicPluginApiRoute: dispatch },
  });
  expect(snapshots[0]).toMatchObject({ id: target, found: true, price: { unitMinor: isDefault ? '1800' : '600' }, fulfillment: 'digital' });
  expect(dispatch.mock.calls.map(call => call[2])).toEqual(count === 8 ? Array(8).fill('catalog/public/item') : ['catalog/public']);
});

it.each([undefined, 'not-a-fulfillment', 'physical', 'digital'])('retains the physical compatibility fallback unless fulfillment is explicit and valid (%s)', async fulfillment => {
  const product = { id: 'family', name: 'Synthetic print', sku: 'SYNTHETIC', availability: { ...available, sellable: false }, variants: {
    members: [{ catalogItemId: 'family', fulfillment, price: { currency: 'USD', minor: '1800' }, availability: available,
      selections: [{ optionLabel: 'Format', valueLabel: 'Default' }] }],
  } };
  const snapshots = await readCommerceCatalogSnapshots(['family'], {
    request: new Request('https://shop.example.test/api/guest-cart/snapshot'),
    runtime: { getPluginRouteMeta: () => ({ public: true, methods: ['GET'] }), handlePublicPluginApiRoute: async () => ({ success: true, data: product }) },
  });
  expect(snapshots[0]).toMatchObject({ id: 'family', found: true, fulfillment: fulfillment === 'digital' ? 'digital' : 'physical' });
});
