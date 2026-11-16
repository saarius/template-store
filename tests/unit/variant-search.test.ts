import { describe, expect, it } from 'vitest';
import { findSearchOptionMatches } from '../../src/features/store-shell/variant-search.js';
import type { PublicCommerceVariant } from '../../src/features/commerce-catalog/types.js';
const member = (id: string, size: string, status: PublicCommerceVariant['availability']['status'] = 'in-stock', color = 'Rust'): PublicCommerceVariant => ({
  id, sku: `BRB-TEE-${size}-${color}`, selections: [['Size', size], ['Color', color]],
  unitMinor: '2800', priceText: '$28.00', availability: { status, sellable: status !== 'out-of-stock' },
});
const products = [
  { slug: 'county-line-tee', title: 'County Line Tee', variants: [member('tee-m', 'M'), member('tee-xl', 'XL', 'out-of-stock')] },
  { slug: 'last-light-fleece', title: 'Last Light Fleece', variants: [member('fleece-xl', 'XL', 'available-on-backorder')] },
];

describe('published Commerce option search fallback', () => {
  it('finds a family and keeps its exact sold-out member identity', () => {
    expect(findSearchOptionMatches('tee XL', products)).toEqual([{
      slug: 'county-line-tee', title: 'County Line Tee', options: [{
        href: '/products/county-line-tee?item=tee-xl', label: 'Size: XL · Color: Rust', availability: 'out-of-stock',
      }],
    }]);
  });
  it('finds separate families by exact option value without calling backorder in-stock', () => {
    const result = findSearchOptionMatches('XL', products);
    expect(result.map(product => product.slug)).toEqual(['county-line-tee', 'last-light-fleece']);
    expect(result[1].options[0].availability).toBe('available-on-backorder');
  });
  it('normalizes case, compatible Unicode and word punctuation, not aliases or fuzzy guesses', () => {
    for (const query of ['  Tee   xl ', 'TEE ＸＬ', 'tee (XL)']) expect(findSearchOptionMatches(query, products)).toHaveLength(1);
    for (const query of ['tee', 'teexl', 'small', 'large', 'unknown XL', 'xxl', '!!!']) expect(findSearchOptionMatches(query, products)).toEqual([]);
    expect(findSearchOptionMatches('size M', products)[0].options[0].href).toContain('tee-m');
  });
  it('does not promise SKU lookup or replace native product-name search', () => {
    // Signed Commerce0.8.0 omits member SKUs; do not guess from names or IDs.
    expect(findSearchOptionMatches('BRB-TEE-XL-Rust', products)).toEqual([]);
    expect(findSearchOptionMatches('County Line Tee', products)).toEqual([]);
  });
  it('requires every query term to belong to the same member, not sibling combinations', () => {
    const catalog = [{ ...products[0], variants: [member('m-blue', 'M', 'in-stock', 'Blue'), member('xl-rust', 'XL')] }];
    expect(findSearchOptionMatches('tee XL blue', catalog)).toEqual([]);
    expect(findSearchOptionMatches('tee XL rust', catalog)[0].options[0].href).toContain('xl-rust');
  });
  it('groups several matches into one family while retaining each specific destination', () => {
    const result = findSearchOptionMatches('Rust', products);
    expect(result).toHaveLength(2); expect(result[0].options).toHaveLength(2);
    expect(result[0].options.map(option => option.href)).toEqual(['/products/county-line-tee?item=tee-m', '/products/county-line-tee?item=tee-xl']);
  });
  it('never constructs links from unsafe slugs or item IDs or outputs Commerce prices', () => {
    expect(findSearchOptionMatches('XL', [{ ...products[0], slug: '../admin' }])).toEqual([]);
    expect(findSearchOptionMatches('XL', [{ ...products[0], variants: [member('bad?item=else', 'XL')] }])).toEqual([]);
    expect(JSON.stringify(findSearchOptionMatches('XL', products))).not.toMatch(/2800|28.00|unitMinor|priceText/);
  });
});
