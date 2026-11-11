import { getEmDashReferences } from "emdash";
import type { MerchCollection } from "./merch-catalog.js";

/** Order already-filtered items by their published CMS slugs, never adding products. */
export async function orderCategoryItems<T>(slug: string, items: readonly T[], key: (item: T) => string): Promise<readonly T[]> {
  if (items.length < 2) return items;
  const ranks = new Map<string, number>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  try {
    do {
      // The SDK resolves published references for public requests and staged
      // references in edit/preview mode. Walk every page, not just the first 20.
      const page = await getEmDashReferences("categories", slug, "products", {
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
      if (page.error) return items;
      for (const entry of page.entries) {
        if (!ranks.has(entry.id)) ranks.set(entry.id, ranks.size);
      }
      cursor = page.nextCursor;
      if (cursor) {
        if (cursors.has(cursor)) return items;
        cursors.add(cursor);
      }
    } while (cursor);
  } catch {
    return items;
  }
  if (ranks.size === 0) return items;
  return [...items].sort((a, b) =>
    (ranks.get(key(a)) ?? Number.MAX_SAFE_INTEGER) - (ranks.get(key(b)) ?? Number.MAX_SAFE_INTEGER));
}

/** Starter editorial listings and merchant Commerce listings share the same order source. */
export async function orderCategoryProducts(category: MerchCollection): Promise<MerchCollection> {
  const items = await orderCategoryItems(category.slug, category.items, item => item.id);
  return items === category.items ? category : { ...category, items };
}
