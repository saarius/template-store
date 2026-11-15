import { expect, test } from '@playwright/test';

// Read-only merchant acceptance. Existing published prose and signed product
// facts stay authoritative; no email, checkout or merchant writes are allowed.
for (const colorScheme of ['light', 'dark'] as const) for (const javaScriptEnabled of [true, false]) {
  test(`native product details round-trip · ${colorScheme} · scripts ${javaScriptEnabled}`, async ({ browser, baseURL }, testInfo) => {
    const context = await browser.newContext({ baseURL, colorScheme, javaScriptEnabled,
      viewport: testInfo.project.use.viewport, reducedMotion: 'reduce', serviceWorkers: 'block',
      userAgent: 'BackroadBum-SelfCheck/1.0' });
    const writes: string[] = [], errors: string[] = [];
    await context.route('**/*', route => {
      if (!['GET', 'HEAD'].includes(route.request().method())) {
        writes.push(new URL(route.request().url()).pathname);
        return route.abort();
      }
      return route.continue();
    });
    try {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.name));
      for (const slug of ['last-light-fleece', 'creekside-camp-mug', 'wrong-turn-tee']) {
        expect((await page.goto(`/products/${slug}`))?.status()).toBe(200);
        if (slug !== 'creekside-camp-mug') {
          if (javaScriptEnabled) await page.locator('[data-variant-choice][value="XL"]').check();
          else {
            const members = JSON.parse((await page.locator('[data-variant-members]').textContent())!);
            const xl = members.find((member: { id: string; values: { Size: string } }) => member.values.Size === 'XL');
            await page.getByLabel('View a product option', { exact: true }).selectOption(xl.id);
            await page.getByRole('button', { name: 'View option', exact: true }).click();
          }
        }
        await page.evaluate(() => localStorage.setItem('dinkus.guest-cart.v1', JSON.stringify({ version: 1,
          lines: [{ id: 'details-navigation-fixture', quantity: 2 }] })));
        const selection = new URL(page.url()).search;
        const buyingFacts = await page.locator('[data-product-price], [data-product-status]').allTextContents();
        const metadata = await page.locator('[data-product-jsonld]').textContent();
        const quantity = page.locator('[data-add-to-cart-qty]');
        if (javaScriptEnabled) await quantity.fill('3');
        const intentBefore = await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'));
        const shortcut = page.locator('.product-detail__body a[href="#product-details"]');
        await expect(shortcut).toHaveCount(1);
        await expect(shortcut).toHaveText(slug === 'wrong-turn-tee' ? 'Compare tee measurements' : 'Details & care ↓');
        expect((await shortcut.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await shortcut.focus(); await page.keyboard.press('Enter');
        const details = page.locator('#product-details');
        await expect(details).toBeFocused();
        await expect(page).toHaveURL(/#product-details$/);
        expect(await details.evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
        await expect(details.getByRole('heading', { name: 'Details & care', exact: true })).toBeInViewport();
        const disclosure = details.locator('summary').first();
        const openBefore = await disclosure.evaluate(el => el.parentElement!.hasAttribute('open'));
        await disclosure.focus(); await page.keyboard.press('Enter');
        await expect(details.locator('details').first()).toHaveJSProperty('open', !openBefore);
        const returnLink = details.getByRole('link', { name: 'Back to product options', exact: true });
        await returnLink.focus(); await page.keyboard.press('Enter');
        await expect(page.locator('h1')).toBeFocused();
        await expect(page.locator('h1')).toBeInViewport();
        await expect(page).toHaveURL(/#product-title$/);
        expect(new URL(page.url()).search).toBe(selection);
        expect(await page.locator('[data-product-price], [data-product-status]').allTextContents()).toEqual(buyingFacts);
        expect(await page.locator('[data-product-jsonld]').textContent()).toBe(metadata);
        if (javaScriptEnabled) await expect(quantity).toHaveValue('3');
        expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'))).toBe(intentBefore);
        expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-checkout.v1'))).toBeNull();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      expect((await page.goto('/products/not-a-backroad-product'))?.status()).toBe(404);
      await expect(page.locator('a[href="#product-details"], a[href="#product-title"]')).toHaveCount(0);
      expect(writes).toEqual([]); expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}
