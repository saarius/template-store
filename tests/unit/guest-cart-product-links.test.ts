import { describe, expect, it } from "vitest";
import { attachCartProductPaths, safeCartProductPath } from "../../src/features/guest-cart/product-links.js";
import { projectGuestCartCatalogSnapshot, presentGuestCart } from "../../src/features/guest-cart/present.js";

const product = {
  id: "tee-l", found: true as const, name: "Wrong Turn Tee — L", sku: "",
  page: "page-tee", fulfillment: "physical" as const,
  price: { listable: true, regularText: "$34.00", saleText: null, unitMinor: "3400" },
  availability: { status: "in-stock", sellable: true, listable: true },
};
const published = [{ id: "wrong-turn-tee", data: { id: "page-tee" } }];

describe("cart product rediscovery", () => {
  it("links each member to its parent's published page without changing member identity or totals", () => {
    const [linked] = attachCartProductPaths([product], published);
    const projected = projectGuestCartCatalogSnapshot(linked)!;
    const view = presentGuestCart({ intent: { version: 1, lines: [{ id: "tee-l", quantity: 2 }] }, snapshots: [projected] });
    expect(view.lines[0]).toMatchObject({ id: "tee-l", name: product.name, productPath: "/products/wrong-turn-tee?item=tee-l", lineTotalText: "$68.00" });
    expect(view.subtotalText).toBe("$68.00");
  });

  it("omits paths for missing pages, ambiguous links, unsafe slugs and unlisted products", () => {
    for (const entries of [[], [...published, { id: "other-tee", data: { id: "page-tee" } }], [{ id: "../private", data: { id: "page-tee" } }]]) {
      expect(attachCartProductPaths([product], entries)[0]?.productPath).toBeNull();
    }
    expect(attachCartProductPaths([{ id: "gone", found: false }], published)[0]?.productPath).toBeNull();
    expect(attachCartProductPaths([{ ...product, price: { ...product.price, listable: false }, availability: { ...product.availability, listable: false } }], published)[0]?.productPath).toBeNull();
    expect(attachCartProductPaths([{ ...product, availability: { ...product.availability, status: "out-of-stock", sellable: false } }], published)[0]?.productPath).toBe("/products/wrong-turn-tee?item=tee-l");
  });

  it("allows only canonical same-origin product paths at the browser boundary", () => {
    for (const path of ["https://example.test/products/tee", "//evil.test/products/tee", "/products/../admin", "/products/%2e%2e", "/products/tee?next=evil", "/products/tee?item=tee-l&next=evil", "/products/tee?item=tee-l&item=tee-m", "/products/tee?item=", "/products/tee?item=%2Fprivate", "/products/tee?item=a..b", `/products/tee?item=${"a".repeat(129)}`, "/products/tee#x", "/products/tee/", "javascript:alert(1)", "/products/tee\" onclick=\"bad", null]) {
      expect(safeCartProductPath(path)).toBeNull();
      expect(projectGuestCartCatalogSnapshot({ ...product, productPath: path })).toMatchObject({ productPath: null });
    }
    expect(projectGuestCartCatalogSnapshot({ ...product, productPath: "/products/wrong-turn-tee" })).toMatchObject({ productPath: "/products/wrong-turn-tee" });
    expect(projectGuestCartCatalogSnapshot({ ...product, productPath: "/products/wrong-turn-tee?item=tee-l" })).toMatchObject({ productPath: "/products/wrong-turn-tee?item=tee-l" });
    expect(attachCartProductPaths([{ ...product, id: "unsafe/id" }], published)[0]?.productPath).toBeNull();
    expect(projectGuestCartCatalogSnapshot(product)).toMatchObject({ productPath: null });
  });
});
