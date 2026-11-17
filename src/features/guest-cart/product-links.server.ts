import { getEmDashCollection } from "emdash";
import type { CommerceCatalogSnapshot } from "../commerce-catalog/index.js";
import { attachCartProductPaths } from "./product-links.js";

/** Optional published-page navigation must never hide Commerce's current cart facts. */
export async function linkPublishedCartProducts(snapshots: readonly CommerceCatalogSnapshot[]) {
  if (!snapshots.some(snapshot => snapshot.found && snapshot.page)) return snapshots;
  try {
    const { entries } = await getEmDashCollection<"products", Record<string, unknown>>("products", { status: "published" });
    return attachCartProductPaths(snapshots, entries);
  } catch {
    // No draft fallback, guessed slug, or second pricing authority when CMS is unavailable.
    return snapshots;
  }
}
