import { describe, expect, it } from 'vitest';
import { collectionProductPath, resolveProductCollection } from '../../src/features/store-shell/product-collection.js';

const memberships = ['road-day', 'slow-camp'];
const resolve = (query: string, categories = memberships) => resolveProductCollection(categories, new URLSearchParams(query));

describe('product collection browsing context', () => {
  it('round-trips a collection card to a non-primary breadcrumb alongside an item selection', () => {
    const path = collectionProductPath('/products/glovebox-field-tote', 'slow-camp');
    expect(path).toBe('/products/glovebox-field-tote?collection=slow-camp');
    expect(resolve(`${path.split('?')[1]}&item=exact-id`)).toEqual({ slug: 'slow-camp', context: 'slow-camp' });
  });

  it.each(['', 'collection=', 'collection=other', 'collection=https://elsewhere.example/',
    'collection=slow-camp&collection=road-day', 'collection=slow-camp&collection=slow-camp'])('uses the default for absent or invalid context (%s)', query => {
    expect(resolve(query)).toEqual({ slug: 'road-day', context: undefined });
  });

  it('cannot create a breadcrumb for a product without membership', () => {
    expect(resolve('collection=slow-camp', [])).toEqual({ slug: undefined, context: undefined });
  });
});
