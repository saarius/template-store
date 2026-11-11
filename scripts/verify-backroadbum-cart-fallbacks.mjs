// Read-only merchant UI regression. Snapshot refusals are synthetic; real Commerce supplies recovery.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.BACKROADBUM_VERIFY_URL ?? 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/cart-fallbacks/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, userAgent: 'BackroadBum-SelfCheck/1.0' });
    const page = await context.newPage();
    const errors = [], checkout = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\/api\/checkout\//.test(request.url())) checkout.push(new URL(request.url()).pathname); });
    const items = [];
    for (const slug of ['switchback-bandana', 'creekside-camp-mug']) {
      expect((await page.goto(base + '/products/' + slug)).status()).toBe(200);
      items.push({ id: await page.locator('[data-commerce-item]').getAttribute('data-commerce-item'), name: await page.locator('h1').textContent() });
    }
    expect(items.every(item => item.id)).toBe(true);
    const intent = JSON.stringify({ version: 1, lines: items.map((item, index) => ({ id: item.id, quantity: index + 2 })) });
    await page.evaluate(value => localStorage.setItem('dinkus.guest-cart.v1', value), intent);
    let mode = 'missing';
    await page.route('**/api/guest-cart/snapshot?**', async route => {
      if (mode === 'missing') return route.fulfill({ json: { products: items.map(item => ({ id: item.id, found: false })) } });
      if (mode === 'failed') return route.fulfill({ status: 503, json: { error: 'Synthetic unavailable catalog' } });
      return route.continue();
    });
    const stored = () => page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'));
    const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto(base + '/cart');
    const lines = page.locator('[data-guest-cart-line]');
    await expect(lines).toHaveCount(2);
    await expect(lines.locator('h2')).toHaveText(['Unavailable item 1', 'Unavailable item 2']);
    await expect(page.getByRole('textbox', { name: 'Quantity for Unavailable item 1', exact: true })).toHaveValue('2');
    await expect(page.getByRole('textbox', { name: 'Quantity for Unavailable item 2', exact: true })).toHaveValue('3');
    await expect(page.getByRole('button', { name: 'Remove Unavailable item 2', exact: true })).toHaveCount(1);
    await expect(lines.locator('[data-guest-cart-product-link]')).toHaveCount(0);
    await expect(lines.locator('[data-guest-cart-line-reason]')).toHaveText(Array(2).fill('This product is no longer in the catalog and cannot be checked out.'));
    await expect(page.locator('[data-guest-cart-checkout]')).toBeDisabled();
    expect(await stored()).toBe(intent);
    await fits();
    await page.screenshot({ path: new URL(`missing-${width}.png`, output).pathname });

    // Removing one missing line still targets its original Commerce identity, not the displayed position.
    await page.getByRole('button', { name: 'Remove Unavailable item 1', exact: true }).click();
    await expect(lines).toHaveCount(1);
    await expect(lines.locator('h2')).toHaveText('Unavailable item 1');
    expect(JSON.parse(await stored()).lines).toEqual([{ id: items[1].id, quantity: 3 }]);

    // A fresh failed lookup does not say the product has definitely gone away.
    await page.evaluate(value => localStorage.setItem('dinkus.guest-cart.v1', value), intent);
    mode = 'failed';
    await page.reload();
    await expect(page.locator('[data-guest-cart-status]')).toContainText("We couldn't load the latest prices.");
    await expect(lines.locator('h2')).toHaveText(['Item 1', 'Item 2']);
    await expect(page.getByRole('textbox', { name: 'Quantity for Item 1', exact: true })).toHaveValue('2');
    await expect(page.locator('[data-guest-cart-checkout]')).toBeDisabled();
    expect(await stored()).toBe(intent);

    // Recovery reads the real signed Commerce snapshot; no stored product names or invented prices.
    mode = 'real';
    await page.locator('[data-guest-cart-retry]').click();
    await expect(lines.locator('h2')).toHaveText(items.map(item => item.name));
    await expect(lines.locator('[data-guest-cart-line-reason]')).toHaveCount(0);
    await expect(page.locator('[data-guest-cart-subtotal-amount]')).toHaveText('$86.00');
    expect(await stored()).toBe(intent);
    await fits();
    await page.screenshot({ path: new URL(`recovered-${width}.png`, output).pathname });
    expect(errors).toEqual([]); expect(checkout).toEqual([]);
    results.push({ width, syntheticMissing: true, distinctHeadingAndControlLabels: true, removedOriginalIdentityOnly: true,
      freshFailureUsesNeutralLabels: true, realCommerceRecovery: true, recoveredSubtotal: '86.00', intentUnchanged: true,
      noOverflow: true, browserErrors: 0, checkoutRequests: 0 });
    await context.close();
  }
} finally { await browser.close(); }
const report = { checkedAt: new Date().toISOString(), scope: 'Synthetic missing/failed snapshot UI with real signed Commerce recovery. Browser-local intent only; no merchant or checkout writes.', results };
await writeFile(new URL('verification.json', output), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
