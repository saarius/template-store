import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  catalogGuidanceCopy,
  catalogNoticeText,
  linkedProductPurchasable,
  storeBannerText,
} from "../../src/features/store-shell/checkout-copy.js";

const STOREFRONT_PAGES = [
  "src/pages/index.astro",
  "src/pages/cart.astro",
  "src/pages/checkout/index.astro",
  "src/pages/products/[id].astro",
] as const;

describe("storefront checkout wording", () => {
  it("banner follows installed checkout admission", () => {
    expect(storeBannerText(true)).toBe("DEMO / TEST STORE — No real charges or shipments. Stripe test cards only.");
    expect(storeBannerText(false)).toBe("DEMO / TEST STORE — No real charges or shipments. Checkout is unavailable right now.");
    // A closed admission can be a pause or outage, not an absent connection.
    expect(storeBannerText(false)).not.toMatch(/not connected|yet/i);
  });

  it("every storefront page reads checkout admission for its banner", () => {
    for (const path of STOREFRONT_PAGES) {
      const page = readFileSync(path, "utf8");
      expect(page, path).toContain("acquireGuestCheckoutAdmission");
      expect(page, path).toContain("playgroundCheckoutAdmission(isPlayground, playgroundCheckoutConfigured(playgroundEnvOf(Astro.locals)))");
      expect(page, path).toMatch(/data-store-demo-banner data-checkout-available=\{String\(/);
      expect(page, path).toContain("{storeBannerText(");
      expect(page, path).not.toContain("Synthetic demonstration. Purchases and checkout are unavailable.");
    }
  });

  it("homepage guidance only mentions checkout when products can be bought", () => {
    expect(catalogGuidanceCopy("ready", true).detail).toBe(
      "Eligible products can be added to your cart and checked out with test payments.",
    );
    expect(catalogGuidanceCopy("ready", false).detail).toContain("Checkout is unavailable");
    for (const admitted of [true, false]) {
      expect(catalogGuidanceCopy("unavailable", admitted).detail).not.toMatch(/checkout/i);
      expect(catalogGuidanceCopy("empty", admitted).detail).not.toMatch(/checkout/i);
    }
    expect(catalogGuidanceCopy("unavailable", true).detail).toContain(
      "Products are not shown until the connected store can be reached",
    );
  });

  it("catalog footnote stays quiet when checkout works", () => {
    expect(catalogNoticeText({ unavailable: false, productCount: 3, checkoutAvailable: true })).toBeNull();
    expect(catalogNoticeText({ unavailable: true, productCount: 0, checkoutAvailable: true })).toBeNull();
    expect(catalogNoticeText({ unavailable: false, productCount: 3, checkoutAvailable: false })).toBe(
      "Product browsing is available. Checkout is unavailable right now.",
    );
    expect(catalogNoticeText({ unavailable: false, productCount: 0, checkoutAvailable: false })).toBe(
      "Checkout is unavailable.",
    );
    const catalog = readFileSync("src/features/commerce-catalog/CommerceCatalog.astro", "utf8");
    expect(catalog).toContain("{notice && <p class=\"notice\">{notice}</p>}");
    expect(readFileSync("src/pages/index.astro", "utf8")).toContain("checkoutAvailable={checkoutAvailable} />");
  });

  it("a linked product is purchasable only with a cart, admitted checkout and a sellable item", () => {
    expect(linkedProductPurchasable({ offersCart: true, checkoutAvailable: true, sellable: true })).toBe(true);
    expect(linkedProductPurchasable({ offersCart: false, checkoutAvailable: true, sellable: true })).toBe(false);
    expect(linkedProductPurchasable({ offersCart: true, checkoutAvailable: false, sellable: true })).toBe(false);
    expect(linkedProductPurchasable({ offersCart: true, checkoutAvailable: true, sellable: false })).toBe(false);
  });

  it("product page drops the editorial-preview notice for buyable Commerce products", () => {
    const page = readFileSync("src/pages/products/[id].astro", "utf8");
    // Linked products are handled before the editorial-preview branch, which is
    // left only for entries with no Commerce product behind them.
    const linkedBranch = page.indexOf(": linkedProduct ? (purchasable ? null :");
    const previewBranch = page.indexOf("This is an editorial preview. It is not purchasable.");
    expect(linkedBranch).toBeGreaterThan(0);
    expect(previewBranch).toBeGreaterThan(linkedBranch);
    expect(page).toContain("data-not-purchasable");
  });
});

describe("homepage without a published home page", () => {
  const page = readFileSync("src/pages/index.astro", "utf8");

  it("shows shoppers the store name and the shop, not a developer notice", () => {
    expect(page).not.toContain("Storefront composition is unavailable");
    expect(page).not.toContain('role="alert" data-content-missing');
    expect(page).toContain('<section class="store-default-home" data-home-default>');
    expect(page).toContain("<h1>{siteTitle}</h1>");
    expect(page).toContain('<a href="#commerce-catalog">Browse the shop</a>');
  });

  it("keeps the seed hint for developers only", () => {
    expect(page).toMatch(/if \(!composed && import\.meta\.env\.DEV\) \{\n\s+console\.warn\(.*Load the neutral EmDash seed/);
  });
});

describe("neutral seed copy", () => {
  it("no longer tells shoppers checkout is unavailable", () => {
    const seed = readFileSync("seed/seed.json", "utf8");
    expect(seed).not.toContain("Checkout is not available yet");
    expect(seed).not.toContain("Not available yet");
    expect(seed).toContain("Browse products published in Commerce.");
  });
});

describe("category pages on a shipping store", () => {
  it("show linked Commerce products with their availability and price, not as previews", () => {
    const catalog = readFileSync("src/features/store-shell/MerchCatalog.astro", "utf8");
    expect(catalog).toContain('const commerce = source === "preview" ? commerceProducts.get(item.id) : undefined;');
    expect(catalog).toMatch(/: commerce\n\s+\? availabilityLabels\[commerce\.availability\.status\]/);
    expect(catalog).toContain("{commerce && <p class=\"merch-card__price\" data-product-price>");
    // The product's own Commerce image; merchant products without one keep the
    // "No image" placeholder, and only seeded demo products get a demo image.
    expect(catalog).toContain("{commerce ? <ProductMedia image={commerce.image} productId={commerce.id} fallbackSrc={demoPlaceholderImage(commerce.sku, item.id)}");
    expect(catalog).not.toContain("fallbackSrc={`/merch/");
    const page = readFileSync("src/pages/categories/[slug].astro", "utf8");
    expect(page).toContain('readCommerceCatalog({ runtime: Astro.locals.emdash, request: Astro.request })');
    expect(page).toContain('products={category.products}');
    expect(page).toContain('checkoutAvailable={checkoutAvailable}');
  });

  it("uses the shared admission-aware banner and distinguishes unavailable from empty", () => {
    const page = readFileSync("src/pages/categories/[slug].astro", "utf8");
    expect(page).toContain('<BackroadPage');
    expect(page).toContain('unavailable={unavailable}');
    expect(page).not.toContain('Editorial previews');
    const shell = readFileSync("src/features/store-shell/BackroadPage.astro", "utf8");
    expect(shell).toContain('acquireGuestCheckoutAdmission({ runtime: Astro.locals.emdash, request: Astro.request })');
    expect(shell).toContain('{storeBannerText(available)}');
  });
});

describe("saved checkout rediscovery", () => {
  it("provides credential-free recovery links in the footer and cart", () => {
    for (const path of [
      "src/features/store-shell/StoreFooter.astro",
      "src/features/guest-cart/GuestCart.astro",
    ]) {
      const markup = readFileSync(path, "utf8");
      expect(markup).toMatch(/href="\/checkout\/success" data-last-checkout-link/);
    }
    const receipt = readFileSync("src/features/guest-cart/GuestCheckoutReturn.astro", "utf8");
    expect(receipt).toContain("Your last checkout");
    expect(receipt).toContain("only its latest checkout");
    expect(receipt).toContain("page address alone cannot recover an order");
  });
});

describe("empty cart on a store that takes checkouts", () => {
  it("says the cart is empty instead of that checkout is unavailable", async () => {
    const { emptyGuestCartIntent, presentGuestCart, GUEST_CHECKOUT_LABEL, GUEST_CHECKOUT_REASON } =
      await import("../../src/features/guest-cart/index.js");
    const admitted = presentGuestCart({ intent: emptyGuestCartIntent(), checkoutAdmitted: true });
    expect(admitted.empty).toBe(true);
    expect(admitted.checkoutEnabled).toBe(false);
    expect(admitted.checkoutLabel).toBe("Checkout");
    expect(admitted.checkoutReason).toBe("Add products to your cart to check out.");
    const closed = presentGuestCart({ intent: emptyGuestCartIntent(), checkoutAdmitted: false });
    expect(closed.checkoutLabel).toBe(GUEST_CHECKOUT_LABEL);
    expect(closed.checkoutReason).toBe(GUEST_CHECKOUT_REASON);
    const cart = readFileSync("src/features/guest-cart/GuestCart.astro", "utf8");
    expect(cart).toContain("{checkoutAdmission ? GUEST_CHECKOUT_READY_LABEL : GUEST_CHECKOUT_LABEL}");
    expect(cart).not.toContain("data-guest-cart-contact");
    expect(cart).not.toContain("data-guest-cart-delivery");
    expect(cart).not.toContain("data-guest-cart-coupon-box");
    const checkout = readFileSync("src/features/guest-cart/GuestCheckout.astro", "utf8");
    expect(checkout).toContain("{checkoutAdmission ? GUEST_CHECKOUT_READY_LABEL : GUEST_CHECKOUT_LABEL}");
    expect(checkout).toContain("data-checkout-vault");
    expect(checkout).toContain("data-guest-cart-contact");
    expect(checkout).toContain("data-guest-cart-delivery");
    expect(checkout).toContain("data-guest-cart-coupon-box");
    expect(checkout).toContain("data-checkout-manifest");
    expect(checkout).toContain("data-checkout-breakdown");
  });
});
