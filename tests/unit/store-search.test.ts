import { describe, expect, it, vi } from 'vitest';
import { loadStoreSearch, searchResultHref, type StoreSearchHit } from '../../src/features/store-shell/store-search.js';
const hit = (collection: string, slug: string, extra = {}): StoreSearchHit => ({ collection, id: slug, slug, title: slug, score: 1, ...extra });
const products = async () => new Set(['camp-mug', 'long-way-cap']);

describe('merchant store search', () => {
  it('does not query the index or Commerce for blank/too-short input', async () => {
    const search = vi.fn(), visibleProducts = vi.fn();
    expect((await loadStoreSearch('   ', { search, visibleProducts })).state).toBe('idle');
    expect((await loadStoreSearch(' m ', { search, visibleProducts })).state).toBe('short');
    expect(search).not.toHaveBeenCalled(); expect(visibleProducts).not.toHaveBeenCalled();
  });
  it('bounds and trims the query before the search call', async () => {
    const search = vi.fn(async () => []);
    const result = await loadStoreSearch('  ' + 'x'.repeat(150) + '  ', { search, visibleProducts: products });
    expect(result.query.length).toBe(120); expect(search).toHaveBeenCalledWith('x'.repeat(120));
  });
  it('keeps Commerce visibility and groups destinations without trusting indexed prices', async () => {
    const result = await loadStoreSearch('mug', { visibleProducts: products, search: async () => [
      hit('pages', 'field-note-wet-gear-reset', { title: 'The wet-gear reset' }),
      hit('products', 'hidden-product'), hit('categories', 'slow-camp'),
      hit('products', 'camp-mug', { title: 'Camp mug', snippet: 'Camp <mark>mug</mark>' }), hit('private-orders', 'secret'),
    ] });
    expect(result.state).toBe('results'); expect(result.count).toBe(3);
    expect(result.groups.map(group => group.label)).toEqual(['Gear', 'Collections', 'Field notes & guides']);
    expect(result.groups[0].items[0]).toEqual({ title: 'Camp mug', href: '/products/camp-mug', parts: [] });
    expect(JSON.stringify(result)).not.toContain('hidden-product'); expect(JSON.stringify(result)).not.toContain('secret');
  });
  it('keeps real non-title snippets as safe text and marks, not HTML', async () => {
    const result = await loadStoreSearch('map', { visibleProducts: products, search: async () => [
      hit('pages', 'field-note-route', { title: 'A route', snippet: 'Pack the <mark>map</mark> &amp; <img src=x onerror=alert(1)>go.' }),
    ] });
    expect(result.groups[0].items[0].parts).toEqual([
      { text: 'Pack the ', highlighted: false }, { text: 'map', highlighted: true }, { text: ' & go.', highlighted: false },
    ]);
  });
  it('distinguishes a real zero result from index or visibility failure', async () => {
    expect((await loadStoreSearch('none', { search: async () => [], visibleProducts: products })).state).toBe('empty');
    expect((await loadStoreSearch('mug', { search: async () => { throw Error('index'); }, visibleProducts: products })).state).toBe('unavailable');
    const failed = await loadStoreSearch('mug', { search: async () => [hit('products', 'camp-mug')], visibleProducts: async () => { throw Error('commerce'); } });
    expect(failed.state).toBe('unavailable'); expect(failed.count).toBe(0); expect(failed.groups).toEqual([]);
  });
  it('does not call Commerce when only editorial results matched', async () => {
    const visibleProducts = vi.fn();
    const result = await loadStoreSearch('route', { search: async () => [hit('pages', 'field-note-route')], visibleProducts });
    expect(result.state).toBe('results'); expect(visibleProducts).not.toHaveBeenCalled();
  });
  it('bounds results and names a limited list without claiming a total', async () => {
    const result = await loadStoreSearch('route', { search: async () => Array.from({ length: 25 }, (_, n) => hit('pages', `note-${n}`)), visibleProducts: products });
    expect(result.count).toBe(20); expect(result.limited).toBe(true);
  });
  it('only links known collections and safe single-segment slugs', () => {
    expect(searchResultHref(hit('pages', 'home'))).toBe('/');
    expect(searchResultHref(hit('products', 'camp-mug'))).toBe('/products/camp-mug');
    for (const slug of ['..', '../admin', '//evil.example', 'javascript:alert(1)', '<script>', 'a?b']) {
      expect(searchResultHref(hit('pages', slug))).toBeNull();
    }
    expect(searchResultHref(hit('orders', 'test'))).toBeNull();
  });
});
