import { beforeEach, describe, expect, it, vi } from "vitest";

const { catalog, collection } = vi.hoisted(() => ({ catalog: vi.fn(), collection: vi.fn() }));
vi.mock("emdash", () => ({ getEmDashCollection: collection }));
vi.mock("../../src/features/commerce-catalog/index.js", () => ({ readCommerceCatalogSnapshots: catalog }));
import { GET } from "../../src/pages/api/guest-cart/snapshot.js";

const product = {
  id: "bandana", found: true, name: "Switchback Bandana", sku: "BRB-BANDANA", page: "page-bandana",
  price: { listable: true, regularText: "$16.00", saleText: null, unitMinor: "1600" },
  availability: { status: "in-stock", sellable: true, listable: true },
};
const request = () => GET({
  url: new URL("https://shop.example.test/api/guest-cart/snapshot?ids=bandana"),
  locals: {}, request: new Request("https://shop.example.test/api/guest-cart/snapshot?ids=bandana"),
} as Parameters<typeof GET>[0]);

describe("guest cart snapshot route", () => {
  beforeEach(() => { vi.resetAllMocks(); catalog.mockResolvedValue([product]); });
  it("rejects unsafe or excessive IDs without reading the catalog", async () => {
    const response = await GET({
      url: new URL("http://localhost/api/guest-cart/snapshot?ids=../etc/passwd"),
    } as Parameters<typeof GET>[0]);
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "invalid_ids" });
    expect(catalog).not.toHaveBeenCalled();
  });
  it("uses only the published CMS collection and keeps Commerce facts", async () => {
    collection.mockResolvedValue({ entries: [{ id: "switchback-bandana", data: { id: "page-bandana" } }] });
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(collection).toHaveBeenCalledWith("products", { status: "published" });
    expect((await response.json()).products[0]).toMatchObject({ id: "bandana", sku: "BRB-BANDANA", productPath: "/products/switchback-bandana", price: product.price });
  });
  it("keeps prices and plain names when the CMS lookup fails or has no published match", async () => {
    for (const failure of [true, false]) {
      if (failure) collection.mockRejectedValueOnce(new Error("CMS unavailable"));
      else collection.mockResolvedValueOnce({ entries: [] });
      const response = await request();
      expect(response.status).toBe(200);
      expect((await response.json()).products[0]).toMatchObject({ name: product.name, productPath: null, price: product.price });
    }
  });
  it("does not query CMS for missing products, and still fails closed when Commerce fails", async () => {
    catalog.mockResolvedValueOnce([{ id: "bandana", found: false }]);
    expect((await (await request()).json()).products).toEqual([{ id: "bandana", found: false }]);
    expect(collection).not.toHaveBeenCalled();
    catalog.mockRejectedValueOnce(new Error("Commerce unavailable"));
    expect((await request()).status).toBe(503);
  });
});
