import type { CommerceCatalogSnapshot } from "../commerce-catalog/index.js";

/** Only canonical, same-origin product paths may reach browser markup. */
export function safeCartProductPath(value: unknown): string | null {
  return typeof value === "string" && value === value.trim() && /^\/products\/[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)
    ? value : null;
}

/** Entries must come from EmDash's published collection, never a draft query. */
export function attachCartProductPaths(
  snapshots: readonly CommerceCatalogSnapshot[],
  entries: readonly { id: string; data: Record<string, unknown> }[],
) {
  const paths = new Map<string, string | null>();
  for (const entry of entries) {
    const pageId = entry.data.id;
    const path = safeCartProductPath(`/products/${entry.id}`);
    if (typeof pageId !== "string" || !pageId || !path) continue;
    // An ambiguous CMS link is not a destination we can promise.
    paths.set(pageId, paths.has(pageId) ? null : path);
  }
  return snapshots.map(snapshot => ({
    ...snapshot,
    productPath: snapshot.found && snapshot.page &&
      (snapshot.price.listable || snapshot.availability.listable)
      ? paths.get(snapshot.page) ?? null : null,
  }));
}
