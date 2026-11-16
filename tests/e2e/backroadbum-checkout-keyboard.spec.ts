import { expect, test } from "@playwright/test";
import { GUEST_CART_STORAGE_KEY } from "../../src/features/guest-cart/index.js";

// Every write is intercepted. Keyboard proof must never start a real payment,
// send email, or modify the installed merchant catalog/account/order records.
for (const scheme of ["light", "dark"] as const) {
  for (const method of ["enter", "click"] as const) {
  test(`checkout accepts native Enter without duplicate starts (${scheme}, ${method})`, async ({ page, context }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript(({ key, scheme }) => {
      localStorage.setItem(key, JSON.stringify({ version: 1, lines: [{ id: "synthetic-notebook", quantity: 1 }] }));
      localStorage.setItem("backroadbum.theme", scheme);
    }, { key: GUEST_CART_STORAGE_KEY, scheme });
    let preparations = 0, starts = 0, unknownWrites = 0;
    let release!: () => void;
    const pending = new Promise<void>(done => { release = done; });
    await context.route("**/*", async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (path === "/api/guest-cart/snapshot") return route.fulfill({ json: { products: [{ id: "synthetic-notebook", found: true,
        name: "Synthetic notebook", sku: "SYNTHETIC-BOOK", fulfillment: "physical", price: { listable: true, regularText: "$12.00", saleText: null, unitMinor: "1200" },
        availability: { status: "in-stock", sellable: true, listable: true } }] } });
      if (path.endsWith("/checkout/guest/prepare")) {
        preparations++;
        return route.fulfill({ json: { ok: true, capabilityId: "keyboard-synthetic", capability: { capabilityId: "keyboard-synthetic",
          capability: "keyboard-synthetic.fixture", retention: "json-body", header: "x-commerce-guest-capability" }, checkout: {
          schema: "dinkuskit.commerce.guest-checkout-projection/v1", state: "pending", attemptId: null,
          lines: [], total: null, redirectUrl: null, order: null, retryAfter: null, unavailable: null } } });
      }
      if (path.endsWith("/checkout/guest/start")) {
        starts++;
        expect(request.postDataJSON().contact).toMatchObject({ email: "keyboard@example.test", delivery: { name: "Synthetic Shopper", country: "US" } });
        await pending;
        return route.fulfill({ json: { ok: false, error: { code: "CHECKOUT_UNAVAILABLE", message: "Synthetic payment refusal; no provider contacted." } } });
      }
      if (!["GET", "HEAD"].includes(request.method())) { unknownWrites++; return route.abort(); }
      return route.continue();
    });
    try {
      await page.goto(process.env.BACKROADBUM_CHECKOUT_PATH || "/checkout");
      const button = page.locator("[data-guest-cart-checkout]");
      const email = page.locator("[data-guest-cart-email]");
      await expect(button).toBeEnabled().catch(async error => {
        await testInfo.attach("checkout-state", { body: JSON.stringify({ preparations, starts, unknownWrites,
          admitted: await page.locator("[data-guest-cart]").getAttribute("data-guest-checkout-admitted"),
          status: await page.locator("[data-guest-cart-status]").textContent() }), contentType: "application/json" });
        throw error;
      });
      // Editing the manifest must not implicitly submit the contact form.
      await page.locator("[data-guest-cart-qty]").press("Enter");
      expect(starts).toBe(0);
      await email.focus();
      await page.screenshot({ path: testInfo.outputPath("before-enter.png") });
      await email.press("Enter");
      const correction = page.locator('[data-guest-cart-contact-error="email"]');
      await expect(correction).toHaveText("Enter your email address to continue.");
      await expect(email).toBeFocused();
      await expect(email).toHaveAttribute("aria-invalid", "true");
      await expect(correction).toBeInViewport();
      expect(starts).toBe(0);
      await page.screenshot({ path: testInfo.outputPath("after-enter.png") });
      await email.fill("not-an-email");
      await email.press("Enter");
      await expect(correction).toHaveText("Enter a valid email address to continue.");
      expect(starts).toBe(0);
      await email.fill("keyboard@example.test");
      for (const [field, value] of Object.entries({ name: "Synthetic Shopper", line1: "12 Test Road", city: "Testville", region: "NC", "postal-code": "27601" })) {
        await page.locator(`[data-guest-cart-delivery-${field}]`).fill(value);
      }
      await page.locator("[data-guest-cart-delivery-country]").selectOption("US");
      if (method === "enter") await page.locator("[data-guest-cart-delivery-postal-code]").press("Enter");
      else await button.click();
      await expect.poll(() => starts).toBe(1);
      await expect(button).toBeDisabled();
      // A second native submission and a click while the first is in flight
      // cannot create another preparation or start.
      await page.locator("[data-guest-cart-checkout-form]").evaluate((form: HTMLFormElement) => form.requestSubmit());
      await button.evaluate((el: HTMLButtonElement) => el.click());
      expect(starts).toBe(1); expect(preparations).toBe(1); expect(unknownWrites).toBe(0);
      release();
      await expect(page.locator("[data-guest-cart-status]")).toContainText("Synthetic payment refusal");
      await expect(page.locator("[data-guest-cart-recover]")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally { release(); }
  });
  }
}

test("checkout without JavaScript keeps the native submission inaccessible", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto(process.env.BACKROADBUM_CHECKOUT_PATH || "/checkout");
    await expect(page.locator("[data-checkout-no-script]")).toBeVisible();
    await expect(page.locator("[data-guest-cart-checkout-form]")).not.toBeVisible();
    await expect(page.locator("[data-guest-cart-checkout]")).not.toBeVisible();
  } finally { await context.close(); }
});
