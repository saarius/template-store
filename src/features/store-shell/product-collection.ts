/** Add browsing context to a canonical product path supplied by the catalog. */
export function collectionProductPath(path: string, collection: string): string {
  return `${path}?${new URLSearchParams({ collection })}`;
}

/** A breadcrumb may only point to a published collection this product belongs to. */
export function resolveProductCollection(categorySlugs: readonly string[], search: URLSearchParams) {
  const [requested, ...duplicates] = search.getAll('collection');
  const context = requested && !duplicates.length && categorySlugs.includes(requested) ? requested : undefined;
  return { slug: context ?? categorySlugs[0], context };
}
