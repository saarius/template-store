import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GUEST_CART_STORAGE_KEY } from "../../src/features/guest-cart/index.js";

// Transport-only outage fixtures on the actual merchant component. Unknown
// writes (including proactive prepare) are refused; no real checkout is made.
for (const scheme of ["light", "dark"] as const) for (const surface of ["cart", "checkout"] as const) {
  test(`${surface} product-detail retry retains keyboard ownership (${scheme})`, async ({ page, context }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme });
    const intent = JSON.stringify({ version: 1, lines: [{ id: "synthetic-tee-l", quantity: 2 }] });
    await page.addInitScript(({ intent, key, scheme }) => {
      localStorage.clear();
      localStorage.setItem(key, intent);
      localStorage.setItem("backroadbum.theme", scheme);
    }, { intent, key: GUEST_CART_STORAGE_KEY, scheme });
    let snapshots = 0, blockedWrites = 0, checkoutStarts = 0;
    let outcome = "failure";
    let release!: () => void;
    let responsePending: Promise<void>;
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.name));
    await context.route("**/*", async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (path === "/api/guest-cart/snapshot") {
        snapshots++;
        if (snapshots === 1) return route.fulfill({ status: 503, json: {} });
        await responsePending;
        if (outcome.startsWith("failure")) return route.fulfill({ status: 503, json: {} });
        return route.fulfill({ json: { products: outcome === "success-unavailable" ? [{ id: "synthetic-tee-l", found: false }] : [{
          id: "synthetic-tee-l", found: true, name: "Synthetic tee — L", sku: "SYNTHETIC-TEE-L",
          productPath: "/products/wrong-turn-tee?item=synthetic-tee-l", fulfillment: "physical",
          price: { listable: true, regularText: "$34.00", saleText: null, unitMinor: "3400" },
          availability: { status: "in-stock", sellable: true, listable: true },
        }] } });
      }
      if (path.endsWith("/checkout/guest/start")) checkoutStarts++;
      if (!["GET", "HEAD"].includes(request.method())) { blockedWrites++; return route.abort(); }
      return route.continue();
    });
    const freeze = async (state: string) => {
      const dir = process.env.BACKROADBUM_RETRY_AUDIT_DIR;
      if (!dir || testInfo.project.name !== "backroadbum-1440" || scheme !== "light") return;
      await mkdir(dir, { recursive: true });
      // Inert, synthetic DOM only; CSS/fonts still resolve from this preview.
      const html = await page.evaluate(() => {
        const clone = document.documentElement.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("script, astro-dev-toolbar").forEach(node => node.remove());
        const base = document.createElement("base"); base.href = location.origin;
        clone.querySelector("head")!.prepend(base);
        clone.querySelectorAll("input").forEach((input, index) => input.setAttribute("value", document.querySelectorAll("input")[index].value));
        return "<!doctype html>" + clone.outerHTML;
      });
      await writeFile(join(dir, `${surface}-${state}.html`), html);
    };
    for (const scenario of ["failure", "success", "failure-moved", "success-moved", "success-unavailable"]) {
      await test.step(scenario, async () => {
        outcome = scenario; snapshots = 0;
        responsePending = new Promise<void>(done => { release = done; });
        try {
          const path = process.env.BACKROADBUM_RETRY_FIXTURE ? `${process.env.BACKROADBUM_RETRY_FIXTURE}?surface=${surface}` : `/${surface}`;
          await page.goto(path);
          const root = page.locator("[data-guest-cart]");
          const retry = root.locator("[data-guest-cart-retry]");
          await expect(retry).toBeVisible();
          const quantity = root.locator("[data-guest-cart-qty]");
          // A rejected draft is not erased by an outage/retry or its recovery.
          await quantity.fill("2."); await quantity.press("Tab");
          await expect(quantity).toHaveAttribute("aria-invalid", "true");
          await retry.focus(); await page.keyboard.press("Enter");
          await expect.poll(() => snapshots).toBe(2);
          await expect(retry).toBeFocused();
          await expect(retry).toHaveAttribute("aria-disabled", "true");
          await expect(retry).toHaveAttribute("aria-busy", "true");
          await expect(retry).toBeInViewport({ ratio: 1 });
          // Native/programmatic repeat activation cannot start another fetch.
          await page.keyboard.press("Enter");
          await retry.evaluate((button: HTMLButtonElement) => button.click());
          expect(snapshots).toBe(2);
          if (scenario === "success") {
            await page.screenshot({ path: testInfo.outputPath("retry-pending.png") });
            await freeze("pending");
          }
          const elsewhere = page.getByRole("link", { name: "Shop", exact: true }).first();
          if (scenario.endsWith("moved")) await elsewhere.focus();
          release();
          await expect(retry).toHaveAttribute("aria-busy", "false");
          if (scenario.endsWith("moved")) await expect(elsewhere).toBeFocused();
          else if (scenario === "failure") {
            await expect(retry).toBeVisible(); await expect(retry).toBeFocused();
            await expect(retry).toBeInViewport({ ratio: 1 });
            await expect(retry).toHaveAttribute("aria-disabled", "false");
          } else if (scenario === "success-unavailable") {
            await expect(retry).toBeHidden(); await expect(quantity).toBeFocused();
            await expect(root.locator("[data-guest-cart-product-link]")).toHaveCount(0);
          } else {
            await expect(retry).toBeHidden();
            const product = root.locator("[data-guest-cart-product-link]");
            await expect(product).toBeFocused();
            await expect(product).toHaveText("Synthetic tee — L");
            await expect(product).toHaveAttribute("href", "/products/wrong-turn-tee?item=synthetic-tee-l");
            await page.screenshot({ path: testInfo.outputPath("retry-recovered.png") });
            await freeze("recovered");
            await page.keyboard.press("Tab"); await expect(quantity).toBeFocused();
          }
          await expect(quantity).toHaveValue("2.");
          await expect(quantity).toHaveAttribute("aria-invalid", "true");
          expect(await page.evaluate(key => localStorage.getItem(key), GUEST_CART_STORAGE_KEY)).toBe(intent);
          expect(await page.evaluate(() => localStorage.getItem("dinkus.guest-checkout.v1"))).toBeNull();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        } finally { release(); }
      });
    }
    expect(errors).toEqual([]); expect(checkoutStarts).toBe(0);
    await testInfo.attach("write-boundary", { body: JSON.stringify({ blockedWrites, realWrites: 0, checkoutStarts }), contentType: "application/json" });
  });
}
