import { filterStorefrontSearchHits, renderHighlightedSnippetParts } from './search-visibility.js';

export interface StoreSearchHit {
  collection: string;
  id: string;
  slug: string | null;
  title?: string;
  snippet?: string;
  score: number;
}
export interface StoreSearchDependencies {
  search: (query: string) => Promise<readonly StoreSearchHit[]>;
  visibleProducts: () => Promise<ReadonlySet<string>>;
}
const scopes = [
  { collection: 'products', label: 'Gear' },
  { collection: 'categories', label: 'Collections' },
  { collection: 'pages', label: 'Field notes & guides' },
] as const;

export function searchResultHref(hit: StoreSearchHit): string | null {
  const slug = hit.slug || hit.id;
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) return null;
  if (hit.collection === 'products') return `/products/${slug}`;
  if (hit.collection === 'categories') return `/categories/${slug}`;
  if (hit.collection === 'pages') return slug === 'home' ? '/' : `/${slug}`;
  return null;
}

/** No prices from indexed text; Commerce visibility still decides which gear can be found. */
export async function loadStoreSearch(raw: string, dependencies: StoreSearchDependencies) {
  const query = raw.trim().slice(0, 120);
  const empty = { query, groups: [], count: 0, limited: false };
  if (!query) return { ...empty, state: 'idle' as const };
  if (query.length < 2) return { ...empty, state: 'short' as const };
  try {
    const hits = await dependencies.search(query);
    const visible = hits.some(hit => hit.collection === 'products') ? await dependencies.visibleProducts() : new Set<string>();
    const filtered = filterStorefrontSearchHits(hits, visible).filter(hit => searchResultHref(hit) !== null);
    const selected = filtered.slice(0, 20);
    const groups = scopes.map(scope => ({ ...scope, items: selected.filter(hit => hit.collection === scope.collection).map(hit => {
      const title = hit.title?.trim() || hit.slug || hit.id;
      const parts = renderHighlightedSnippetParts(hit.snippet);
      const redundant = parts.map(part => part.text).join('').trim().toLowerCase() === title.toLowerCase();
      return { title, href: searchResultHref(hit)!, parts: redundant ? [] : parts };
    }) })).filter(group => group.items.length > 0);
    return { query, groups, count: selected.length, limited: hits.length >= 20,
      state: selected.length ? 'results' as const : 'empty' as const };
  } catch {
    // A failed index or Commerce visibility lookup is not an empty catalog.
    return { ...empty, state: 'unavailable' as const };
  }
}
