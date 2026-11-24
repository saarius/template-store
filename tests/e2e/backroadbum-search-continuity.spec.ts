import { expect, test } from '@playwright/test';

// The outage fixture runs only against a disposable storefront without Commerce.
const catalogUnavailable = process.env.BACKROADBUM_SEARCH_CATALOG_UNAVAILABLE === '1';

for (const colorScheme of ['light', 'dark'] as const) for (const javaScriptEnabled of [true, false]) {
  test(`search continuity · ${colorScheme} · scripts ${javaScriptEnabled}`, async ({ browser, baseURL }, info) => {
    const origin = new URL(baseURL!).origin;
    if (catalogUnavailable) expect(new URL(origin).hostname).toBe('127.0.0.1');
    const context = await browser.newContext({ baseURL, colorScheme, javaScriptEnabled,
      viewport: info.project.use.viewport, serviceWorkers: 'block', userAgent: 'BackroadBum-SelfCheck/1.0' });
    const writes: string[] = [];
    await context.route('**/*', route => {
      const request = route.request();
      const url = new URL(request.url());
      const read = ['GET', 'HEAD'].includes(request.method());
      if (!read) writes.push(url.pathname);
      return read && url.origin === origin ? route.continue() : route.abort();
    });
    try {
      const page = await context.newPage();
      const mixed = (await page.goto('/search?q=fleece'))!;
      expect(mixed.status()).toBe(200);
      expect(mixed.headers()['cache-control']).toContain('no-store');
      await expect(page.getByLabel('What are you looking for?')).toHaveValue('fleece');
      const notice = page.locator('[data-search-catalog-notice]');
      const gear = page.getByRole('region', { name: 'Gear', exact: true });
      if (catalogUnavailable) {
        await expect(notice).toContainText('Gear results are temporarily unavailable.');
        await expect(gear).toHaveCount(0);
        await expect(page.locator('[data-search-option], [data-search-empty]')).toHaveCount(0);
        await expect(page.locator('[data-search-results-count]')).toHaveText('1 result.');
      } else {
        await expect(notice).toHaveCount(0);
        await expect(gear.getByRole('link', { name: 'Last Light Fleece' })).toHaveAttribute('href', '/products/last-light-fleece');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(info.project.use.viewport!.width);
      const note = page.getByRole('region', { name: 'Field notes & guides' }).getByRole('link', { name: 'A layer within reach' });
      await expect(note).toHaveAttribute('href', '/field-note-a-layer-within-reach');
      await note.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { level: 1, name: 'A layer within reach' })).toBeVisible();

      const exact = (await page.goto('/search?q=fleece+XL'))!;
      if (catalogUnavailable) {
        expect(exact.status()).toBe(503);
        await expect(page.locator('[data-search-unavailable]')).toBeVisible();
        await expect(page.locator('[data-search-empty], [data-search-results]')).toHaveCount(0);
      } else {
        expect(exact.status()).toBe(200);
        await expect(gear.getByRole('link', { name: /Last Light Fleece.*Size: XL/ })).toHaveAttribute('href', /^\/products\/last-light-fleece\?item=.+/);
        await expect(gear.locator('[data-search-option]')).toContainText('Available on backorder');
      }
      expect((await page.goto('/search?q=offline'))?.status()).toBe(200);
      await expect(notice).toHaveCount(0);
      await expect(page.locator('[data-search-results] a[href="/field-note-before-the-signal-drops"]')).toBeVisible();
      expect(writes).toEqual([]);
    } finally { await context.close(); }
  });
}
