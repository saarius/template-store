import { expect, test } from '@playwright/test';

for (const colorScheme of ['light', 'dark'] as const) for (const javaScriptEnabled of [true, false]) {
  test(`stock guidance follows the chosen tee size · ${colorScheme} · scripts ${javaScriptEnabled}`, async ({ browser, baseURL }, info) => {
    const context = await browser.newContext({ baseURL, colorScheme, javaScriptEnabled,
      viewport: info.project.use.viewport, reducedMotion: 'reduce', serviceWorkers: 'block',
      userAgent: 'BackroadBum-SelfCheck/1.0' });
    const writes: string[] = [];
    await context.route('**/*', route => {
      const request = route.request();
      const read = ['GET', 'HEAD'].includes(request.method());
      if (!read) writes.push(request.method());
      return read && new URL(request.url()).origin === new URL(baseURL!).origin ? route.continue() : route.abort();
    });
    try {
      const page = await context.newPage();
      const path = '/products/wrong-turn-tee';
      expect((await page.goto(path))?.status()).toBe(200);
      const isClosed = process.env.BACKROADBUM_EXPECT_CHECKOUT === 'closed';
      await expect(page.locator('[data-store-demo-banner]')).toHaveAttribute('data-checkout-available', String(!isClosed));
      const members: { id: string; values: { Size: string } }[] = JSON.parse((await page.locator('[data-variant-members]').textContent())!);
      const xl = members.find(member => member.values.Size === 'XL')!.id;
      const medium = members.find(member => member.values.Size === 'M')!.id;
      const stock = page.locator('[data-product-status]');
      const add = page.locator('[data-add-to-cart]');
      const notice = page.locator('[data-not-purchasable]');
      const expectPageNotice = async () => {
        if (isClosed) await expect(notice).toContainText('Checkout is unavailable right now');
        else await expect(notice).toHaveCount(0);
      };
      expect((await page.goto(`${path}?item=${xl}`))?.status()).toBe(200);
      await expect(stock).toHaveText('Out of stock');
      await expect(add).toHaveAttribute('data-add-to-cart-sellable', 'false');
      await expectPageNotice();
      const choose = async (size: string, id: string) => {
        if (javaScriptEnabled) await page.locator(`[data-variant-choice][value="${size}"]`).check();
        else {
          await page.getByLabel('View a product option', { exact: true }).selectOption(id);
          await page.getByRole('button', { name: 'View option', exact: true }).click();
        }
        await expect(page).toHaveURL(url => url.searchParams.get('item') === id);
      };
      await choose('M', medium);
      await expect(stock).toHaveText('In stock');
      await expect(add).toHaveAttribute('data-add-to-cart', medium);
      await expect(add).toHaveAttribute('data-add-to-cart-sellable', 'true');
      if (javaScriptEnabled) await expect(add).toBeEnabled();
      await expectPageNotice();
      await choose('XL', xl);
      await expect(stock).toHaveText('Out of stock');
      await expect(add).toHaveAttribute('data-add-to-cart-sellable', 'false');
      if (javaScriptEnabled) await expect(add).toBeDisabled();
      await expectPageNotice();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(writes).toEqual([]);
    } finally { await context.close(); }
  });
}
