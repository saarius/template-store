import { describe, expect, it } from 'vitest';
import type { PublicCommerceProduct } from '../../src/features/commerce-catalog/index.js';
import { readRelatedShopProducts } from '../../src/features/store-shell/backroad-collections.js';

const categories = [
  { id: 'road-day', data: { title: 'Road day' } },
  { id: 'slow-camp', data: { title: 'Slow camp' } },
];
const page = (slug: string, groups = ['road-day']) => ({ id: slug, data: { id: `page-${slug}`, title: slug, categories: groups, price: 'FAKE' } });
const item = (slug: string) => ({
  id: `item-${slug}`, page: `page-${slug}`, name: slug, sku: slug,
  price: { listable: true, regularText: '$28.00', saleText: '$24.00', unitMinor: '2400' },
  availability: { status: 'in-stock', listable: true, sellable: true },
}) as PublicCommerceProduct;

describe('related gear follows published collections, never editorial sale facts', () => {
  it('excludes self, deduplicates shared memberships and retains authoritative Commerce objects', async () => {
    const tote = item('tote'), cap = item('cap'), mug = item('mug');
    const result = await readRelatedShopProducts(tote.id,
      [page('tote', ['road-day', 'slow-camp']), page('cap', ['road-day', 'slow-camp']), page('mug', ['slow-camp'])],
      categories, async () => [tote, cap, mug]);
    expect(result.available).toBe(true);
    if (!result.available) throw Error('expected available');
    expect(result.collections.map(group => group.slug)).toEqual(['road-day', 'slow-camp']);
    expect(result.products).toEqual([cap, mug]);
    expect(result.products[0]).toBe(cap);
    expect(result.products[0].price).toBe(cap.price);
    expect(result.products[0].availability).toBe(cap.availability);
    expect(result.paths.get(mug.id)).toBe('/products/mug');
  });

  it('bounds onward choices to three and does not pull from an unrelated collection', async () => {
    const slugs = ['tote', 'cap', 'tee', 'map', 'bottle'];
    const result = await readRelatedShopProducts('item-tote',
      [...slugs.map(slug => page(slug)), page('mug', ['slow-camp'])], categories,
      async () => [...slugs.map(item), item('mug')]);
    expect(result.available && result.products.map(product => product.id)).toEqual(['item-cap', 'item-tee', 'item-map']);
  });

  it('cannot resurrect removed, unpublished, unlinked or ambiguous product pages', async () => {
    const duplicate = { ...page('duplicate'), data: { ...page('duplicate').data, id: 'page-cap' } };
    const result = await readRelatedShopProducts('item-tote',
      [page('tote'), page('removed'), page('cap'), duplicate], categories,
      async () => [item('tote'), item('unpublished'), item('no-page'), item('cap')]);
    expect(result.available && result.products).toEqual([]);
  });

  it('keeps a sold-out shared product discoverable without making it purchasable', async () => {
    const soldOut = { ...item('cap'), availability: { status: 'out-of-stock', listable: true, sellable: false } } as PublicCommerceProduct;
    const result = await readRelatedShopProducts('item-tote', [page('tote'), page('cap')], categories, async () => [item('tote'), soldOut]);
    expect(result.available && result.products[0]).toBe(soldOut);
    expect(result.available && result.products[0].availability.sellable).toBe(false);
  });

  it('does not invent related gear for a missing current product or absent membership', async () => {
    for (const entries of [[page('cap')], [page('tote', []), page('cap')]]) {
      const result = await readRelatedShopProducts('item-tote', entries, categories, async () => [item('tote'), item('cap')]);
      expect(result.available && result.collections).toEqual([]);
      expect(result.available && result.products).toEqual([]);
    }
  });

  it('keeps a collection link when it contains only the current product', async () => {
    const result = await readRelatedShopProducts('item-tote', [page('tote')], categories, async () => [item('tote')]);
    expect(result.available && result.collections.map(group => group.slug)).toEqual(['road-day']);
    expect(result.available && result.products).toEqual([]);
  });

  it('distinguishes catalog failure from a genuinely empty projection and permits a fresh retry', async () => {
    const failed = await readRelatedShopProducts('item-tote', [], categories, async () => { throw Error('private transport diagnostic'); });
    expect(failed).toEqual({ available: false });
    const recovered = await readRelatedShopProducts('item-tote', [], categories, async () => []);
    expect(recovered.available && recovered.products).toEqual([]);
  });
});
