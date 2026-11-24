import { expect, test } from '@playwright/test';

// The unavailable path is exercised against an isolated copy, not live Commerce.
const catalogUnavailable = process.env.BACKROADBUM_COLLECTION_CATALOG_UNAVAILABLE === '1';

for (const colorScheme of ['light', 'dark'] as const) for (const javaScriptEnabled of [true, false]) {
  test(`collection navigation · ${colorScheme} · scripts ${javaScriptEnabled}`, async ({ browser, baseURL }, info) => {
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
      const nav = page.getByRole('navigation', { name: 'Shop collections' });
      const catalog = page.locator('[data-commerce-catalog]');
      const shelves = [
        ['/shop', 'All gear', 'Pack a little possibility.'],
        ['/categories/road-day', 'Road day', 'Road day'],
        ['/categories/slow-camp', 'Slow camp', 'Slow camp'],
      ] as const;
      const response = (await page.goto(shelves[0][0]))!;
      expect(response.status()).toBe(200);
      if (catalogUnavailable) expect(response.headers()['cache-control']).toContain('no-store');
      for (const [index, [path, label, heading]] of shelves.entries()) {
        if (index > 0) {
          const target = nav.locator(`a[href="${path}"]`);
          await expect(target).not.toHaveAttribute('aria-current', 'page');
          await target.focus();
          await expect(target).toBeFocused();
          const [next] = await Promise.all([
            page.waitForResponse(response => response.url() === origin + path && response.request().isNavigationRequest()),
            page.keyboard.press('Enter'),
          ]);
          expect(next.status()).toBe(200);
          if (catalogUnavailable) expect(next.headers()['cache-control']).toContain('no-store');
        }
        await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
        await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute('href', path);
        const links = nav.locator('a');
        await expect(links).toHaveCount(shelves.length);
        await expect(nav.locator(`a[href="${path}"]`)).toHaveText(catalogUnavailable ? label : new RegExp(`^${label} \\([1-9]\\d*\\)$`));
        if (catalogUnavailable) {
          await expect(nav.locator('a span')).toHaveCount(0);
          await expect(catalog.getByRole('alert')).toContainText('The product catalog is temporarily unavailable.');
          await expect(catalog.locator('[data-commerce-product], [data-commerce-empty]')).toHaveCount(0);
        } else {
          await expect(catalog.getByRole('alert')).toHaveCount(0);
          const cards = catalog.locator('[data-commerce-product]');
          const count = await cards.count();
          expect(count).toBeGreaterThan(0);
          await expect(nav.locator('a[aria-current="page"]')).toHaveText(`${label} (${count})`);
          if (index > 0) await expect(cards.first()).toHaveAttribute('href', new RegExp(`^/products/[^?]+\\?collection=${path.split('/').at(-1)}$`));
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(info.project.use.viewport!.width);
      }
      const back = nav.getByRole('link', { name: /^All gear/ });
      await back.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(origin + '/shop');
      expect((await page.goto('/categories/not-a-published-collection'))?.status()).toBe(404);
      await expect(page.getByRole('heading', { name: 'That collection isn’t here.' })).toBeVisible();
      expect(writes).toEqual([]);
    } finally { await context.close(); }
  });
}
