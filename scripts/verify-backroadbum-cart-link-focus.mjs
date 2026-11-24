// Browser-local cart and synthetic catalog refreshes only. Block EVERY non-read
// request before visiting the store, including automatic capability preparation.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.BACKROADBUM_VERIFY_URL ?? 'https://backroadbum.com';
const output = process.env.BACKROADBUM_VERIFY_OUTPUT ?? new URL('../runs/backroadbum/cart-link-focus/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme,
      reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    const writes = [], errors = [];
    await context.route('**/*', route => {
      if (!['GET', 'HEAD'].includes(route.request().method())) {
        writes.push(new URL(route.request().url()).pathname);
        return route.abort();
      }
      return route.continue();
    });
    try {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/products/creekside-camp-mug');
      const id = await page.locator('[data-commerce-item]').getAttribute('data-commerce-item');
      expect(id).toBeTruthy();
      const response = await page.request.get(base + '/api/guest-cart/snapshot?ids=' + encodeURIComponent(id));
      expect(response.ok()).toBe(true);
      const initial = (await response.json()).products[0];
      expect(initial.found && initial.price.unitMinor !== null).toBe(true);
      const changedMinor = String(Number(initial.price.unitMinor) + 100);
      const changedText = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(changedMinor) / 100);
      let changed = false, reads = 0;
      await context.route('**/api/guest-cart/snapshot?**', route => {
        reads++;
        return route.fulfill({ json: { products: [changed ? { ...initial,
          name: initial.name + ' · refreshed',
          price: { ...initial.price, regularText: changedText, saleText: null, unitMinor: changedMinor },
        } : initial] } });
      });
      await page.locator('[data-add-to-cart]').click();
      const stored = () => page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'));
      const original = await stored();
      for (const path of ['/cart', '/checkout']) {
        changed = false;
        await page.goto(base + path);
        const link = page.locator('[data-guest-cart-product-link]');
        await expect(link).toHaveText(initial.name);
        await expect(page.locator('[data-guest-cart-subtotal-amount]')).toHaveText(initial.price.regularText);
        const target = await link.boundingBox();
        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
        // Save the actual node, not just a selector that could find a replacement.
        await link.evaluate(node => { globalThis.__cartProductLink = node; });
        await page.keyboard.press('Tab');
        await link.focus();
        const previous = reads;
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await expect.poll(() => reads).toBeGreaterThan(previous);
        await expect.poll(() => page.locator('[data-guest-cart-line]').getAttribute('aria-busy')).toBeNull();
        await expect(link).toBeFocused();
        expect(await link.evaluate(node => node === globalThis.__cartProductLink)).toBe(true);
        changed = true;
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
        await expect(link).toHaveText(initial.name + ' · refreshed');
        await expect(page.locator('[data-guest-cart-subtotal-amount]')).toHaveText(changedText);
        await expect(link).toBeFocused();
        expect(await link.evaluate(node => node === globalThis.__cartProductLink)).toBe(true);
        expect(await link.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');
        expect(await stored()).toBe(original);
        // The next Tab follows the same native DOM order into Quantity.
        await link.press('Tab');
        await expect(page.locator('[data-guest-cart-qty]')).toBeFocused();
        await page.locator('[data-guest-cart-qty]').fill('0');
        await expect(page.locator('[data-guest-cart-checkout]')).toBeDisabled();
        await link.focus();
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await expect(link).toBeFocused();
        await expect(page.locator('[data-guest-cart-qty]')).toHaveValue('0');
        await page.locator('[data-guest-cart-qty]').fill('1');
        expect(await stored()).toBe(original);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: `${output}/${path.slice(1)}-${width}-${colorScheme}.png`, fullPage: true });
        if (process.argv.includes('--freeze-for-audit') && width === 1440 && colorScheme === 'light') {
          // Opt-in inert public fixture for the DOM auditor; never save storage,
          // request headers or account/receipt data. Only these two empty-contact
          // pages and synthetic catalog facts are exercised by this command.
          const html = await page.evaluate(() => {
            const root = document.documentElement.cloneNode(true);
            root.querySelectorAll('script').forEach(node => node.remove());
            const baseTag = document.createElement('base');
            baseTag.href = location.origin + '/';
            root.querySelector('head').prepend(baseTag);
            return '<!doctype html>' + root.outerHTML;
          });
          await writeFile(`${output}/${path.slice(1)}-audit.html`, html);
        }
        results.push({ width, colorScheme, path, target: { width: target.width, height: target.height }, unchangedRefreshKeepsNodeAndFocus: true,
          changedFactsKeepNodeAndFocus: true, tabContinuesToQuantity: true,
          invalidDraftPreserved: true, savedIntentUnchanged: true, noOverflow: true });
      }
      expect(errors).toEqual([]);
      // Blocked prepare attempts are expected; no start/mail/account mutation may even be attempted.
      expect(writes.every(path => /^\/_emdash\/api\/plugins\/[^/]+\/checkout\/guest\/prepare$/.test(path))).toBe(true);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
const report = { checkedAt: new Date().toISOString(), scope: 'Rendered merchant pages; actual catalog baseline with synthetic facts/focus/BFCache events. All non-read traffic aborted; no capability, checkout start or merchant write. Chromium only.', results };
await writeFile(`${output}/verification.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
