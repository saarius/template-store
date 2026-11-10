import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";
import { attachCartProductPaths } from "../../../features/guest-cart/product-links.js";

import { readCommerceCatalogSnapshots } from "../../../features/commerce-catalog/index.js";
import { parseGuestCartSnapshotIds, projectGuestCartCatalogSnapshots } from "../../../features/guest-cart/index.js";

export const prerender = false;

function snapshotJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export const GET: APIRoute = async ({ url, locals, request }) => {
  const ids = parseGuestCartSnapshotIds(url.searchParams.get("ids"));
  if (ids === null) {
    return snapshotJson({ error: "invalid_ids" }, 400);
  }
  try {
    const snapshots = await readCommerceCatalogSnapshots(ids, { runtime: locals.emdash, request });
    let linked = snapshots;
    // Navigation is optional: a CMS read failure must not hide current prices
    // or discard a cart that Commerce can still resolve.
    if (snapshots.some(snapshot => snapshot.found && snapshot.page)) {
      try {
        const { entries } = await getEmDashCollection<"products", Record<string, unknown>>("products", { status: "published" });
        linked = attachCartProductPaths(snapshots, entries);
      } catch { /* Keep plain product names when published pages are unavailable. */ }
    }
    const products = projectGuestCartCatalogSnapshots(linked);
    if (products === null) {
      return snapshotJson(
        {
          error: "catalog_unavailable",
          message: "Current product details could not be loaded. Your cart was kept.",
        },
        503,
      );
    }
    return snapshotJson({ products });
  } catch {
    return snapshotJson(
      {
        error: "catalog_unavailable",
        message: "Current product details could not be loaded. Your cart was kept.",
      },
      503,
    );
  }
};
