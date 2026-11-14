// Merchant product → cart proof. Browser-local cart edits only; never starts checkout.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.BACKROADBUM_VERIFY_URL ?? 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/add-handoff/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const [width, colorScheme] of [[1440, 'light'], [1440, 'dark'], [768, 'light'], [390, 'light'], [390, 'dark'], [320, 'light']]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme, reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    const nonGetRequests = [], blockedPreparationRequests = [];
    const isPreparation = path => /^\/_emdash\/api\/plugins\/[^/]+\/checkout\/guest\/prepare$/.test(path);
    await context.route('**/*', route => {
      if (route.request().method() === 'GET') return route.continue();
      const path = new URL(route.request().url()).pathname;
      // An admitted legacy cart auto-prepares on load. Refuse it before it
      // reaches Commerce; this focused proof must create no capability.
      (isPreparation(path) ? blockedPreparationRequests : nonGetRequests).push(path);
      return route.abort();
    });
    const page = await context.newPage();
    const errors = [], checkout = [];
    const saved = () => page.evaluate(() => ({ cart: localStorage.getItem('dinkus.guest-cart.v1'), checkout: localStorage.getItem('dinkus.guest-checkout.v1') }));
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\/api\/checkout\/|\/checkout\/guest\//.test(request.url())) checkout.push(new URL(request.url()).pathname); });
    const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await page.goto(base + '/products/long-way-cap')).status()).toBe(200);
    const add = page.getByRole('button', { name: 'Add to cart', exact: true });
    const view = page.locator('[data-add-to-cart-view]');
    const status = page.locator('[data-add-to-cart-status]');
    await expect(view).toBeHidden();
    const quantity = page.locator('[data-add-to-cart-qty]');
    const decrease = page.getByRole('button', { name: 'Decrease quantity', exact: true });
    const increase = page.getByRole('button', { name: 'Increase quantity', exact: true });
    const stepper = page.locator('.guest-cart-add__stepper');
    for (const control of [decrease, quantity, increase]) {
      const bounds = await control.boundingBox();
      expect(bounds.width).toBeGreaterThanOrEqual(48);
      expect(bounds.height).toBeGreaterThanOrEqual(48);
    }
    await decrease.focus(); await page.keyboard.press('Enter');
    await expect(quantity).toHaveValue('1'); // Existing lower clamp, no cart mutation.
    for (const [name, control] of [['quantity', quantity], ['increase', increase], ['add', add]]) {
      await page.keyboard.press('Tab'); await expect(control).toBeFocused();
      if (name === 'add') continue;
      expect(await control.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
      expect(await stepper.evaluate(el => getComputedStyle(el).overflow)).toBe('visible');
      if (process.argv.includes('--capture')) {
        await page.locator('.guest-cart-add').screenshot({ path: new URL(`${name}-focus-${width}-${colorScheme}.png`, output).pathname });
      }
    }
    await quantity.fill('99'); await increase.click(); await expect(quantity).toHaveValue('99');
    await quantity.fill('1');
    await increase.click();
    await expect(page.locator('[data-add-to-cart-qty]')).toHaveValue('2');
    // Synthetic subscriber tests the former disabled-state reentry protection
    // without substituting catalog facts or cart persistence.
    await page.evaluate(() => document.addEventListener('guest-cart-updated', () => {
      document.querySelector('[data-add-to-cart]').click();
    }, { once: true }));
    await add.focus(); await page.keyboard.press('Enter');
    await expect(add).toBeFocused();
    await expect(status).toHaveText('Added to cart.');
    const selectedId = await add.getAttribute('data-add-to-cart');
    const expectSavedQuantity = async value => {
      const state = await saved();
      expect(JSON.parse(state.cart).lines).toEqual([{ id: selectedId, quantity: value }]);
      expect(state.checkout).toBeNull();
    };
    await expectSavedQuantity(2);
    // A second keyboard activation works without first restoring lost focus.
    await page.keyboard.press('Space'); await expect(add).toBeFocused(); await expectSavedQuantity(4);
    await page.keyboard.press('Enter'); await expect(add).toBeFocused(); await expectSavedQuantity(6);
    const beforeLimit = await saved();
    await quantity.fill('94'); await add.focus(); await page.keyboard.press('Enter');
    await expect(add).toBeFocused();
    await expect(status).toHaveAttribute('role', 'alert');
    await expect(view).toBeHidden();
    expect(await saved()).toEqual(beforeLimit);
    await quantity.fill('1'); await add.focus(); await page.keyboard.press('Enter');
    await expect(add).toBeFocused(); await expectSavedQuantity(7);
    expect(await add.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    if (process.argv.includes('--capture')) {
      await page.locator('.guest-cart-add').screenshot({ path: new URL(`add-focus-${width}-${colorScheme}.png`, output).pathname });
    }
    await expect(status).toHaveAttribute('role', 'status');
    await expect(view).toBeVisible();
    await expect(view).toHaveAttribute('href', '/cart');
    await expect(view).toHaveAccessibleName('View cart');
    await page.keyboard.press('Tab');
    await expect(view).toBeFocused();
    expect(await view.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    expect(await view.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48);
    await page.evaluate(() => document.fonts.ready); await fits();
    await page.screenshot({ path: new URL(`after-${width}-${colorScheme}.png`, output).pathname, fullPage: true });
    await view.press('Enter');
    await expect(page).toHaveURL(base + '/cart');
    await expect(page.locator('[data-guest-cart-line]')).toHaveCount(1);
    await expect(page.locator('[data-guest-cart-qty]')).toHaveValue('7');
    await page.locator('[data-guest-cart-remove]').click();
    await expect(page.locator('[data-guest-cart-line]')).toHaveCount(0);

    await page.goto(base + '/products/long-way-cap');
    await page.locator('[data-add-to-cart-qty]').fill('0'); await add.click();
    await expect(quantity).toBeFocused();
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
    const beforeFailure = await saved();
    await add.focus(); await page.keyboard.press('Enter');
    await expect(add).toBeFocused();
    expect(await saved()).toEqual(beforeFailure);
    await expect(status).toHaveAttribute('role', 'alert');
    await expect(status).toContainText('Leave or reload this page');
    await expect(view).toBeHidden();
    await fits();
    await page.screenshot({ path: new URL(`failed-save-${width}-${colorScheme}.png`, output).pathname, fullPage: true });
    expect(errors).toEqual([]); expect(nonGetRequests).toEqual([]);
    expect(checkout).toEqual(blockedPreparationRequests);
    expect(checkout.every(isPreparation)).toBe(true);
    expect((await saved()).checkout).toBeNull();
    results.push({ width, colorScheme, savedAddition: true, keyboardCartHandoff: true, cartQuantity: 7, removed: true,
      keyboardEnterAndSpaceRetainFocus: true, syntheticSubscriberReentryRefused: true, combinedQuantityRefusalRetainsFocusAndSavedCart: true,
      storageRefusalRetainsFocusAndSavedCart: true, unexpectedNonGetRequests: nonGetRequests.length,
      blockedCartPreparationRequests: blockedPreparationRequests.length, deliveredNonGetRequests: 0, retainedCheckout: null,
      invalidQuantityHasNoHandoff: true, correctedQuantityHasHandoff: true, failedSaveRetractsHandoff: true,
      quantityTargetsAtLeast48px: true, keyboardQuantityOrder: true, unclippedQuantityFocus: true, boundsUnchanged: true,
      noOverflow: true, browserErrors: errors.length, checkoutRequests: checkout.length });
    await context.close();
  }
} finally { await browser.close(); }
const evidence = { checkedAt: new Date().toISOString(), base, results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
