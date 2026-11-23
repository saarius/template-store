import { expect, test } from '@playwright/test';

for (const colorScheme of ['light', 'dark'] as const) for (const javaScriptEnabled of [true, false]) {
  test(`collection trail · ${colorScheme} · scripts ${javaScriptEnabled}`, async ({ browser, baseURL }, info) => {
    const context = await browser.newContext({ baseURL, colorScheme, javaScriptEnabled,
      viewport: info.project.use.viewport, reducedMotion: 'reduce', serviceWorkers: 'block',
      userAgent: 'BackroadBum-SelfCheck/1.0' });
    const writes: string[] = [];
    await context.route('**/*', route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) writes.push(new URL(request.url()).pathname);
      return ['GET', 'HEAD'].includes(request.method()) && new URL(request.url()).origin === new URL(baseURL!).origin
        ? route.continue() : route.abort();
    });
    try {
      const page = await context.newPage();
      const crumb = page.getByRole('navigation', { name: 'Breadcrumb' });
      const openCard = async (title: string, collection: string, product: string) => {
        const card = page.getByRole('link', { name: title, exact: true }).filter({ has: page.getByRole('heading', { name: title, exact: true }) });
        await expect(card).toHaveAttribute('href', `/products/${product}?collection=${collection}`);
        await card.focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
      };
      for (const [collection, label, slug, title, fallback, price, availability] of [
        ['slow-camp', 'Slow camp', 'glovebox-field-tote', 'Glovebox Field Tote', 'Road day', '$32.00', 'Available on backorder'],
        ['road-day', 'Road day', 'switchback-bandana', 'Switchback Bandana', 'Slow camp', '$14.00', 'In stock'],
      ] as const) {
        expect((await page.goto(`/categories/${collection}`))?.status()).toBe(200);
        await openCard(title, collection, slug);
        const back = crumb.getByRole('link', { name: label, exact: true });
        await expect(back).toHaveAttribute('href', `/categories/${collection}`);
        await expect(crumb.getByRole('link', { name: fallback, exact: true })).toHaveCount(0);
        expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await expect(page.locator('[data-product-price]')).toContainText(price);
        await expect(page.locator('[data-product-status]')).toHaveText(availability);
        const canonical = await page.locator('link[rel=canonical]').getAttribute('href');
        expect(new URL(canonical!).pathname + new URL(canonical!).search).toBe(`/products/${slug}`);
        await back.focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('heading', { level: 1, name: label, exact: true })).toBeVisible();
        await page.goto(`/products/${slug}`);
        await expect(crumb.getByRole('link', { name: fallback, exact: true })).toBeVisible();
      }
      await page.goto('/categories/slow-camp');
      await openCard('Last Light Fleece', 'slow-camp', 'last-light-fleece');
      const members = JSON.parse((await page.locator('[data-variant-members]').textContent())!);
      const xl = members.find((member: { id: string; values: { Size: string } }) => member.values.Size === 'XL').id;
      if (javaScriptEnabled) await page.getByRole('radio', { name: 'XL', exact: true }).check();
      else {
        await page.getByLabel('View a product option', { exact: true }).selectOption(xl);
        await page.getByRole('button', { name: 'View option', exact: true }).click();
      }
      await expect(page).toHaveURL(url => url.searchParams.get('item') === xl && url.searchParams.get('collection') === 'slow-camp');
      await page.reload();
      await expect(page.locator('[data-product-status]')).toHaveText('Available on backorder');
      if (javaScriptEnabled) await expect(page.getByRole('radio', { name: 'XL', exact: true })).toBeChecked();
      else await expect(page.getByLabel('View a product option', { exact: true })).toHaveValue(xl);
      await expect(crumb.getByRole('link', { name: 'Slow camp', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.goto(`/products/last-light-fleece?item=${xl}&collection=road-day`);
      await expect(crumb.getByRole('link', { name: 'Road day', exact: true })).toHaveCount(0);
      await expect(crumb.getByRole('link', { name: 'Slow camp', exact: true })).toBeVisible();
      expect(writes).toEqual([]);
    } finally { await context.close(); }
  });
}
