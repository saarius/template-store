import { expect, test } from "@playwright/test";
import { GUEST_CART_STORAGE_KEY } from "../../src/features/guest-cart/index.js";
import { SHOPPER_SESSION_STORAGE_KEY } from "../../src/features/shopper-account/index.js";

// Browser-only account/cart/prepare responses. No real session, profile update,
// checkout start, email or provider operation is permitted by this fixture.
const session = (name: string) => ({ sessionId: `csess_synthetic_${name}`,
  sessionToken: `csess_synthetic_${name}.0123456789abcdef0123456789abcdef`,
  email: `${name}@example.test`, expiresAt: 4_102_444_800 });
const previous = session("previous");
const profile = { email: previous.email, delivery: { name: "Previous Synthetic Shopper",
  line1: "11 Previous Test Road", city: "Testville", region: "NC", postalCode: "27601", country: "US" } };
const checkout = { schema: "dinkuskit.commerce.guest-checkout-projection/v1", state: "pending", attemptId: null,
  lines: [], total: null, redirectUrl: null, order: null, retryAfter: null, unavailable: null };
const prepared = { ok: true, capabilityId: "prefill-synthetic", capability: { capabilityId: "prefill-synthetic",
  capability: "prefill-synthetic.fixture", retention: "json-body", header: "x-commerce-guest-capability" }, checkout };

for (const scheme of ["light", "dark"] as const) {
  for (const change of ["new-shopper", "same-email-new-capability", "sign-out", "expiry", "same-session"] as const) {
    test(`checkout ignores obsolete profile defaults, preserves typed fields (${change}, ${scheme})`, async ({ page, context }, testInfo) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/shipping");
      await page.evaluate(({ key, cart, previous }) => {
        localStorage.setItem(key, JSON.stringify(previous));
        localStorage.setItem(cart, JSON.stringify({ version: 1, lines: [{ id: "synthetic-notebook", quantity: 1 }] }));
      }, { key: SHOPPER_SESSION_STORAGE_KEY, cart: GUEST_CART_STORAGE_KEY, previous });
      let release!: () => void; const pending = new Promise<void>(done => { release = done; });
      let requested = false; let delivered = false; let unexpectedWrites = 0; let prepareFixtures = 0;
      await context.route("**/*", async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (path.endsWith("/account/orders")) {
          expect(request.headers()["x-commerce-customer-session"]).toBe(previous.sessionToken);
          requested = true; await pending;
          await route.fulfill({ json: { success: true, data: { ok: true, profile, orders: [] } } });
          delivered = true; return;
        }
        if (path === "/api/guest-cart/snapshot") return route.fulfill({ json: { products: [{ id: "synthetic-notebook", found: true,
          name: "Synthetic notebook", fulfillment: "physical", price: { listable: true, regularText: "$12.00", saleText: null, unitMinor: "1200" },
          availability: { status: "in-stock", sellable: true, listable: true } }] } });
        if (path.endsWith("/checkout/guest/prepare")) { prepareFixtures++; return route.fulfill({ json: prepared }); }
        if (!["GET", "HEAD"].includes(request.method())) { unexpectedWrites++; return route.abort(); }
        return route.continue();
      });
      await page.addInitScript(() => {
        const original = window.fetch;
        window.fetch = async (...args) => {
          const response = await original(...args);
          if (response.url.endsWith("/account/orders")) {
            const json = response.json.bind(response);
            response.json = async () => {
              const body = await json();
              // The consumer resumes in a microtask before this timer fires.
              setTimeout(() => { document.documentElement.dataset.prefillDecoded = "true"; }, 0);
              return body;
            };
          }
          return response;
        };
      });
      try {
        await page.goto("/checkout");
        await expect.poll(() => requested).toBe(true);
        const email = page.locator("[data-guest-cart-email]");
        await expect(email).toHaveValue(previous.email); await expect(email).toBeEnabled();
        const other = await context.newPage(); await other.goto("/shipping");
        const current = change === "same-email-new-capability" ? { ...session("current"), email: previous.email }
          : change === "expiry" ? { ...previous, expiresAt: 1 } : session("current");
        if (change !== "same-session") await other.evaluate(({ key, current, change }) => {
          if (change === "sign-out") localStorage.removeItem(key);
          else localStorage.setItem(key, JSON.stringify(current));
        }, { key: SHOPPER_SESSION_STORAGE_KEY, current, change });
        await page.bringToFront();
        await email.fill("current-draft@example.test");
        await page.locator("[data-guest-cart-delivery-name]").fill("Current checkout draft");
        const name = page.locator("[data-guest-cart-delivery-name]");
        await name.focus(); release(); await expect.poll(() => delivered).toBe(true);
        // Observe body decoding and its consumer continuation, not just headers.
        await expect(page.locator("html")).toHaveAttribute("data-prefill-decoded", "true");
        await expect(email).toHaveValue("current-draft@example.test");
        await expect(name).toHaveValue("Current checkout draft"); await expect(name).toBeFocused();
        await expect(page.locator("[data-guest-cart-delivery-line1]")).toHaveValue(change === "same-session" ? profile.delivery.line1 : "");
        await expect(page.locator("[data-guest-cart-delivery-city]")).toHaveValue(change === "same-session" ? profile.delivery.city : "");
        const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "null"), SHOPPER_SESSION_STORAGE_KEY);
        if (change === "sign-out" || change === "expiry") expect(stored).toBeNull();
        else expect(stored).toEqual(change === "same-session" ? previous : current);
        expect(unexpectedWrites).toBe(0); expect(prepareFixtures).toBe(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (change === "new-shopper" && scheme === "light") {
          await page.locator("[data-guest-cart-contact]").scrollIntoViewIfNeeded();
          await page.screenshot({ path: testInfo.outputPath("checkout-prefill-after.png") });
        }
      } finally { release(); }
    });
  }
}
