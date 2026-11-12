import { expect, test } from "@playwright/test";
import { GUEST_CART_STORAGE_KEY } from "../../src/features/guest-cart/index.js";

const names = { mug: "Camp mug", cap: "Road cap", bandana: "Blue bandana" };

for (const path of ["/cart", "/checkout"]) {
  test(`${path} keeps removal focus near its former row through refresh and the empty state`, async ({ page }) => {
    // Exercise the real page/client with synthetic catalog facts. Never start a checkout.
    await page.addInitScript(({ key }) => {
      localStorage.setItem(key, JSON.stringify({ version: 1, lines: [
        { id: "mug", quantity: 1 }, { id: "cap", quantity: 1 }, { id: "bandana", quantity: 1 },
      ] }));
    }, { key: GUEST_CART_STORAGE_KEY });
    let snapshots = 0;
    const starts: string[] = [];
    await page.route("**/api/guest-cart/snapshot?**", async route => {
      snapshots++;
      // Finish after focus has moved, so a later price refresh must retain it.
      await new Promise(resolve => setTimeout(resolve, 100));
      await route.fulfill({ json: { products: Object.entries(names).map(([id, name]) => ({
        id, found: true, name, sku: id.toUpperCase(), fulfillment: "physical",
        price: { listable: true, regularText: "$10.00", saleText: null, unitMinor: "1000" },
        availability: { status: "in-stock", sellable: true, listable: true },
      })) } });
    });
    await page.route(/\/.*checkout\/.*(?:prepare|start|status)(?:\?|$)/, async route => {
      if (route.request().url().includes("/start")) starts.push(route.request().url());
      // An unavailable admission probe must not prevent local cart editing.
      await route.fulfill({ status: 503, json: { error: "unavailable" } });
    });
    await page.goto(path);
    await expect(page.locator("[data-guest-cart-line] h2")).toHaveText(Object.values(names));
    const quantity = (id: string) => page.locator(`[data-guest-cart-qty="${id}"]`);
    const remove = (id: string) => page.locator(`[data-guest-cart-remove="${id}"]`);
    await expect(remove("cap")).toBeEnabled();
    await quantity("bandana").fill("0");
    await remove("cap").focus();
    await page.keyboard.press("Enter");
    await expect(quantity("bandana")).toBeFocused();
    await expect(quantity("bandana")).toHaveValue("0");
    await expect(quantity("bandana")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("[data-guest-cart-subtotal]")).toBeHidden();
    await expect.poll(() => snapshots).toBeGreaterThan(1);
    await expect(page.locator("[data-guest-cart-status]")).not.toContainText("Updating current product details.");
    await expect(quantity("bandana")).toBeFocused();
    await expect(quantity("bandana")).toBeInViewport({ ratio: 1 });
    await remove("bandana").focus();
    await page.keyboard.press("Enter");
    await expect(quantity("mug")).toBeFocused();
    await remove("mug").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-guest-cart-empty]")).toBeVisible();
    await expect(page.locator("[data-guest-cart-empty]")).toBeFocused();
    await expect(page.locator("[data-guest-cart-line]")).toHaveCount(0);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), GUEST_CART_STORAGE_KEY))
      .toEqual({ version: 1, lines: [] });
    expect(starts).toEqual([]);
  });
}
