// Read-only shopper check: cart product links use published CMS destinations,
// while each saved line retains its Commerce identity. No checkout is started.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.STORE_URL || 'https://backroadbum.com';
const out = new URL('../runs/backroadbum/cart-products/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [], writes = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/checkout/') && request.method() !== 'GET') writes.push(request.method()); });
    await page.goto(base + '/products/wrong-turn-tee');
    for (const size of ['M', 'L']) {
      await page.getByRole('radio', { name: size, exact: true }).check();
      await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
      await expect(page.locator('[data-add-to-cart-status]')).toHaveText('Added to cart.');
    }
    await page.goto(base + '/products/switchback-bandana');
    await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
    await page.goto(base + '/cart');
    const lines = page.locator('[data-guest-cart-line]');
    const links = page.locator('[data-guest-cart-product-link]');
    await expect(lines).toHaveCount(3);
    await expect(links).toHaveCount(3);
    expect(await links.first().evaluate(link => getComputedStyle(link).color)).toBe('rgb(24, 63, 82)');
    await expect(links.nth(0)).toHaveAttribute('href', '/products/wrong-turn-tee');
    await expect(links.nth(1)).toHaveAttribute('href', '/products/wrong-turn-tee');
    await expect(links.nth(2)).toHaveAttribute('href', '/products/switchback-bandana');
    await expect(links.nth(1)).toHaveText(/Wrong Turn Tee.*L/);
    await expect(page.locator('[data-guest-cart-subtotal-amount]')).toHaveText('$84.00');
    const saved = await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'));
    await links.nth(1).focus();
    await expect(links.nth(1)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(base + '/products/wrong-turn-tee');
    await expect(page.locator('h1')).toHaveText('Wrong Turn Tee');
    expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'))).toBe(saved);
    await page.goBack();
    await expect(links).toHaveCount(3);
    await lines.nth(2).locator('[data-guest-cart-qty]').fill('2');
    await expect(page.locator('[data-guest-cart-subtotal-amount]')).toHaveText('$100.00');
    await expect(lines.nth(2).locator('[data-guest-cart-qty]')).toBeFocused();
    await expect(links).toHaveCount(3);
    await page.screenshot({ path: new URL(`cart-${width}.png`, out).pathname, fullPage: true });
    const edited = await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'));
    await page.goto(base + '/checkout');
    await expect(links).toHaveCount(3);
    expect(await links.first().evaluate(link => getComputedStyle(link).color)).toBe('rgb(24, 63, 82)');
    await expect(page.locator('[data-guest-cart-checkout]')).toBeDisabled();
    await page.screenshot({ path: new URL(`checkout-${width}.png`, out).pathname, fullPage: true });
    expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'))).toBe(edited);
    // The browser also rejects a forged destination; this does not alter server data.
    await page.route('**/api/guest-cart/snapshot?**', async route => {
      const response = await route.fetch();
      const body = await response.json();
      body.products[0].productPath = 'https://example.invalid/steal';
      delete body.products[1].productPath;
      await route.fulfill({ response, json: body });
    });
    await page.goto(base + '/cart');
    await expect(links).toHaveCount(1);
    await expect(links).toHaveAttribute('href', '/products/switchback-bandana');
    await expect(lines).toHaveCount(3);
    await expect(page.locator('[data-guest-cart-subtotal-amount]')).toHaveText('$100.00');
    expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'))).toBe(edited);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]); expect(writes).toEqual([]);
    results.push({ width, lines: 3, distinctMemberIds: JSON.parse(edited).lines.map(line => line.id), subtotal: '$100.00', keyboardReturn: true, unsafeAndMissingPathsOmitted: true, checkoutRequests: writes.length, errors });
    await context.close();
  }
  await writeFile(new URL('verification.json', out), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
