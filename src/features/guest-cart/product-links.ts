import type { CommerceCatalogSnapshot } from "../commerce-catalog/index.js";
import { isSafeGuestCartProductId } from "./intent.js";

/** Only same-origin product paths and one explicit cart item may reach markup. */
export function safeCartProductPath(value: unknown): string | null {
  if (typeof value !== "string" || value !== value.trim()) return null;
  const match = /^(\/products\/[a-z0-9]+(?:-[a-z0-9]+)*)(?:\?item=([A-Za-z0-9._-]+))?$/u.exec(value);
  return match && (match[2] === undefined || isSafeGuestCartProductId(match[2])) ? value : null;
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
  return snapshots.map(snapshot => {
    const path = snapshot.found && snapshot.page &&
      (snapshot.price.listable || snapshot.availability.listable)
      ? paths.get(snapshot.page) ?? null : null;
    return {
      ...snapshot,
      // The item is public Commerce identity, never a label or saved price.
      productPath: path && isSafeGuestCartProductId(snapshot.id) ? `${path}?item=${snapshot.id}` : null,
    };
  });
}
