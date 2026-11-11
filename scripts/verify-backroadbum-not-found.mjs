// Public, read-only missing-page recovery checks. No retained checkout capability or merchant session.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/not-found/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const routes = [
  ['/field-notes/not-published?private_marker=do-not-reflect-this-query', 'Page not found'],
  ['/not-published', 'Page not found'],
  ['/products/not-published', 'Product not found'],
  ['/categories/not-published', 'That collection isn’t here.'],
];
const options = { reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' };
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ ...options, viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = [], writes = [], checkoutRequests = [];
    page.on('pageerror', error => errors.push(error.name));
    page.on('request', request => {
      if (!['GET', 'HEAD'].includes(request.method())) writes.push(new URL(request.url()).pathname);
      if (/checkout\/(start|prepare|status)|guest-cart\/snapshot/.test(request.url())) checkoutRequests.push(new URL(request.url()).pathname);
    });
    for (const [path, title] of routes) {
      const response = await page.goto(base + path);
      expect(response.status()).toBe(404);
      const missing = page.locator('[data-page-not-found]');
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(missing.locator('h1')).toHaveText(title);
      await expect(page.locator('.store-header')).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(page.locator('link[rel="canonical"], [data-product-jsonld]')).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText('do-not-reflect-this-query');
      await expect(page.locator('main')).not.toContainText(/Path:|Astro|paid successfully/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const search = missing.getByRole('searchbox', { name: 'Search the store', exact: true });
      const button = missing.getByRole('button', { name: 'Search', exact: true });
      const shop = missing.getByRole('link', { name: 'Browse all gear', exact: true });
      const notes = missing.getByRole('link', { name: 'Read field notes', exact: true });
      const checkout = missing.getByRole('link', { name: 'Open your last checkout', exact: true });
      for (const control of [search, button, shop, notes, checkout]) expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(48);
      await search.focus();
      for (const next of [button, shop, notes, checkout]) { await page.keyboard.press('Tab'); await expect(next).toBeFocused(); }
      expect(await checkout.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none');
      if (path.startsWith('/field-notes/')) {
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: new URL(`after-${width}.png`, output).pathname, fullPage: true });
      }
      if (path === '/not-published') {
        // Native GET search is the useful destination, not a client-side imitation.
        await search.fill('bandana'); await search.press('Enter');
        await expect(page).toHaveURL(base + '/search?q=bandana');
        await expect(page.locator('[data-search-results]')).toContainText('Switchback Bandana');
      }
    }
    // One keyboard activation reaches the ordinary shop; it cannot start a checkout.
    await page.locator('[data-page-not-found] a[href="/shop"]').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(base + '/shop');
    expect((await page.locator('[data-commerce-product]').count())).toBeGreaterThan(0);
    expect(errors).toEqual([]); expect(writes).toEqual([]); expect(checkoutRequests).toEqual([]);
    results.push({ width, routes: routes.length, http404: true, noindex: true, noCanonicalOrProductMetadata: true, noQueryReflection: true,
      nativeSearch: true, keyboardOrder: true, controls48px: true, fits: true, writes: 0, checkoutRequests: 0, browserErrors: 0 });
    await context.close();
  }
  const context = await browser.newContext({ ...options, javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  expect((await page.goto(base + '/field-notes/not-published')).status()).toBe(404);
  const missing = page.locator('[data-page-not-found]');
  await missing.getByRole('searchbox', { name: 'Search the store' }).fill('bandana');
  await missing.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(base + '/search?q=bandana');
  await expect(page.locator('[data-search-results]')).toContainText('Switchback Bandana');
  await page.goto(base + '/not-published');
  await page.locator('[data-page-not-found] a[href="/field-notes"]').click();
  await expect(page).toHaveURL(base + '/field-notes');
  results.push({ javaScript: false, http404: true, nativeSearch: true, fieldNotesNavigation: true });
  await context.close();
} finally { await browser.close(); }
const evidence = { verifiedAt: new Date().toISOString(), base, results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
