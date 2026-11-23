import { filterStorefrontSearchHits, renderHighlightedSnippetParts } from './search-visibility.js';
import { mayAskForSize, type SearchOptionMatch } from './variant-search.js';

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
  /** Exact public options on published, Commerce-visible products. */
  optionMatches?: (query: string) => Promise<readonly SearchOptionMatch[]>;
  /** Optional published opening paragraphs, not another search or match-location claim. */
  fieldNotePreviews?: (slugs: readonly string[]) => Promise<ReadonlyMap<string, string>>;
}
interface SearchResultItem {
  title: string;
  href: string;
  parts: ReturnType<typeof renderHighlightedSnippetParts>;
  options?: SearchOptionMatch['options'];
}
const resultLimit = 20;
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

function snippetParts(hit: StoreSearchHit) {
  const title = hit.title?.trim() || hit.slug || hit.id;
  const parts = renderHighlightedSnippetParts(hit.snippet);
  return parts.map(part => part.text).join('').trim().toLowerCase() === title.toLowerCase() ? [] : parts;
}

/** Keep previews compact without splitting a Unicode code point or inventing a query highlight. */
export function compactSearchPreview(raw: string): string {
  const text = raw.replace(/\s+/gu, ' ').trim();
  const characters = Array.from(text);
  if (characters.length <= 240) return text;
  const prefix = characters.slice(0, 239).join('');
  const boundary = prefix.lastIndexOf(' ');
  return (boundary > 120 ? prefix.slice(0, boundary) : prefix).trimEnd() + '…';
}

/** No prices from indexed text; Commerce visibility still decides which gear can be found. */
export async function loadStoreSearch(raw: string, dependencies: StoreSearchDependencies) {
  const query = raw.trim().slice(0, 120);
  const empty = { query, groups: [], optionMatches: [] as readonly SearchOptionMatch[], count: 0, limited: false };
  if (!query) return { ...empty, state: 'idle' as const };
  if (query.length < 2) return { ...empty, state: 'short' as const };
  try {
    const hits = await dependencies.search(query);
    const visible = hits.some(hit => hit.collection === 'products') ? await dependencies.visibleProducts() : new Set<string>();
    const filtered = filterStorefrontSearchHits(hits, visible).filter(hit => searchResultHref(hit) !== null);
    const selected = filtered.slice(0, resultLimit);
    const indexedProducts = new Set(selected.filter(hit => hit.collection === 'products').map(hit => hit.slug || hit.id));
    const matches = new Map<string, SearchOptionMatch>();
    const additions: SearchOptionMatch[] = [];
    let optionsLimited = false;
    if (dependencies.optionMatches && (!selected.length || mayAskForSize(query))) {
      let candidates: readonly SearchOptionMatch[] = [];
      try { candidates = await dependencies.optionMatches(query); }
      catch (error) {
        // Existing native results are still useful if optional enrichment fails.
        if (!selected.length) throw error;
      }
      for (const match of candidates) {
        if (!match.options.length || matches.has(match.slug) || !searchResultHref({
          collection: 'products', id: match.slug, slug: match.slug, score: 0,
        })) continue;
        if (!indexedProducts.has(match.slug)) {
          if (selected.length + additions.length >= resultLimit) { optionsLimited = true; continue; }
          additions.push(match);
        }
        matches.set(match.slug, match);
      }
    }
    const previewSlugs = [...new Set(selected.filter(hit => hit.collection === 'pages' &&
      /^field-note-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(hit.slug ?? '') && snippetParts(hit).length === 0)
      .map(hit => hit.slug!))];
    // Preview failure must not turn usable index results into a search outage.
    let previews: ReadonlyMap<string, string> = new Map();
    if (previewSlugs.length && dependencies.fieldNotePreviews) {
      try { previews = await dependencies.fieldNotePreviews(previewSlugs); } catch { /* Titles still work. */ }
    }
    const groups = scopes.map(scope => {
      const items = selected.filter(hit => hit.collection === scope.collection).map<SearchResultItem>(hit => {
        const slug = hit.slug || hit.id;
        const title = hit.title?.trim() || slug;
        const parts = snippetParts(hit);
        const preview = hit.collection === 'pages' && hit.slug && previewSlugs.includes(hit.slug)
          ? compactSearchPreview(previews.get(hit.slug) ?? '') : '';
        const options = hit.collection === 'products' ? matches.get(slug)?.options : undefined;
        return {
          title,
          href: options?.length === 1 ? options[0].href : searchResultHref(hit)!,
          parts: parts.length || !preview ? parts : [{ text: preview, highlighted: false }],
          ...(options ? { options } : {}),
        };
      });
      if (scope.collection === 'products') items.push(...additions.map(match => ({
        title: match.title,
        href: match.options.length === 1 ? match.options[0].href : `/products/${match.slug}`,
        parts: [], options: match.options,
      })));
      return { ...scope, items };
    }).filter(group => group.items.length > 0);
    const count = selected.length + additions.length;
    return { query, groups, optionMatches: [...matches.values()], count, limited: hits.length >= resultLimit || optionsLimited,
      state: count ? 'results' as const : 'empty' as const };
  } catch {
    // A failed index or Commerce visibility lookup is not an empty catalog.
    return { ...empty, state: 'unavailable' as const };
  }
}
