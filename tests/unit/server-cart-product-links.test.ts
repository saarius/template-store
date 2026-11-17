import { beforeEach, describe, expect, it, vi } from "vitest";

const { catalog, collection, readCart } = vi.hoisted(() => ({ catalog: vi.fn(), collection: vi.fn(), readCart: vi.fn() }));
vi.mock("emdash", () => ({ getEmDashCollection: collection }));
vi.mock("../../src/features/commerce-catalog/index.js", () => ({ readCommerceCatalogSnapshots: catalog }));
vi.mock("../../src/features/guest-cart/server-cart.js", () => ({ readServerCart: readCart, cartErrorText: () => "Cart unavailable" }));
import { loadServerCartPage } from "../../src/features/guest-cart/server-view.js";
import type { ServerCartContext } from "../../src/features/guest-cart/server-cart.js";

const snapshots = ["m", "xl"].map(size => ({
  id: `fleece-${size}`, found: true, name: `Fleece — ${size.toUpperCase()}`, sku: `FLEECE-${size.toUpperCase()}`, page: "page-fleece",
  price: { listable: true, regularText: "$68.00", saleText: null, unitMinor: "6800" },
  availability: { status: size === "xl" ? "available-on-backorder" : "in-stock", sellable: true, listable: true },
}));
const url = new URL("https://shop.example.test/cart");
const ctx = { locals: { emdash: {} }, request: new Request(url), url } as ServerCartContext;

function expectRetainedFacts(page: Awaited<ReturnType<typeof loadServerCartPage>>) {
  expect(page.view.lines.map(line => [line.id, line.name, line.quantity, line.regularText])).toEqual([
    ["fleece-m", "Fleece — M", 2, "$68.00"], ["fleece-xl", "Fleece — XL", 1, "$68.00"],
  ]);
  expect(page.view.subtotalText).toBe("$204.00");
  expect(page.view.snapshotError).toBeFalsy();
}

describe("native cart published product navigation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    catalog.mockResolvedValue(snapshots);
    collection.mockResolvedValue({ entries: [{ id: "last-light-fleece", data: { id: "page-fleece" } }] });
    readCart.mockResolvedValue({ ok: true, cart: { lines: [{ catalogItemId: "fleece-m", quantity: 2 }, { catalogItemId: "fleece-xl", quantity: 1 }], itemCount: 3 } });
  });
  it("joins only published CMS paths and preserves exact selected-member identities", async () => {
    const page = await loadServerCartPage(ctx, true);
    expect(collection).toHaveBeenCalledExactlyOnceWith("products", { status: "published" });
    expect(catalog).toHaveBeenCalledExactlyOnceWith(["fleece-m", "fleece-xl"], { runtime: ctx.locals.emdash, request: ctx.request });
    expect(page.view.lines.map(line => line.productPath)).toEqual([
      "/products/last-light-fleece?item=fleece-m", "/products/last-light-fleece?item=fleece-xl",
    ]);
    expectRetainedFacts(page);
  });
  it.each(["unavailable", "unmatched", "ambiguous", "unsafe"])("keeps plain names and authoritative prices when published links are %s", async failure => {
    if (failure === "unavailable") collection.mockRejectedValue(new Error("CMS unavailable"));
    else collection.mockResolvedValue({ entries: failure === "unmatched" ? [] : failure === "ambiguous"
      ? [{ id: "one", data: { id: "page-fleece" } }, { id: "two", data: { id: "page-fleece" } }]
      : [{ id: "../admin", data: { id: "page-fleece" } }] });
    const page = await loadServerCartPage(ctx, true);
    expectRetainedFacts(page);
    expect(page.view.lines.every(line => line.productPath === null)).toBe(true);
  });
  it("does not turn missing Commerce items into CMS-backed shopping facts", async () => {
    catalog.mockResolvedValue([{ id: "fleece-m", found: false }, { id: "fleece-xl", found: false }]);
    const page = await loadServerCartPage(ctx, true);
    expect(collection).not.toHaveBeenCalled();
    expect(page.view.lines.every(line => !line.productPath && !line.sellable)).toBe(true);
  });
  it("avoids catalog and CMS work for an empty cart", async () => {
    readCart.mockResolvedValue({ ok: false, error: { code: "NO_CART" } });
    expect((await loadServerCartPage(ctx, true)).view.empty).toBe(true);
    expect(catalog).not.toHaveBeenCalled();
    expect(collection).not.toHaveBeenCalled();
  });
  it("keeps the Commerce failure boundary instead of inventing CMS prices", async () => {
    catalog.mockRejectedValue(new Error("Catalog unavailable"));
    const page = await loadServerCartPage(ctx, true);
    expect(page.view.snapshotError).toBeTruthy();
    expect(collection).not.toHaveBeenCalled();
    expect(page.view.lines.every(line => !line.productPath)).toBe(true);
  });
});
