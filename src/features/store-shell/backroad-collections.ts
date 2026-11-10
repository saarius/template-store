import type { PublicCommerceProduct } from "../commerce-catalog/index.js";
import { canonicalProductPath, commercePageLinks, readProductEntries, validProductSlug } from "./product-routes.js";

type Entry = { id: string; data: Record<string, unknown> };
export type ShopCollection = {
  slug: string;
  title: string;
  description: string;
  products: PublicCommerceProduct[];
};

/** Onward discovery is shared published membership, not a second recommendation catalog. */
export function relatedShopProducts(currentId: string, groups: readonly ShopCollection[]) {
  const collections = groups.filter(group => group.products.some(product => product.id === currentId));
  const seen = new Set([currentId]);
  const products = collections.flatMap(group => group.products).filter(product => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  }).slice(0, 3);
  return { collections, products };
}

/** A secondary catalog failure is not a successful empty related-products list. */
export async function readRelatedShopProducts(currentId: string, entries: readonly Entry[], categories: readonly Entry[],
  readCatalog: () => Promise<PublicCommerceProduct[]>) {
  try {
    const { groups, paths } = shopCollections(entries, categories, await readCatalog());
    return { available: true as const, ...relatedShopProducts(currentId, groups), paths };
  } catch {
    return { available: false as const };
  }
}

/** Published CMS membership selects products; Commerce alone supplies sale facts. */
export function shopCollections(entries: readonly Entry[], categories: readonly Entry[], catalog: PublicCommerceProduct[]) {
  const links = readProductEntries(entries, categories, commercePageLinks(catalog));
  const groups: ShopCollection[] = categories.flatMap(entry => {
    const title = typeof entry.data.title === "string" ? entry.data.title.trim() : "";
    if (!validProductSlug(entry.id) || !title) return [];
    const ids = new Set(links.products.filter(product => product.categorySlugs.includes(entry.id)).map(product => product.commerceItemId));
    return [{ slug: entry.id, title,
      description: typeof entry.data.description === "string" ? entry.data.description.trim() : "",
      products: catalog.filter(product => ids.has(product.id)) }];
  }).sort((a, b) => a.title.localeCompare(b.title));
  return {
    groups,
    paths: new Map(links.products.map(product => [product.commerceItemId, canonicalProductPath(product.slug)])),
  };
}
