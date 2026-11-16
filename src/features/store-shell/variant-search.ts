import type { PublicCommerceVariant } from '../commerce-catalog/types.js';
import { isSafeGuestCartProductId } from '../guest-cart/intent.js';

export interface SearchOptionMatch {
  slug: string;
  title: string;
  options: { href: string; label: string; availability: PublicCommerceVariant['availability']['status'] }[];
}

const words = (value: string): string[] => value.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/**
 * A narrow fallback, not a second content index: all query words must match one
 * member, and a complete option value must be present. The caller
 * supplies only listable Commerce members linked to published, visible CMS pages.
 * Never combine the size of one member with the color of its sibling.
 */
export function findSearchOptionMatches(query: string, products: readonly {
  slug: string; title: string; variants: readonly PublicCommerceVariant[];
}[]): SearchOptionMatch[] {
  const tokens = words(query);
  if (!tokens.length) return [];
  return products.flatMap(product => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)) return [];
    const options = product.variants.filter(member => {
      if (!isSafeGuestCartProductId(member.id)) return false;
      const values = member.selections.map(([, value]) => words(value));
      const mentionsValue = values.some(value => value.length > 0 && value.every(token => tokens.includes(token)));
      if (!mentionsValue) return false;
      const haystack = new Set(words([product.title, ...member.selections.flat()].join(' ')));
      return tokens.every(token => haystack.has(token));
    }).map(member => ({
      href: `/products/${product.slug}?item=${member.id}`,
      label: member.selections.map(([name, value]) => `${name}: ${value}`).join(' · ') || member.sku || 'View option',
      availability: member.availability.status,
    }));
    return options.length ? [{ slug: product.slug, title: product.title, options }] : [];
  });
}
