import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMERCE_RUNTIME_ID } from "../../src/features/commerce-profile/selected.js";
import {
  evaluatePublicBoundary,
  slashlessRedirectPath,
} from "../../src/features/security/public-boundary.js";
import {
  PLAYGROUND_DEMO_SESSION_ENDPOINT,
  SHOPPER_CATALOG_SNAPSHOT_BATCH_SIZE,
  SHOPPER_ORDERS_ENDPOINT,
  SHOPPER_PROFILE_ENDPOINT,
  SHOPPER_SESSION_STORAGE_KEY,
  SHOPPER_SIGN_IN_START_ENDPOINT,
  SHOPPER_SIGN_IN_VERIFY_ENDPOINT,
  SHOPPER_SIGN_OUT_ENDPOINT,
  clearStoredShopperSession,
  collectOrderCatalogSnapshotBatches,
  formatOrderMoney,
  isValidShopperSessionToken,
  readStoredShopperSession,
  resolveOrderLinePresentation,
  saveStoredShopperSession,
  unwrapPluginEnvelope,
  type ShopperOrderCatalogSnapshot,
  type ShopperOrderItem,
  type ShopperSessionStorage,
} from "../../src/features/shopper-account/index.js";
import {
  fetchOrderCatalogSnapshots,
  renderOrderItemMarkup,
} from "../../src/features/shopper-account/shopper-account-client.js";

const root = resolve(import.meta.dirname, "../..");

function createMemoryStorage(): ShopperSessionStorage {
  const store = new Map<string, string>();
  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

describe("shopper-account browser session and public routes", () => {
  it("exposes exact Commerce public account routes and demo session route", () => {
    expect(SHOPPER_SIGN_IN_START_ENDPOINT).toBe(
      `/_emdash/api/plugins/${COMMERCE_RUNTIME_ID}/account/sign-in/start`,
    );
    expect(SHOPPER_SIGN_IN_VERIFY_ENDPOINT).toBe(
      `/_emdash/api/plugins/${COMMERCE_RUNTIME_ID}/account/sign-in/verify`,
    );
    expect(SHOPPER_SIGN_OUT_ENDPOINT).toBe(
      `/_emdash/api/plugins/${COMMERCE_RUNTIME_ID}/account/sign-out`,
    );
    expect(SHOPPER_ORDERS_ENDPOINT).toBe(
      `/_emdash/api/plugins/${COMMERCE_RUNTIME_ID}/account/orders`,
    );
    expect(SHOPPER_PROFILE_ENDPOINT).toBe(
      `/_emdash/api/plugins/${COMMERCE_RUNTIME_ID}/account/profile`,
    );
    expect(PLAYGROUND_DEMO_SESSION_ENDPOINT).toBe("/api/account/demo-session");
  });

  it("validates, stores, expires, and clears browser shopper sessions", () => {
    const storage = createMemoryStorage();
    const validToken = "csess_1234567890abcdef.1234567890abcdef1234567890abcdef";
    expect(isValidShopperSessionToken(validToken)).toBe(true);
    expect(isValidShopperSessionToken("invalid-token")).toBe(false);

    const saved = saveStoredShopperSession(
      {
        sessionId: "csess_1234567890abcdef",
        sessionToken: validToken,
        email: "Shopper@Example.com",
        expiresAt: 2_000,
      },
      storage,
    );
    expect(saved).toBe(true);

    const active = readStoredShopperSession(storage, 1_500);
    expect(active).toEqual({
      sessionId: "csess_1234567890abcdef",
      sessionToken: validToken,
      email: "shopper@example.com",
      expiresAt: 2_000,
    });

    const expired = readStoredShopperSession(storage, 2_000);
    expect(expired).toBeNull();
    expect(storage.getItem(SHOPPER_SESSION_STORAGE_KEY)).toBeNull();

    saveStoredShopperSession(
      {
        sessionId: "csess_1234567890abcdef",
        sessionToken: validToken,
        email: "shopper@example.com",
        expiresAt: 3_000,
      },
      storage,
    );
    clearStoredShopperSession(storage);
    expect(readStoredShopperSession(storage, 1_500)).toBeNull();
  });

  it("formats USD order money and unwraps EmDash plugin envelopes", () => {
    expect(formatOrderMoney({ currency: "USD", minor: "3800" })).toBe("$38.00");
    expect(formatOrderMoney({ currency: "EUR", minor: "3800" })).toBe("$0.00");

    expect(
      unwrapPluginEnvelope({
        success: true,
        data: { ok: true, orders: [] },
      }),
    ).toEqual({ ok: true, orders: [] });
    expect(
      unwrapPluginEnvelope({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sign in required." },
      }),
    ).toEqual({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Sign in required." },
    });
  });

  it("keeps the starter Cloudflare boundary closed to legacy Node account APIs", () => {
    expect(slashlessRedirectPath("/account/")).toBe("/account");
    expect(evaluatePublicBoundary("GET", "/account").allowed).toBe(true);
    expect(evaluatePublicBoundary("POST", SHOPPER_SIGN_IN_START_ENDPOINT).allowed).toBe(false);
    expect(evaluatePublicBoundary("GET", SHOPPER_ORDERS_ENDPOINT).allowed).toBe(false);
    expect(evaluatePublicBoundary("POST", "/api/account/demo-session").allowed).toBe(false);
    expect(evaluatePublicBoundary("GET", "/api/proof/shopper-account").allowed).toBe(false);
  });

  it("resolves product thumbnails, SKU badges, and variant metadata from catalog snapshots and order lines without guessing missing media", () => {
    const demoShirt = resolveOrderLinePresentation(
      {
        catalogItemId: "demo-hosted-shirt",
        name: "Dinkus Demo Heavyweight T-Shirt",
        quantity: 1,
        unitPrice: { currency: "USD", minor: "3800" },
      },
      { playgroundMode: true },
    );
    expect(demoShirt).toEqual({
      catalogItemId: "demo-hosted-shirt",
      name: "Dinkus Demo Heavyweight T-Shirt",
      quantity: 1,
      unitPriceText: "$38.00",
      thumbnailUrl: "/images/products/shirt.svg",
      thumbnailAlt: "Dinkus Demo Heavyweight T-Shirt thumbnail",
      sku: "DEMO-HOSTED-SHIRT",
      variantLabel: "Heavyweight Cotton · Regular Fit",
      fulfillmentLabel: "Physical",
    });

    // Outside playgroundMode, seeded demo placeholders are not injected for bare order lines
    const demoShirtShippingMode = resolveOrderLinePresentation({
      catalogItemId: "demo-hosted-shirt",
      name: "Dinkus Demo Heavyweight T-Shirt",
      quantity: 1,
      unitPrice: { currency: "USD", minor: "3800" },
    });
    expect(demoShirtShippingMode.thumbnailUrl).toBeNull();
    expect(demoShirtShippingMode.sku).toBeNull();
    expect(demoShirtShippingMode.variantLabel).toBeNull();

    const variantChoiceOrder = {
      choices: [
        {
          productId: "demo-hosted-hoodie",
          catalogItemId: "demo-hosted-hoodie-m",
          selections: [
            {
              optionId: "size",
              optionLabel: "Size",
              valueId: "m",
              valueLabel: "Medium",
            },
          ],
          fulfillment: "physical" as const,
        },
      ],
    };
    const snapshot: ShopperOrderCatalogSnapshot = {
      id: "demo-hosted-hoodie-m",
      found: true,
      name: "Dinkus Demo Fleece Hoodie",
      sku: "DEMO-HOSTED-HOODIE-M",
      fulfillment: "physical",
      thumbnail: {
        src: "/images/products/hoodie.svg",
        alt: "Dinkus Demo Fleece Hoodie front view",
      },
    };
    const hoodieVariant = resolveOrderLinePresentation(
      {
        catalogItemId: "demo-hosted-hoodie-m",
        name: "Dinkus Demo Fleece Hoodie",
        quantity: 2,
        unitPrice: { currency: "USD", minor: "6400" },
      },
      { order: variantChoiceOrder, snapshot },
    );
    expect(hoodieVariant).toEqual({
      catalogItemId: "demo-hosted-hoodie-m",
      name: "Dinkus Demo Fleece Hoodie",
      quantity: 2,
      unitPriceText: "$64.00",
      thumbnailUrl: "/images/products/hoodie.svg",
      thumbnailAlt: "Dinkus Demo Fleece Hoodie front view",
      sku: "DEMO-HOSTED-HOODIE-M",
      variantLabel: "Size: Medium",
      fulfillmentLabel: "Physical",
    });

    // Non-demo merchant item without media or option selections renders null thumbnail and no guessed variant badge
    const merchantNoMedia = resolveOrderLinePresentation(
      {
        catalogItemId: "merchant-jacket-m",
        name: "Field Jacket",
        quantity: 1,
        unitPrice: { currency: "USD", minor: "12000" },
      },
      {
        snapshot: {
          id: "merchant-jacket-m",
          found: true,
          name: "Field Jacket",
          sku: "MERCHANT-JACKET-M",
          fulfillment: "physical",
          thumbnail: null,
        },
      },
    );
    expect(merchantNoMedia).toEqual({
      catalogItemId: "merchant-jacket-m",
      name: "Field Jacket",
      quantity: 1,
      unitPriceText: "$120.00",
      thumbnailUrl: null,
      thumbnailAlt: "Field Jacket thumbnail",
      sku: "MERCHANT-JACKET-M",
      variantLabel: null,
      fulfillmentLabel: "Physical",
    });

    const unmappedNoMeta = resolveOrderLinePresentation({
      catalogItemId: "custom-unmapped-item",
      name: "Mystery Parcel",
      quantity: 1,
      unitPrice: { currency: "USD", minor: "1500" },
      thumbnailUrl: "javascript:alert(1)",
    });
    expect(unmappedNoMeta.thumbnailUrl).toBeNull();
    expect(unmappedNoMeta.sku).toBeNull();
    expect(unmappedNoMeta.variantLabel).toBeNull();
  });

  it("renders thumbnail, missing-media placeholder, and variant metadata on .account-order-card__lines", () => {
    const order: ShopperOrderItem = {
      orderId: "ord_demo_shopper_1001",
      receiptId: "rcpt_demo_shopper_1001",
      number: 1001,
      status: "processing",
      paidAt: "2026-10-20T12:00:00.000Z",
      total: { currency: "USD", minor: "3800" },
      lines: [
        {
          catalogItemId: "demo-hosted-shirt",
          name: "Dinkus Demo Heavyweight T-Shirt",
          quantity: 1,
          unitPrice: { currency: "USD", minor: "3800" },
        },
      ],
      delivery: {
        name: "Demo Shopper",
        line1: "742 Evergreen Terrace",
        city: "Springfield",
        region: "OR",
        postalCode: "97477",
        country: "US",
      },
      phone: "555-0199",
    };
    const snapshots = new Map<string, ShopperOrderCatalogSnapshot>([
      [
        "demo-hosted-shirt",
        {
          id: "demo-hosted-shirt",
          found: true,
          name: "Dinkus Demo Heavyweight T-Shirt",
          sku: "DEMO-HOSTED-SHIRT",
          fulfillment: "physical",
        },
      ],
    ]);

    const markup = renderOrderItemMarkup(order, snapshots, { playgroundMode: true });
    expect(markup).toContain('class="account-order-card__lines"');
    expect(markup).toContain('data-account-order-line="demo-hosted-shirt"');
    expect(markup).toContain('data-account-order-line-image');
    expect(markup).toContain('src="/images/products/shirt.svg"');
    expect(markup).toContain('data-account-order-line-sku>SKU: DEMO-HOSTED-SHIRT</span>');
    expect(markup).toContain(
      'data-account-order-line-variant>Heavyweight Cotton · Regular Fit</span>',
    );
    expect(markup).toContain('data-account-order-line-fulfillment>Physical</span>');

    // Without media or playground fallback, renders "No image" placeholder and no guessed variant badge
    const noMediaMarkup = renderOrderItemMarkup(order, snapshots, { playgroundMode: false });
    expect(noMediaMarkup).toContain('account-order-line__thumb--placeholder');
    expect(noMediaMarkup).toContain('No image');
    expect(noMediaMarkup).not.toContain('data-account-order-line-image');
    expect(noMediaMarkup).not.toContain('data-account-order-line-variant');
  });

  it("batches all distinct historical product IDs up to GUEST_CART_MAX_LINES (40) per request without truncating at 20", async () => {
    expect(SHOPPER_CATALOG_SNAPSHOT_BATCH_SIZE).toBe(40);
    const totalDistinct = 55;
    const orders: ShopperOrderItem[] = [
      {
        orderId: "ord_batch_1",
        receiptId: "rcpt_batch_1",
        number: 3001,
        status: "processing",
        paidAt: "2026-10-21T12:00:00.000Z",
        total: { currency: "USD", minor: "55000" },
        lines: Array.from({ length: totalDistinct }, (_, idx) => ({
          catalogItemId: `merchant-item-${idx + 1}`,
          name: `Merchant Item ${idx + 1}`,
          quantity: 1,
          unitPrice: { currency: "USD", minor: "1000" },
        })),
        delivery: null,
        phone: null,
      },
    ];

    const batches = collectOrderCatalogSnapshotBatches(orders);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(40);
    expect(batches[1]).toHaveLength(15);

    const requestedUrls: string[] = [];
    const snapshots = await fetchOrderCatalogSnapshots(orders, (async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      const queryIds = decodeURIComponent(url.split("?ids=")[1] ?? "").split(",");
      return new Response(
        JSON.stringify({
          products: queryIds.map((id) => ({
            id,
            found: true,
            name: `Snapshot ${id}`,
            sku: id.toUpperCase(),
            fulfillment: "physical",
            thumbnail: { src: "/merch/tee.svg", alt: `${id} photo` },
          })),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch);

    expect(requestedUrls).toHaveLength(2);
    expect(snapshots.size).toBe(totalDistinct);
    expect(snapshots.get("merchant-item-21")?.sku).toBe("MERCHANT-ITEM-21");
    expect(snapshots.get("merchant-item-55")?.thumbnail?.src).toBe("/merch/tee.svg");
  });

  it("retains whitespace-pasted PINs for the existing trim validation and explains the code field", () => {
    const source = readFileSync(resolve(root, "src/features/shopper-account/ShopperAccount.astro"), "utf8");
    expect(source).toContain('inputmode="numeric" pattern="\\s*[0-9]{6}\\s*" autocomplete="one-time-code"');
    expect(source).toContain('aria-describedby="account-code-hint"');
    expect(source).toContain('id="account-code-hint"');
    expect(source).toContain('id="account-status"');
    expect(source).toContain('Surrounding spaces are ignored.');
  });

  it("preserves all FEATURE_MAP.md selectors and vault/stamp card separation on ShopperAccount.astro", () => {
    const componentSource = readFileSync(
      resolve(root, "src/features/shopper-account/ShopperAccount.astro"),
      "utf8",
    );
    for (const selector of [
      "data-shopper-account",
      "data-account-signed-out",
      "data-account-start-form",
      "data-account-email",
      "data-account-opt-in",
      "data-account-start",
      "data-account-verify-form",
      "data-account-code",
      "data-account-verify",
      "data-account-demo-card",
      "data-account-demo-signin",
      "data-account-signed-in",
      "data-account-welcome",
      "data-account-current-email",
      "data-account-signout",
      "data-account-orders",
      "data-account-orders-empty",
      "data-account-orders-list",
      "data-account-profile-form",
      "data-account-profile-save",
      "data-account-profile-clear",
    ]) {
      expect(componentSource).toContain(selector);
    }
    expect(componentSource).toContain("account-card--vault");
    expect(componentSource).toContain("account-card--stamp");
    expect(componentSource).toContain("0 7px 0 0");
    expect(componentSource).toContain("#fcfbf8");
  });
});
