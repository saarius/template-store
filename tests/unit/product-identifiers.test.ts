import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { productIdentifiers } from "../../src/features/store-shell/product-identifiers.js";
import { variantPickerView, type VariantPickerMember } from "../../src/features/store-shell/variant-picker.js";
import type { PublicCommerceVariant } from "../../src/features/commerce-catalog/types.js";

const option = (id: string, sku?: string): PublicCommerceVariant => ({
  id, ...(sku ? { sku } : {}), selections: [["Size", id]], unitMinor: "3400", priceText: "$34.00",
  availability: { status: "in-stock", sellable: true },
});
const simple = { sku: "TEE-M", gtin: "012345678905", mpn: "TEE-M-PART" };
const family = { ...simple, variants: [option("M", "TEE-M"), option("L", "TEE-L"), option("XL")] };

describe("visible product identifiers", () => {
  it("keeps a simple product's own identifiers, including an empty variants list", () => {
    expect(productIdentifiers(simple)).toEqual(simple);
    expect(productIdentifiers({ ...simple, variants: [] })).toEqual(simple);
    expect(productIdentifiers({ sku: "" })).toEqual({ sku: null, gtin: null, mpn: null });
  });

  it.each(family.variants)("shows only the selected member's SKU ($id), never default GTIN/MPN", member => {
    expect(productIdentifiers(family, member)).toEqual({ sku: member.sku ?? null, gtin: null, mpn: null });
  });

  it("omits identifiers for a stale/incomplete selection and an older member projection", () => {
    expect(productIdentifiers(family)).toEqual({ sku: null, gtin: null, mpn: null });
    expect(productIdentifiers(family, option("L"))).toEqual({ sku: null, gtin: null, mpn: null });
  });

  it("retains only the matching picker's optional SKU through known, unknown and missing combinations", () => {
    const members: VariantPickerMember[] = family.variants.map(member => ({
      id: member.id, sku: member.sku, values: Object.fromEntries(member.selections), price: member.priceText,
      availability: member.availability.status, status: "In stock", sellable: true,
    }));
    expect(variantPickerView(members, { Size: "L" }).member?.sku).toBe("TEE-L");
    expect(variantPickerView(members, { Size: "XL" }).member?.sku).toBeUndefined();
    expect(variantPickerView(members, { Size: "removed" }).member).toBeNull();
  });

  it("wires the same server-selected SKU into the row and exact-member browser updates", () => {
    const page = readFileSync(new URL("../../src/pages/products/[id].astro", import.meta.url), "utf8");
    expect(page).toContain("productIdentifiers(linkedProduct, selectedVariant)");
    expect(page).toContain('data-product-sku={identifiers.sku ?? ""} hidden={!identifiers.sku}');
    expect(page).toContain('data-product-gtin={identifiers.gtin}');
    expect(page).toContain('data-product-mpn={identifiers.mpn}');
    expect(page).toContain('...(member.sku ? { sku: member.sku } : {})');
    expect(page).toContain('const selectedSku = view.member?.sku ?? "";');
    expect(page).toContain('sku.textContent = selectedSku ? `SKU ${selectedSku}` : "";');
    expect(page).not.toContain('data-product-sku={linkedProduct.sku}');
  });
});
