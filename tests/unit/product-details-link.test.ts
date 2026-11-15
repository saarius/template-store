import { describe, expect, it } from 'vitest';
import { summaryLinksToDetails } from '../../src/features/store-shell/product-details-link.js';

const link = { _type: 'link', _key: 'details', href: '#product-details' };
const span = { _type: 'span', text: 'Compare tee measurements', marks: ['details'] };
const block = { _type: 'block', children: [span], markDefs: [link] };

describe('native product details shortcut', () => {
  it('retains an actually rendered native shortcut instead of adding a duplicate', () => {
    expect(summaryLinksToDetails([block])).toBe(true);
    expect(summaryLinksToDetails([{ ...block, children: [{ ...span, marks: ['strong', 'details'] }] }])).toBe(true);
  });
  it('does not mistake an unused, empty or foreign link for navigation', () => {
    for (const candidate of [
      { ...block, children: [] },
      { ...block, children: [{ ...span, text: ' ' }] },
      { ...block, children: [{ ...span, marks: ['other'] }] },
      { ...block, markDefs: [{ ...link, href: '/other#product-details' }] },
      { ...block, markDefs: [{ ...link, _type: 'annotation' }] },
      { ...block, _type: 'productSpecs' },
    ]) expect(summaryLinksToDetails([candidate])).toBe(false);
  });
  it('tolerates absent and malformed optional CMS content', () => {
    for (const candidate of [undefined, null, {}, [], [null], [{ ...block, children: null }],
      [{ ...block, markDefs: [null] }], [{ ...block, children: [null, { ...span, marks: null }] }]]) {
      expect(summaryLinksToDetails(candidate)).toBe(false);
    }
  });
});
