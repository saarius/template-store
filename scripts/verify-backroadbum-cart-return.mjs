// Real storefront with controlled Commerce snapshot changes; never starts or pays a checkout.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.BACKROADBUM_VERIFY_URL ?? 'https://backroadbum.com';
const expectStale = process.argv.includes('--expect-stale');
const output = new URL('../runs/backroadbum/cart-return/', import.meta.url);
await mkdir(output, { recursive: true });
const money = minor => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(minor) / 100);
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, userAgent: 'BackroadBum-SelfCheck/1.0' });
    const page = await context.newPage();
    const errors = [], checkout = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', r => { if (/\/api\/checkout\//.test(r.url())) checkout.push(new URL(r.url()).pathname); });
    await page.goto(base + '/products/long-way-cap');
    const id = await page.locator('[data-commerce-item]').getAttribute('data-commerce-item');
    expect(id).toBeTruthy();
    const response = await context.request.get(base + '/api/guest-cart/snapshot?ids=' + encodeURIComponent(id));
    expect(response.ok()).toBe(true);
    const initial = (await response.json()).products[0];
    expect(initial.found && initial.availability.sellable && initial.price.unitMinor !== null).toBe(true);
    const changedMinor = String(Number(initial.price.unitMinor) + 100);
    const changed = { ...initial, price: { ...initial.price, regularText: money(changedMinor), saleText: null, unitMinor: changedMinor } };
    let phase = 'initial', snapshots = 0;
    await page.route('**/api/guest-cart/snapshot?**', async route => {
      snapshots++;
      if (phase === 'failed') return route.fulfill({ status: 503, json: { error: 'Synthetic unavailable catalog' } });
      const product = phase === 'initial' ? initial : phase === 'out' ? {
        ...changed, availability: { ...changed.availability, sellable: false, status: 'out-of-stock' },
      } : changed;
      await route.fulfill({ json: { products: [product] } });
    });
    await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
    await page.locator('[data-add-to-cart-view]').click();
    const stored = () => page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'));
    const initialIntent = await stored();
    const qty = page.locator('[data-guest-cart-qty]');
    const subtotal = page.locator('[data-guest-cart-subtotal-amount]');
    const focus = () => page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const restore = () => page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(subtotal).toHaveText(money(initial.price.unitMinor));
    await expect(page.locator('[data-guest-cart-checkout]')).toBeEnabled();
    const before = snapshots;
    phase = 'changed';
    await qty.focus(); await focus();
    if (expectStale) {
      await page.waitForTimeout(600);
      expect(snapshots).toBe(before);
      await expect(subtotal).toHaveText(money(initial.price.unitMinor));
      results.push({ width, reproducedStalePrice: true, callback: 'synthesized focus', unchangedIntent: await stored() === initialIntent });
      await context.close(); continue;
    }
    await expect(subtotal).toHaveText(money(changedMinor));
    await expect(qty).toBeFocused();
    expect(await stored()).toBe(initialIntent);
    phase = 'out'; await restore();
    await expect(page.locator('[data-guest-cart-line-reason]')).toContainText('Out of stock');
    await expect(page.locator('[data-guest-cart-checkout]')).toBeDisabled();
    expect(await stored()).toBe(initialIntent);
    await fits();
    await page.screenshot({ path: new URL(`stock-${width}.png`, output).pathname });

    // Refreshes cannot silently discard invalid drafts or buy their saved quantity.
    await qty.fill('0'); phase = 'initial'; await focus();
    await expect(page.locator('[data-guest-cart-line-reason]')).toHaveCount(0);
    await expect(qty).toHaveValue('0');
    await expect(page.locator('[data-guest-cart-subtotal]')).toBeHidden();
    await expect(page.locator('[data-guest-cart-checkout]')).toBeDisabled();
    expect(await stored()).toBe(initialIntent);
    await qty.fill('2');
    await expect(subtotal).toHaveText(money(Number(initial.price.unitMinor) * 2));
    const twoIntent = await stored();
    phase = 'failed'; await restore();
    await expect(page.locator('[data-guest-cart-status]')).toContainText("We couldn't load the latest prices.");
    await expect(page.locator('[data-guest-cart-checkout]')).toBeDisabled();
    await expect(page.locator('[data-guest-cart-subtotal]')).toBeHidden();
    expect(await stored()).toBe(twoIntent);
    phase = 'initial'; await page.locator('[data-guest-cart-retry]').click();
    await expect(subtotal).toHaveText(money(Number(initial.price.unitMinor) * 2));
    await expect(page.locator('[data-guest-cart-checkout]')).toBeEnabled();

    await page.goto(base + '/checkout');
    await expect(subtotal).toHaveText(money(Number(initial.price.unitMinor) * 2));
    await expect(page.locator('[data-guest-cart-email]')).toBeEnabled();
    await page.locator('[data-guest-cart-email]').fill('return-check@example.com');
    await qty.fill('3'); const threeIntent = await stored();
    phase = 'changed'; await focus();
    await expect(subtotal).toHaveText(money(Number(changedMinor) * 3));
    await expect(page.locator('[data-guest-cart-email]')).toHaveValue('return-check@example.com');
    await expect(qty).toHaveValue('3');
    expect(await stored()).toBe(threeIntent);
    await fits();
    await page.screenshot({ path: new URL(`checkout-${width}.png`, output).pathname, fullPage: true });
    // A deliberately unsaved cart must not be replaced or refreshed on return.
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'dinkus.guest-cart.v1') throw new Error('Synthetic blocked cart write');
        return original.call(this, key, value);
      };
    });
    await qty.fill('4');
    await expect(page.locator('[data-guest-cart-status]')).toContainText('could not be saved');
    const beforeFailedWriteReturn = snapshots;
    phase = 'initial'; await focus(); await restore(); await page.waitForTimeout(150);
    expect(snapshots).toBe(beforeFailedWriteReturn);
    await expect(qty).toHaveValue('4');
    await expect(subtotal).toHaveText(money(Number(changedMinor) * 4));
    expect(await stored()).toBe(threeIntent);
    expect(errors).toEqual([]);
    expect(checkout.some(path => /\/start$/.test(path))).toBe(false);
    results.push({ width, cartAndCheckoutRefreshPrice: true, restoredPageRefreshesStock: true,
      invalidDraftPreserved: true, failedRefreshBlocksPurchase: true, retryRecovers: true,
      checkoutContactPreserved: true, failedWriteMemoryPreserved: true, focusPreserved: true, intentUnchangedByRefresh: true,
      noOverflow: true, browserErrors: 0, checkoutPaths: checkout });
    await context.close();
  }
} finally { await browser.close(); }
const report = { checkedAt: new Date().toISOString(), expectStale,
  scope: 'Signed Commerce baseline, synthetic price/stock/failure snapshots and focus/BFCache events. No merchant or payment writes; normal capability preparation may occur. Chromium viewports, not physical-device proof.', results };
await writeFile(new URL(expectStale ? 'baseline.json' : 'verification.json', output), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
