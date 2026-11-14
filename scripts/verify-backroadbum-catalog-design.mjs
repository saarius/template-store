// Read-only merchant layout/keyboard proof. No checkout, admin calls or saved intent changes.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/catalog-design/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [390, 1440]) for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme,
      reducedMotion: 'no-preference', userAgent: 'BackroadBum-SelfCheck/1.0' });
    const writes = [], errors = [], checkout = [];
    await context.route('**/*', route => {
      const request = route.request();
      if (new URL(request.url()).pathname.startsWith('/api/checkout/')) checkout.push(new URL(request.url()).pathname);
      if (['GET', 'HEAD'].includes(request.method())) return route.continue();
      writes.push(new URL(request.url()).pathname); return route.abort();
    });
    try {
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.name));
      const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.goto(base + '/shop');
      await expect(page.locator('[data-product-link]')).toHaveCount(7);
      const firstCard = page.locator('[data-product-link]').first();
      await firstCard.hover();
      expect(await firstCard.locator('img').evaluate(node => ({
        filter: getComputedStyle(node).filter, transform: getComputedStyle(node).transform,
      }))).toEqual({ filter: 'none', transform: 'none' });
      const collectionNav = page.getByRole('navigation', { name: 'Shop collections' });
      await expect(collectionNav.getByRole('link', { name: 'All gear (7)', exact: true })).toHaveAttribute('aria-current', 'page');
      for (const link of await collectionNav.getByRole('link').all()) {
        const box = await link.boundingBox(); expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await fits();
      await collectionNav.getByRole('link', { name: 'Slow camp (4)', exact: true }).click();
      await expect(page).toHaveURL(base + '/categories/slow-camp');
      await expect(page.locator('h1')).toHaveText('Slow camp'); await fits();
      await page.goto(base + '/products/wrong-turn-tee');
      const medium = page.getByRole('radio', { name: 'M', exact: true });
      await expect(medium).toBeChecked(); await medium.focus();
      const pill = page.locator('.product-variant').filter({ has: medium });
      expect(await pill.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');
      for (const option of await page.locator('.product-variant').all()) {
        const box = await option.boundingBox(); expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
      }
      // Native radio arrows change the same member used by price, metadata and Add.
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('radio', { name: 'L', exact: true })).toBeChecked();
      const members = JSON.parse(await page.locator('[data-variant-members]').textContent());
      const large = members.find(member => member.values.Size === 'L');
      await expect(page.locator('[data-add-to-cart]')).toHaveAttribute('data-add-to-cart', large.id);
      await expect(page.locator('[data-variant-price]')).toHaveText(large.price);
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('radio', { name: 'XL (sold out)', exact: true })).toBeChecked();
      await expect(page.locator('[data-add-to-cart]')).toBeDisabled();
      await page.screenshot({ path: new URL(`options-${width}-${colorScheme}.png`, output).pathname });
      await fits();
      if (width === 1440) {
        const ratio = await page.locator('.product-detail').evaluate(node => {
          const columns = getComputedStyle(node).gridTemplateColumns.split(' ').map(parseFloat); return columns[0] / columns[1];
        });
        expect(ratio).toBeCloseTo(1.618, 2);
      }
      await page.goto(base + '/products/creekside-camp-mug');
      await expect(page.getByRole('region', { name: 'Product pictures', exact: true }).locator('img')).toHaveCount(3);
      await page.locator('[data-product-stage-visual]').hover();
      expect(await page.locator('[data-product-stage-visual] img').evaluate(node => ({
        filter: getComputedStyle(node).filter, transform: getComputedStyle(node).transform,
      }))).toEqual({ filter: 'none', transform: 'none' });
      await expect(page.locator('[data-product-details]')).toContainText('Details & care');
      await expect(page.locator('[data-product-details] dt')).toHaveCount(3);
      await page.locator('[data-product-details]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: new URL(`details-${width}-${colorScheme}.png`, output).pathname }); await fits();
      await page.goto(base + '/search');
      await page.getByLabel('What are you looking for?', { exact: true }).fill('mug');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await expect(page).toHaveURL(base + '/search?q=mug');
      await expect(page.getByRole('region', { name: 'Gear', exact: true })).toContainText('Creekside Camp Mug');
      await expect(page.getByRole('region', { name: 'Field notes & guides', exact: true })).toContainText('The wet-gear reset'); await fits();
      expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'))).toBeNull();
      expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-checkout.v1'))).toBeNull();
      expect(writes).toEqual([]); expect(errors).toEqual([]); expect(checkout).toEqual([]);
      results.push({ width, colorScheme, collectionFilters: true, accessiblePillNames: true, nativeRadioArrows: true,
        exactSelectedMember: true, soldOutRefused: true, nativeMugDetails: true, searchGet: true,
        noOverflow: true, noSavedIntent: true, nativeColorOnHover: true, writes: 0, checkoutRequests: 0, browserErrors: 0 });
    } finally { await context.close(); }
    const plain = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme,
      javaScriptEnabled: false, userAgent: 'BackroadBum-SelfCheck/1.0' });
    try {
      const page = await plain.newPage();
      await plain.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
      await page.goto(base + '/products/wrong-turn-tee');
      await expect(page.locator('[data-product-variants]')).toBeHidden();
      const fallback = page.locator('[data-product-options-fallback]');
      await expect(fallback).toBeVisible();
      await fallback.getByLabel('View a product option', { exact: true }).selectOption({ label: 'Size: XL' });
      await fallback.getByRole('button', { name: 'View option', exact: true }).click();
      await expect(page.locator('[data-product-status]')).toHaveText('Out of stock');
      await expect(page.locator('[data-product-price]')).toHaveText('$34.00');
      await expect(page.locator('[data-product-options-fallback] select')).toHaveValue(new URL(page.url()).searchParams.get('item'));
      await page.goto(base + '/search');
      await page.getByLabel('What are you looking for?', { exact: true }).fill('mug');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Gear', exact: true })).toContainText('Creekside Camp Mug');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      results.push({ width, colorScheme, javaScript: false, selectedOptionGet: true, exactSoldOutPrice: true, searchGet: true, noOverflow: true });
    } finally { await plain.close(); }
  }
} finally { await browser.close(); }
const report = { checkedAt: new Date().toISOString(), scope: 'Merchant catalog geometry and native keyboard/GET behavior, not a provider payment or CMS write.', results };
await writeFile(new URL('verification.json', output), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
