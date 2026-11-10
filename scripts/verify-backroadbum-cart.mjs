// Exercises browser-local cart edits and read-only catalog failures. Commerce may
// prepare a checkout capability; this script never starts checkout or pays.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/cart/', import.meta.url);
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
    const capture = async name => { await page.evaluate(() => document.fonts.ready); await fits(); await page.screenshot({ path: new URL(`${name}-${width}.png`, output).pathname, fullPage: true }); };
    await page.goto(base + '/cart');
    await expect(page.locator('[data-guest-cart-empty]')).toBeVisible();
    await expect(page.locator('[data-guest-cart-summary]')).toBeHidden();
    await page.getByRole('link', { name: 'Browse the gear', exact: true }).click();
    await expect(page).toHaveURL(base + '/shop');
    const products = [];
    for (const slug of ['long-way-cap', 'creekside-camp-mug']) {
      await page.goto(base + '/products/' + slug);
      const name = await page.locator('h1').innerText();
      const amounts = (await page.locator('[data-product-price]').innerText()).match(/\$[\d,.]+/g);
      const price = Number(amounts.at(-1).replace(/[$,]/g, ''));
      products.push({ name, price });
      await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
      await expect(page.locator('[data-add-to-cart-status]')).toHaveText('Added to cart.');
    }
    await page.goto(base + '/cart');
    const lines = page.locator('[data-guest-cart-line]');
    const qty = lines.first().locator('[data-guest-cart-qty]');
    const button = page.locator('[data-guest-cart-checkout]');
    const subtotal = page.locator('[data-guest-cart-subtotal]');
    const money = value => '$' + value.toFixed(2);
    await expect(lines).toHaveCount(2);
    await expect(button).toBeEnabled();
    await expect(page.locator('[data-guest-cart-resume]')).toBeHidden();
    await expect(page.locator('[data-guest-cart-recover]')).toBeHidden();
    await expect(subtotal).toHaveText('Subtotal ' + money(products[0].price + products[1].price));
    await capture('filled');
    if (width === 1440) {
      for (const reflow of [768, 320]) {
        await page.setViewportSize({ width: reflow, height: 1000 });
        await fits();
        await page.screenshot({ path: new URL(`filled-${reflow}.png`, output).pathname, fullPage: true });
      }
      await page.setViewportSize({ width, height: 1000 });
    }
    const before = await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'));
    for (const value of ['0', '-1', '1.5', '100', '08', 'abc', '']) {
      await qty.fill(value);
      await expect(qty).toBeFocused();
      await expect(qty).toHaveAttribute('aria-invalid', 'true');
      await expect(qty).toHaveAccessibleName('Quantity for ' + products[0].name);
      await expect(lines.first().locator('[data-guest-cart-qty-error]')).toContainText('1 to 99');
      await expect(lines.first().locator('[data-guest-cart-line-total]')).toBeHidden();
      await expect(subtotal).toBeHidden(); await expect(button).toBeDisabled();
      // Even a synthetic click cannot bypass the client guard.
      await button.dispatchEvent('click');
      await expect(page).toHaveURL(base + '/cart');
      expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'))).toBe(before);
    }
    await qty.fill('0'); await capture('invalid');
    // Valid edits update immediately, keep focus while typing, and use Commerce prices.
    await qty.fill(''); await qty.pressSequentially('12');
    await expect(qty).toBeFocused(); await expect(qty).toHaveValue('12');
    await expect(qty).toHaveAttribute('aria-invalid', 'false');
    await expect(subtotal).toHaveText('Subtotal ' + money(products[0].price * 12 + products[1].price));
    await expect(button).toBeEnabled();
    await qty.fill('2'); await qty.press('Tab');
    await expect(lines.first().getByRole('button', { name: 'Remove ' + products[0].name, exact: true })).toBeFocused();
    await page.reload(); await expect(qty).toHaveValue('2');
    await expect(button).toBeEnabled();
    // A catalog refresh must not erase an invalid edit or make its old total buyable.
    let failSnapshot = false;
    await page.route('**/api/guest-cart/snapshot?**', route => failSnapshot ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }) : route.continue());
    failSnapshot = true; await page.reload();
    await expect(page.locator('[data-guest-cart-status]')).toContainText("We couldn't load the latest prices.");
    await expect(page.locator('[data-guest-cart-empty]')).toBeHidden();
    await qty.fill('0'); await qty.press('Tab');
    failSnapshot = false; await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.locator('[data-guest-cart-status]')).toBeHidden();
    await expect(qty).toHaveValue('0'); await expect(qty).toHaveAttribute('aria-invalid', 'true');
    await expect(button).toBeDisabled(); await expect(subtotal).toBeHidden();
    // Two invalid rows: correcting/removing only one is not enough.
    await lines.last().locator('[data-guest-cart-qty]').fill('100');
    await qty.fill('2'); await expect(button).toBeDisabled();
    await lines.last().locator('[data-guest-cart-remove]').click();
    await expect(lines).toHaveCount(1); await expect(button).toBeEnabled();
    await expect(subtotal).toHaveText('Subtotal ' + money(products[0].price * 2));
    // The shared checkout summary obeys the same gate, without starting payment.
    await page.goto(base + '/checkout');
    const checkoutQty = page.locator('[data-guest-cart-qty]');
    await expect(page.locator('[data-guest-cart-checkout]')).toBeEnabled();
    await checkoutQty.fill('0');
    await expect(page.locator('[data-guest-cart-checkout]')).toBeDisabled();
    await expect(page.locator('[data-checkout-breakdown]')).toBeHidden();
    await expect(page.locator('[data-guest-cart-qty-error]')).toBeVisible();
    await capture('checkout-invalid');
    await checkoutQty.fill('2');
    await expect(page.locator('[data-checkout-breakdown]')).toBeVisible();
    await page.goto(base + '/cart'); await expect(button).toBeEnabled();
    await qty.fill('0'); await lines.first().locator('[data-guest-cart-remove]').click();
    await expect(page.locator('[data-guest-cart-empty]')).toBeVisible();
    await expect(page.locator('[data-guest-cart-empty]')).toBeFocused();
    await expect(page.locator('[data-guest-cart-summary]')).toBeHidden();
    await capture('empty');
    await page.keyboard.press('Tab'); // Establish keyboard modality after pointer removal.
    await page.getByRole('link', { name: 'Continue shopping', exact: true }).focus();
    expect(await page.getByRole('link', { name: 'Continue shopping', exact: true }).evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    expect(errors).toEqual([]);
    expect(checkout.filter(path => /\/start$/.test(path))).toEqual([]);
    results.push({ width, currentPricesMatched: true, invalidInputs: 7, invalidDraftSurvivesRefresh: true, multiRowErrors: true, typingAndKeyboardFocus: true, checkoutGateAndTotals: true, emptyBrowseAction: true, noOverflow: true, browserErrors: errors.length, checkoutPrepareRequests: checkout.filter(path => /\/prepare$/.test(path)).length, checkoutStartRequests: 0 });
    await context.close();
  }
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 }, userAgent: 'BackroadBum-SelfCheck/1.0' });
  const page = await context.newPage(); await page.goto(base + '/cart');
  await expect(page.getByText('Your cart needs JavaScript', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'browse the gear', exact: true }).click();
  await expect(page).toHaveURL(base + '/shop'); await context.close();
} finally { await browser.close(); }
const proof = { checkedAt: new Date().toISOString(), results, additionalReflowWidths: [768, 320], noJavaScriptBrowsePath: true, noPaymentOrOrderCreated: true };
await writeFile(new URL('verification.json', output), JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof, null, 2));
