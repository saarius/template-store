// Read-only accessible-card proof against the actual EmDash/Commerce storefront.
// No staff session, response substitution, saved cart intent or checkout requests.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/catalog-names/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [390, 1440]) for (const colorScheme of ['light', 'dark']) for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme,
      javaScriptEnabled, reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    const writes = [], checkoutRequests = [], errors = [];
    await context.route('**/*', route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (/\/checkout\/|\/api\/checkout\//.test(path)) checkoutRequests.push(path);
      if (['GET', 'HEAD'].includes(request.method())) return route.continue();
      writes.push(path); return route.abort();
    });
    try {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.name));
      const routes = [];
      for (const path of ['/shop', '/categories/road-day', '/products/long-way-cap']) {
        expect((await page.goto(base + path)).status()).toBe(200);
        const shelf = page.locator('[data-commerce-catalog]');
        const cards = shelf.locator('[data-product-link]');
        expect(await cards.count()).toBeGreaterThan(0);
        const facts = [];
        for (const card of await cards.all()) {
          const title = (await card.locator('h3').innerText()).trim();
          const price = (await card.locator('.price').innerText()).trim();
          const availability = (await card.locator('[data-commerce-availability]').innerText()).trim();
          const imageAlt = await card.locator('img').getAttribute('alt');
          await expect(card).toHaveAccessibleName(title, { exact: true });
          await expect(card).toHaveAccessibleDescription(`${price} ${availability}`);
          const references = await card.evaluate(node => ['aria-labelledby', 'aria-describedby'].map(attribute => {
            const id = node.getAttribute(attribute);
            return { id, matches: id ? document.querySelectorAll(`[id="${id}"]`).length : 0,
              local: Boolean(id && node.querySelector(`[id="${id}"]`)) };
          }));
          expect(references.every(reference => reference.matches === 1 && reference.local)).toBe(true);
          await expect(card.locator('img')).toHaveAccessibleName(imageAlt, { exact: true });
          await expect(card.locator('h3')).toBeVisible();
          await expect(card.locator('.shop-card__facts')).toBeVisible();
          expect(await card.locator('a, button, input').count()).toBe(0);
          facts.push({ title, price, availability, imageAlt, href: await card.getAttribute('href') });
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const tree = await shelf.ariaSnapshot();
        // Keyboard follows the same sole card link with enhancement on or off.
        await page.keyboard.press('Tab');
        const first = cards.first(), destination = await first.getAttribute('href');
        await first.focus();
        expect(await first.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');
        if (path === '/shop') {
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({ path: new URL(`shop-${width}-${colorScheme}-js-${javaScriptEnabled ? 'on' : 'off'}.png`, output).pathname, fullPage: true });
        }
        await first.press('Enter');
        await expect(page).toHaveURL(base + destination);
        await expect(page.locator('h1')).toHaveText(facts[0].title);
        routes.push({ path, cards: facts, tree, uniqueLocalReferences: true, nativeKeyboardDestination: true });
      }
      expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'))).toBeNull();
      expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-checkout.v1'))).toBeNull();
      expect(writes).toEqual([]); expect(checkoutRequests).toEqual([]); expect(errors).toEqual([]);
      results.push({ width, colorScheme, javaScriptEnabled, routes, savedIntent: false, writes: 0, checkoutRequests: 0, browserErrors: 0 });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
const report = { checkedAt: new Date().toISOString(), base, scope: 'Browser accessibility names/descriptions and native navigation, not screen-reader device qualification.', results };
await writeFile(new URL('verification.json', output), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
