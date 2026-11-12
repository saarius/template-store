import { expect, test, type Page } from "@playwright/test";
import { GUEST_CART_STORAGE_KEY, GUEST_CHECKOUT_CAPABILITY_STORAGE_KEY } from "../../src/features/guest-cart/index.js";

const projection = { schema: "dinkuskit.commerce.guest-checkout-projection/v1", state: "pending", attemptId: null,
  lines: [], total: null, redirectUrl: null, order: null, retryAfter: null, unavailable: null };
const prepared = { ok: true, capabilityId: "probe-1", capability: { capabilityId: "probe-1", capability: "probe-1.synthetic",
  retention: "json-body", header: "x-commerce-guest-capability" }, checkout: projection };

async function fixture(page: Page, active = false) {
  await page.addInitScript(({ cart, capability, active }) => {
    localStorage.setItem(cart, JSON.stringify({ version: 1, lines: [{ id: "bandana", quantity: 2 }] }));
    if (active) localStorage.setItem(capability, JSON.stringify({ capabilityId: "pending-1", capability: "pending-1.synthetic", attemptId: "attempt-1", awaitingStart: true }));
  }, { cart: GUEST_CART_STORAGE_KEY, capability: GUEST_CHECKOUT_CAPABILITY_STORAGE_KEY, active });
  await page.route("**/api/guest-cart/snapshot?**", route => route.fulfill({ json: { products: [{
    id: "bandana", found: true, name: "Blue bandana", sku: "BLUE", fulfillment: "physical",
    price: { listable: true, regularText: "$10.00", saleText: null, unitMinor: "1000" },
    availability: { status: "in-stock", sellable: true, listable: true },
  }] } }));
}

for (const path of ["/cart", "/checkout"]) {
  test(`${path} explicitly retries availability without changing cart, contact or payment rules`, async ({ page }) => {
    await fixture(page);
    let probes = 0; let starts = 0;
    await page.route(/\/checkout\/guest\/(prepare|start|status)$/, async route => {
      if (!route.request().url().endsWith("/prepare")) { starts++; await route.abort(); return; }
      probes++;
      if (probes === 1) await route.fulfill({ status: 429, headers: { "Retry-After": "1" }, json: { ok: false, error: { code: "CHECKOUT_LIMITED", message: "limited" } } });
      else if (probes === 2) await route.fulfill({ status: 503, json: { ok: false, error: { code: "CHECKOUT_UNAVAILABLE", message: "unavailable" } } });
      else { await new Promise(resolve => setTimeout(resolve, 150)); await route.fulfill({ json: prepared }); }
    });
    await page.goto(path);
    const retry = page.locator("[data-guest-cart-availability-retry]");
    const message = page.locator("[data-guest-cart-availability-message]");
    const quantity = page.locator("[data-guest-cart-qty]");
    await expect(message).toContainText("Wait a few minutes");
    await expect(retry).toBeVisible();
    await expect(page.locator("[data-guest-cart-checkout]")).toBeDisabled();
    await expect(quantity).toHaveValue("2");
    // Existing browser/prefill values remain even when contact is currently disabled.
    if (path === "/checkout") await page.locator("[data-guest-cart-email]").evaluate((input: HTMLInputElement) => { input.value = "retained@example.invalid"; });
    await quantity.fill("0");
    // Returning to the window and editing the cart do not hammer prepare automatically.
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(quantity).toHaveAttribute("aria-invalid", "true");
    expect(probes).toBe(1);
    await retry.focus(); await page.keyboard.press("Enter");
    await expect(message).toContainText("couldn’t check checkout availability");
    await expect(message).toBeFocused();
    await expect(retry).toBeEnabled();
    await retry.focus(); await page.keyboard.press("Enter");
    await expect(retry).toBeDisabled();
    await retry.dispatchEvent("click"); // A second click during the check sends nothing.
    await expect(message).toHaveText("Checkout is available. Continue when you’re ready.");
    await expect(message).toBeFocused();
    await expect(message).toBeInViewport({ ratio: 1 });
    await expect(retry).toBeHidden();
    await expect(quantity).toHaveValue("0");
    await expect(page.locator("[data-guest-cart-checkout]")).toBeDisabled();
    await quantity.fill("2");
    await expect(page.locator("[data-guest-cart-checkout]")).toBeEnabled();
    if (path === "/checkout") {
      await expect(page.locator("[data-guest-cart-email]")).toBeEnabled();
      await expect(page.locator("[data-guest-cart-email]")).toHaveValue("retained@example.invalid");
    }
    expect(probes).toBe(3); expect(starts).toBe(0);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), GUEST_CART_STORAGE_KEY))
      .toEqual({ version: 1, lines: [{ id: "bandana", quantity: 2 }] });
  });
}

test("an active checkout cannot turn availability retry into a new prepare", async ({ page }) => {
  await fixture(page, true); let calls = 0;
  await page.route(/\/checkout\/guest\/(prepare|start|status)$/, async route => { calls++; await route.abort(); });
  await page.goto("/cart");
  await expect(page.locator("[data-guest-cart-recover]")).toBeVisible();
  const retry = page.locator("[data-guest-cart-availability-retry]");
  await expect(retry).toBeHidden();
  await retry.evaluate((button: HTMLButtonElement) => { button.hidden = false; button.disabled = false; button.removeAttribute("aria-disabled"); });
  await retry.click();
  expect(calls).toBe(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).attemptId, GUEST_CHECKOUT_CAPABILITY_STORAGE_KEY)).toBe("attempt-1");
});

test("a closed server admission never offers or accepts a prepare retry", async ({ page }) => {
  await fixture(page); let probes = 0;
  await page.route(/\/checkout\/guest\/prepare$/, async route => { probes++; await route.abort(); });
  await page.route("**/cart", async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('data-guest-checkout-admitted="true"', 'data-guest-checkout-admitted="false"') });
  });
  await page.goto("/cart");
  await expect(page.locator("[data-guest-cart]")).toHaveAttribute("data-guest-checkout-admitted", "false");
  await expect(page.locator("[data-guest-cart-line] h2")).toHaveText("Blue bandana");
  const retry = page.locator("[data-guest-cart-availability-retry]");
  await expect(retry).toBeHidden();
  await retry.evaluate((button: HTMLButtonElement) => { button.hidden = false; button.disabled = false; button.removeAttribute("aria-disabled"); });
  await retry.click(); expect(probes).toBe(0);
});

test("a completed explicit check does not steal focus after the shopper moved away", async ({ page }) => {
  await fixture(page); let probes = 0;
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/checkout\/guest\/prepare$/, async route => {
    if (++probes === 1) await route.fulfill({ status: 503, json: { ok: false, error: { code: "UNAVAILABLE", message: "unavailable" } } });
    else { await wait; await route.fulfill({ json: prepared }); }
  });
  await page.goto("/cart");
  const retry = page.locator("[data-guest-cart-availability-retry]");
  await expect(retry).toBeVisible(); await retry.click();
  await expect(retry).toBeDisabled();
  const browse = page.getByRole("link", { name: "Continue shopping", exact: true });
  await browse.focus(); release();
  await expect(page.locator("[data-guest-cart-availability-message]")).toContainText("Checkout is available");
  await expect(browse).toBeFocused(); expect(probes).toBe(2);
});
