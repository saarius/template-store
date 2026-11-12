import type { PublicCommerceProduct, PublicCommerceVariant } from "../commerce-catalog/types.js";

/** A family's default identifiers do not identify its selected member. */
export function productIdentifiers(
  product: Pick<PublicCommerceProduct, "sku" | "gtin" | "mpn" | "variants">,
  selectedMember: Pick<PublicCommerceVariant, "sku"> | null = null,
): { sku: string | null; gtin: string | null; mpn: string | null } {
  if (product.variants?.length) {
    // Older public projections omit member SKUs. GTIN/MPN are not projected per member.
    return { sku: selectedMember?.sku || null, gtin: null, mpn: null };
  }
  return { sku: product.sku || null, gtin: product.gtin || null, mpn: product.mpn || null };
}
