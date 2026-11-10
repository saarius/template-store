import { describe, expect, it } from 'vitest';
import type { PublicCommerceProduct } from '../../src/features/commerce-catalog/index.js';
import { relatedShopProducts, shopCollections } from '../../src/features/store-shell/backroad-collections.js';

const categories = [
  { id: 'road-day', data: { title: 'Road day', description: 'Room for the unplanned stop.' } },
  { id: 'slow-camp', data: { title: 'Slow camp', description: 'One more evening outside.' } },
  { id: 'empty', data: { title: 'Empty collection' } },
];
const page = (slug: string, groups = ['road-day']) => ({ id: slug, data: { id: `page-${slug}`, title: slug, categories: groups, price: 'FAKE' } });
const item = (slug: string) => ({
  id: `item-${slug}`, page: `page-${slug}`, name: slug, sku: slug,
  price: { listable: true, regularText: '$28.00', saleText: '$24.00', unitMinor: '2400' },
  availability: { status: 'in-stock' },
}) as PublicCommerceProduct;

describe('Backroad Bum collection projection', () => {
  it('selects published memberships and preserves authoritative Commerce price and availability objects', () => {
    const tote = item('tote');
    const cap = item('cap');
    const { groups, paths } = shopCollections([page('tote', ['road-day', 'slow-camp']), page('cap')], categories, [cap, tote]);
    expect(groups.find(group => group.slug === 'road-day')?.products).toEqual([cap, tote]);
    expect(groups.find(group => group.slug === 'slow-camp')?.products).toEqual([tote]);
    expect(groups.find(group => group.slug === 'road-day')?.products[0]).toBe(cap);
    expect(groups.find(group => group.slug === 'road-day')?.description).toBe('Room for the unplanned stop.');
    expect(paths.get(cap.id)).toBe('/products/cap');
  });
  it('does not resurrect removed products in any collection, related gear or product path', () => {
    const live = item('live');
    const { groups, paths } = shopCollections([
      page('archived', ['road-day', 'slow-camp']),
      page('live', ['road-day', 'slow-camp']),
      // An old CMS link is not permission to restore a missing Commerce item.
      { ...page('stale'), data: { ...page('stale').data, commerce_item_id: 'item-archived' } },
    ], categories, [live, item('no-page')]);
    for (const slug of ['road-day', 'slow-camp']) {
      expect(groups.find(group => group.slug === slug)?.products).toEqual([live]);
    }
    expect(relatedShopProducts(live.id, groups).products).toEqual([]);
    expect([...paths.entries()]).toEqual([['item-live', '/products/live']]);
  });
  it('keeps a published empty collection addressable without inventing products', () => {
    const { groups } = shopCollections([], categories, []);
    expect(groups.find(group => group.slug === 'empty')).toEqual({ slug: 'empty', title: 'Empty collection', description: '', products: [] });
  });
  it('excludes malformed categories and conflicting page links', () => {
    const duplicate = { ...page('duplicate'), data: { ...page('duplicate').data, id: 'page-cap' } };
    const { groups, paths } = shopCollections([page('cap'), duplicate], [...categories, { id: '../bad', data: { title: 'Bad' } }], [item('cap')]);
    expect(groups.every(group => group.products.length === 0)).toBe(true);
    expect(groups.some(group => group.slug === '../bad')).toBe(false);
    expect(paths.size).toBe(0);
  });
  it('keeps sold-out products discoverable without changing their sellability', () => {
    const product = { ...item('cap'), availability: { status: 'out-of-stock' } } as PublicCommerceProduct;
    expect(shopCollections([page('cap')], categories, [product]).groups.find(group => group.slug === 'road-day')?.products[0]).toBe(product);
  });
});
