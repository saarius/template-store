import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ content: vi.fn(), catalog: vi.fn() }));
vi.mock('emdash', async original => ({ ...await original<typeof import('emdash')>(), getEmDashCollection: mocks.content }));
vi.mock('../../src/features/commerce-catalog/index.js', async original => ({ ...await original<typeof import('../../src/features/commerce-catalog/index.js')>(), readCommerceCatalog: mocks.catalog }));
vi.mock('../../src/features/store-shell/proof-demonstrations.js', () => ({ readProofDemonstrations: async () => null }));
import { loadSearchProductCatalog, loadVisibleStorefrontProductSlugs } from '../../src/features/store-shell/search-visibility.js';

describe('strict search visibility availability', () => {
  beforeEach(() => { mocks.content.mockReset().mockResolvedValue({ entries: [] }); mocks.catalog.mockReset().mockResolvedValue([]); });
  it('allows a genuinely empty published catalog', async () => {
    expect(await loadVisibleStorefrontProductSlugs({} as never, {}, { throwOnUnavailable: true })).toEqual(new Set());
  });
  it('shares only published, uniquely linked, visible families with the option fallback', async () => {
    mocks.content.mockImplementation(async name => ({ entries: name === 'products' ? [
      { id: 'tee', data: { id: 'page-tee', title: 'Native Tee' } },
      { id: 'unpriced', data: { id: 'page-unpriced', title: 'Do not show' } },
      { id: 'orphan', data: { id: 'page-orphan', title: 'No Commerce' } },
      { id: 'duplicate-a', data: { id: 'page-duplicate', title: 'Ambiguous A' } },
      { id: 'duplicate-b', data: { id: 'page-duplicate', title: 'Ambiguous B' } },
    ] : [] }));
    const variants = [{ id: 'tee-xl', selections: [['Size', 'XL']], availability: { status: 'out-of-stock', sellable: false } }];
    mocks.catalog.mockResolvedValue([
      { id: 'commerce-tee', page: 'page-tee', variants },
      { id: 'commerce-draft', page: 'page-unpublished', variants },
      { id: 'commerce-duplicate', page: 'page-duplicate', variants },
    ]);
    const result = await loadSearchProductCatalog({} as never, {}, { throwOnUnavailable: true });
    expect(result.visible).toEqual(new Set(['tee']));
    expect(result.products).toEqual([{ slug: 'tee', title: 'Native Tee', variants }]);
    expect(mocks.content).toHaveBeenCalledWith('products', { status: 'published' });
    expect(mocks.content).toHaveBeenCalledWith('categories', { status: 'published' });
    expect(mocks.catalog).toHaveBeenCalledOnce();
  });
  it('reports a failed Commerce catalog in strict mode while retaining the legacy fail-closed default', async () => {
    mocks.catalog.mockRejectedValue(Error('catalog unavailable'));
    await expect(loadVisibleStorefrontProductSlugs({} as never, {}, { throwOnUnavailable: true })).rejects.toThrow('catalog unavailable');
    expect(await loadVisibleStorefrontProductSlugs({} as never, {})).toEqual(new Set());
  });
  it('reports failed CMS product or collection reads in strict mode', async () => {
    for (const collection of ['products', 'categories']) {
      mocks.content.mockImplementation(async name => { if (name === collection) throw Error('content unavailable'); return { entries: [] }; });
      await expect(loadVisibleStorefrontProductSlugs({} as never, {}, { throwOnUnavailable: true })).rejects.toThrow('content unavailable');
    }
  });
});
