import { describe, expect, it, vi } from 'vitest';
import { compactSearchPreview, loadStoreSearch, searchResultHref, type StoreSearchHit } from '../../src/features/store-shell/store-search.js';
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
  it('loads published previews only for selected field-note hits without a useful snippet', async () => {
    const fieldNotePreviews = vi.fn(async () => new Map([
      ['field-note-wet-gear-reset', 'Hang the damp things before packing the mug.'],
      ['field-note-map', '<img src=x onerror=alert(1)> is plain authored text.'],
      ['test-store', 'Never use this extra entry.'],
      ['camp-mug', '$999 invented product price'],
    ]));
    const result = await loadStoreSearch('mug', { visibleProducts: products, fieldNotePreviews, search: async () => [
      hit('pages', 'field-note-wet-gear-reset', { title: 'The wet-gear reset', snippet: 'The wet-gear reset' }),
      hit('pages', 'field-note-map', { title: 'A map' }),
      hit('pages', 'field-note-route', { snippet: 'Bring a <mark>mug</mark>.' }),
      hit('products', 'camp-mug'), hit('categories', 'slow-camp'), hit('pages', 'test-store'),
    ] });
    expect(fieldNotePreviews).toHaveBeenCalledOnce();
    expect(fieldNotePreviews).toHaveBeenCalledWith(['field-note-wet-gear-reset', 'field-note-map']);
    const notes = result.groups.find(group => group.collection === 'pages')!.items;
    expect(notes[0].parts).toEqual([{ text: 'Hang the damp things before packing the mug.', highlighted: false }]);
    expect(notes[1].parts).toEqual([{ text: '<img src=x onerror=alert(1)> is plain authored text.', highlighted: false }]);
    expect(notes[2].parts).toEqual([{ text: 'Bring a ', highlighted: false }, { text: 'mug', highlighted: true }, { text: '.', highlighted: false }]);
    expect(notes[3].parts).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('$999');
  });
  it('does not apply a note preview to a product or collection with the same slug', async () => {
    const result = await loadStoreSearch('map', {
      visibleProducts: async () => new Set(['field-note-map']),
      fieldNotePreviews: async () => new Map([['field-note-map', 'An opening paragraph.']]),
      search: async () => [hit('pages', 'field-note-map'), hit('products', 'field-note-map'), hit('categories', 'field-note-map')],
    });
    expect(result.groups[0].items[0].parts).toEqual([]);
    expect(result.groups[1].items[0].parts).toEqual([]);
    expect(result.groups[2].items[0].parts).toEqual([{ text: 'An opening paragraph.', highlighted: false }]);
  });
  it('never fetches previews for filtered, invalid or beyond-limit hits', async () => {
    const fieldNotePreviews = vi.fn();
    await loadStoreSearch('mug', { visibleProducts: products, fieldNotePreviews, search: async () => [
      ...Array.from({ length: 20 }, (_, n) => hit('pages', `guide-${n}`)),
      hit('pages', 'field-note-not-selected'), hit('pages', '../field-note-private'),
    ] });
    expect(fieldNotePreviews).not.toHaveBeenCalled();
    await loadStoreSearch(' ', { search: vi.fn(), visibleProducts: products, fieldNotePreviews });
    expect(fieldNotePreviews).not.toHaveBeenCalled();
  });
  it('keeps successful search results if a preview read fails or the published note is absent', async () => {
    for (const fieldNotePreviews of [async () => { throw Error('content'); }, async () => new Map()]) {
      const result = await loadStoreSearch('mug', { visibleProducts: products, fieldNotePreviews,
        search: async () => [hit('pages', 'field-note-wet-gear-reset')] });
      expect(result.state).toBe('results'); expect(result.count).toBe(1);
      expect(result.groups[0].items[0].parts).toEqual([]);
    }
  });
  it('compacts paragraphs without adding highlights or splitting a Unicode code point', () => {
    expect(compactSearchPreview('  A paragraph\n with\tspace. ')).toBe('A paragraph with space.');
    expect(compactSearchPreview('a'.repeat(240))).toBe('a'.repeat(240));
    expect(compactSearchPreview('🛶'.repeat(241))).toBe('🛶'.repeat(239) + '…');
    const original = 'A useful sentence with room to read. '.repeat(10);
    const preview = compactSearchPreview(original);
    expect(Array.from(preview).length).toBeLessThanOrEqual(240);
    expect(preview.endsWith('…')).toBe(true);
    expect(original.startsWith(preview.slice(0, -1) + ' ')).toBe(true);
    expect(preview).not.toContain('<mark>');
  });
  it('distinguishes a real zero result from index or visibility failure', async () => {
    expect((await loadStoreSearch('none', { search: async () => [], visibleProducts: products })).state).toBe('empty');
    expect((await loadStoreSearch('mug', { search: async () => { throw Error('index'); }, visibleProducts: products })).state).toBe('unavailable');
    const failed = await loadStoreSearch('mug', { search: async () => [hit('products', 'camp-mug')], visibleProducts: async () => { throw Error('commerce'); } });
    expect(failed.state).toBe('unavailable'); expect(failed.count).toBe(0); expect(failed.groups).toEqual([]);
  });
  it('keeps published notes and collections when matched gear cannot be verified', async () => {
    const visibleProducts = vi.fn(async () => { throw Error('commerce'); });
    const optionMatches = vi.fn(async () => [{ slug: 'camp-mug', title: 'Unverified option', options: [
      { href: '/products/camp-mug?item=large', label: 'Size: L', availability: 'in-stock' as const },
    ] }]);
    const fieldNotePreviews = vi.fn(async () => new Map([['field-note-mug', 'A note about the mug.']]));
    const result = await loadStoreSearch('mug L', { visibleProducts, optionMatches, fieldNotePreviews, search: async () => [
      hit('products', 'camp-mug', { title: 'Unverified indexed title' }),
      hit('pages', 'field-note-mug'), hit('categories', 'slow-camp'), hit('pages', '../hidden'),
    ] });
    expect(result.state).toBe('partial');
    expect(result.count).toBe(2);
    expect(result.groups.map(group => group.collection)).toEqual(['categories', 'pages']);
    expect(result.groups[1].items[0]).toEqual({ title: 'field-note-mug', href: '/field-note-mug', parts: [
      { text: 'A note about the mug.', highlighted: false },
    ] });
    expect(visibleProducts).toHaveBeenCalledOnce();
    expect(optionMatches).not.toHaveBeenCalled();
    expect(result.optionMatches).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/Unverified|hidden/);
  });
  it('does not call Commerce when only editorial results matched', async () => {
    const visibleProducts = vi.fn();
    const result = await loadStoreSearch('route', { search: async () => [hit('pages', 'field-note-route')], visibleProducts });
    expect(result.state).toBe('results'); expect(visibleProducts).not.toHaveBeenCalled();
  });
  it('does not call a verified empty catalog a partial outage', async () => {
    const result = await loadStoreSearch('mug', { visibleProducts: async () => new Set(), search: async () => [
      hit('products', 'retired-mug'), hit('pages', 'field-note-mug'),
    ] });
    expect(result.state).toBe('results');
    expect(result.groups.map(group => group.collection)).toEqual(['pages']);
  });
  it('bounds results and names a limited list without claiming a total', async () => {
    const result = await loadStoreSearch('route', { search: async () => Array.from({ length: 25 }, (_, n) => hit('pages', `note-${n}`)), visibleProducts: products });
    expect(result.count).toBe(20); expect(result.limited).toBe(true);
  });
  it('keeps the empty-index exact option fallback without reading Commerce for ordinary native results', async () => {
    const optionMatches = vi.fn(async () => [{ slug: 'camp-mug', title: 'Camp mug', options: [{ href: '/products/camp-mug?item=mug-blue', label: 'Color: Blue', availability: 'in-stock' as const }] }]);
    const result = await loadStoreSearch('mug blue', { search: async () => [], visibleProducts: products, optionMatches });
    expect(optionMatches).toHaveBeenCalledWith('mug blue');
    expect(result.count).toBe(1); expect(result.state).toBe('results');
    expect(result.groups[0].items[0]).toEqual({ title: 'Camp mug', href: '/products/camp-mug?item=mug-blue', parts: [],
      options: [{ href: '/products/camp-mug?item=mug-blue', label: 'Color: Blue', availability: 'in-stock' }] });
    optionMatches.mockClear();
    await loadStoreSearch('mug', { search: async () => [hit('products', 'camp-mug')], visibleProducts: products, optionMatches });
    await loadStoreSearch('map', { search: async () => [hit('pages', 'field-note-map')], visibleProducts: products, optionMatches });
    await loadStoreSearch(' ', { search: vi.fn(), visibleProducts: products, optionMatches });
    expect(optionMatches).not.toHaveBeenCalled();
  });
  it('enriches the indexed product in place and leaves unrelated ranks and snippets intact', async () => {
    const options = [{ href: '/products/long-way-cap?item=large', label: 'Size: L', availability: 'in-stock' as const }];
    const optionMatches = vi.fn(async () => [{ slug: 'long-way-cap', title: 'Commerce title', options }]);
    const result = await loadStoreSearch('cap L', { visibleProducts: products, optionMatches, search: async () => [
      hit('products', 'camp-mug'), hit('pages', 'field-note-cap'),
      hit('products', 'long-way-cap', { title: 'Published cap title', snippet: 'An <mark>adjustable</mark> fit.' }),
    ] });
    expect(optionMatches).toHaveBeenCalledWith('cap L');
    expect(result.count).toBe(3);
    expect(result.groups[0].items).toEqual([
      { title: 'camp-mug', href: '/products/camp-mug', parts: [] },
      { title: 'Published cap title', href: options[0].href, options, parts: [
        { text: 'An ', highlighted: false }, { text: 'adjustable', highlighted: true }, { text: ' fit.', highlighted: false },
      ] },
    ]);
    expect(result.groups[1].items[0].href).toBe('/field-note-cap');
  });
  it('finds a size hidden by an editorial-only index result, without hiding the note or doubling the gear', async () => {
    const visibleProducts = vi.fn();
    const match = { slug: 'long-way-cap', title: 'Long Way Cap', options: [
      { href: '/products/long-way-cap?item=medium', label: 'Size: M', availability: 'in-stock' as const },
    ] };
    const search = async () => [hit('pages', 'field-note-cap')];
    const result = await loadStoreSearch('cap M', { visibleProducts, search, optionMatches: async () => [match, match] });
    expect(visibleProducts).not.toHaveBeenCalled();
    expect(result.count).toBe(2);
    expect(result.optionMatches).toEqual([match]);
    expect(result.groups.map(group => group.items[0].href)).toEqual([match.options[0].href, '/field-note-cap']);
    const partial = await loadStoreSearch('cap M', { visibleProducts, search,
      optionMatches: async () => { throw Error('Commerce unavailable'); } });
    expect(partial.state).toBe('results');
    expect(partial.count).toBe(1);
    expect(partial.groups[0].items[0].href).toBe('/field-note-cap');
  });
  it('caps the combined results but still enriches an indexed family at the limit', async () => {
    const options = [{ href: '/products/long-way-cap?item=large', label: 'Size: L', availability: 'in-stock' as const }];
    const result = await loadStoreSearch('size L', { visibleProducts: products, search: async () => [
      hit('products', 'long-way-cap'), ...Array.from({ length: 18 }, (_, n) => hit('pages', `note-${n}`)),
    ], optionMatches: async () => [
      { slug: 'tee', title: 'Tee', options: [{ ...options[0], href: '/products/tee?item=large' }] },
      { slug: 'fleece', title: 'Fleece', options: [{ ...options[0], href: '/products/fleece?item=large' }] },
      { slug: 'long-way-cap', title: 'Cap', options },
    ] });
    expect(result.count).toBe(20);
    expect(result.limited).toBe(true);
    expect(result.groups[0].items.map(item => item.href)).toEqual([options[0].href, '/products/tee?item=large']);
    expect(result.groups[1].items).toHaveLength(18);
  });
  it('keeps independent links when several members of the same family match', async () => {
    const options = [
      { href: '/products/tee?item=blue-m', label: 'Blue · M', availability: 'in-stock' as const },
      { href: '/products/tee?item=blue-xl', label: 'Blue · XL', availability: 'out-of-stock' as const },
    ];
    const result = await loadStoreSearch('blue tee', { search: async () => [], visibleProducts: products,
      optionMatches: async () => [{ slug: 'tee', title: 'Tee', options }] });
    expect(result.count).toBe(1);
    expect(result.groups[0].items[0]).toEqual({ title: 'Tee', href: '/products/tee', parts: [], options });
  });
  it('does not present failed option discovery as a zero-result search', async () => {
    const result = await loadStoreSearch('tee XL', { search: async () => [], visibleProducts: products, optionMatches: async () => { throw Error('Commerce unavailable'); } });
    expect(result.state).toBe('unavailable'); expect(result.count).toBe(0); expect(result.optionMatches).toEqual([]);
  });
  it('bounds supplemental families and omits unsafe page destinations', async () => {
    const result = await loadStoreSearch('XL', { search: async () => [], visibleProducts: products,
      optionMatches: async () => [
        { slug: '../admin', title: 'Bad', options: [{ href: '/admin', label: 'XL', availability: 'in-stock' }] },
        { slug: 'no-options', title: 'Empty', options: [] },
        ...Array.from({ length: 22 }, (_, n) => ({ slug: `tee-${n}`, title: `Tee ${n}`,
          options: [{ href: `/products/tee-${n}?item=tee-${n}-XL`, label: 'XL', availability: 'in-stock' as const }] })),
      ],
    });
    expect(result.count).toBe(20); expect(result.limited).toBe(true);
    expect(result.groups[0].items[0].href).toBe('/products/tee-0?item=tee-0-XL');
    expect(JSON.stringify(result)).not.toMatch(/\/admin|no-options/);
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
