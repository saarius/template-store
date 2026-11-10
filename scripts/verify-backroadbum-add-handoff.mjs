// Merchant product → cart proof. Browser-local cart edits only; never starts checkout.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.BACKROADBUM_VERIFY_URL ?? 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/add-handoff/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    const page = await context.newPage();
    const errors = [], checkout = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\/api\/checkout\//.test(request.url())) checkout.push(new URL(request.url()).pathname); });
    const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await page.goto(base + '/products/long-way-cap')).status()).toBe(200);
    const add = page.getByRole('button', { name: 'Add to cart', exact: true });
    const view = page.locator('[data-add-to-cart-view]');
    const status = page.locator('[data-add-to-cart-status]');
    await expect(view).toBeHidden();
    await page.getByRole('button', { name: 'Increase quantity', exact: true }).click();
    await expect(page.locator('[data-add-to-cart-qty]')).toHaveValue('2');
    await add.click();
    await expect(status).toHaveText('Added to cart.');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(view).toBeVisible();
    await expect(view).toHaveAttribute('href', '/cart');
    await expect(view).toHaveAccessibleName('View cart');
    await add.focus(); await page.keyboard.press('Tab');
    await expect(view).toBeFocused();
    expect(await view.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    expect(await view.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48);
    await page.evaluate(() => document.fonts.ready); await fits();
    await page.screenshot({ path: new URL(`after-${width}.png`, output).pathname, fullPage: true });
    await view.press('Enter');
    await expect(page).toHaveURL(base + '/cart');
    await expect(page.locator('[data-guest-cart-line]')).toHaveCount(1);
    await expect(page.locator('[data-guest-cart-qty]')).toHaveValue('2');
    await page.locator('[data-guest-cart-remove]').click();
    await expect(page.locator('[data-guest-cart-line]')).toHaveCount(0);

    await page.goto(base + '/products/long-way-cap');
    await page.locator('[data-add-to-cart-qty]').fill('0'); await add.click();
    await expect(status).toHaveAttribute('role', 'alert');
    await expect(view).toBeHidden();
    await page.locator('[data-add-to-cart-qty]').fill('1'); await add.click();
    await expect(view).toBeVisible();
    // Exercise a failure after success: no stale saved-cart invitation may remain.
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'dinkus.guest-cart.v1') throw new Error('Self-check blocked cart write');
        return original.call(this, key, value);
      };
    });
    await add.click();
    await expect(status).toHaveAttribute('role', 'alert');
    await expect(status).toContainText('Leave or reload this page');
    await expect(view).toBeHidden();
    await fits();
    await page.screenshot({ path: new URL(`failed-save-${width}.png`, output).pathname, fullPage: true });
    expect(errors).toEqual([]); expect(checkout).toEqual([]);
    results.push({ width, savedAddition: true, keyboardCartHandoff: true, cartQuantity: 2, removed: true,
      invalidQuantityHasNoHandoff: true, correctedQuantityHasHandoff: true, failedSaveRetractsHandoff: true,
      noOverflow: true, browserErrors: errors.length, checkoutRequests: checkout.length });
    await context.close();
  }
} finally { await browser.close(); }
const evidence = { checkedAt: new Date().toISOString(), base, results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
