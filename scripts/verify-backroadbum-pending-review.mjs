// Read-only recovery review. Default uses synthetic status answers on the real
// storefront; --state-file=PATH checks one retained capability without rewriting it.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { openRetainedReceipt } from './lib/backroadbum-retained-receipt.mjs';
const base = 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/pending-review/', import.meta.url);
await mkdir(output, { recursive: true });
const stateFile = process.argv.find(arg => arg.startsWith('--state-file='))?.slice('--state-file='.length);
const retention = { capabilityId: 'cap-review', capability: 'cap-review.secret', attemptId: 'attempt-review' };
const pending = { ok: true, capabilityId: retention.capabilityId, checkout: {
  schema: 'dinkuskit.commerce.guest-checkout-projection/v1', state: 'pending', attemptId: retention.attemptId,
  redirectUrl: null, order: null, retryAfter: null, pricing: { finalTotal: { currency: 'USD', minor: '7900' } },
} };
const results = [];
if (stateFile) {
  const shopper = await openRetainedReceipt({ statePath: stateFile, width: 390 });
  try {
    const before = shopper.retained;
    await shopper.page.goto(base + '/checkout/success');
    await expect(shopper.page.locator('[data-guest-checkout-pending-review]')).toBeVisible();
    await expect(shopper.page.locator('[data-guest-checkout-pending-amount]')).toContainText('$');
    await expect(shopper.page.locator('[data-guest-checkout-order]')).toBeHidden();
    await expect(shopper.page.locator('[data-guest-checkout-print]')).toBeHidden();
    await expect(shopper.page.locator('[data-guest-checkout-retry]')).toBeHidden();
    expect(await shopper.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await shopper.page.evaluate(() => localStorage.getItem('dinkus.guest-checkout.v1'))).toBe(before);
    expect(shopper.blockedRequests()).toBe(0);
    results.push({ width: 390, retained: true, originalAmount: await shopper.page.locator('[data-guest-checkout-pending-amount]').innerText(),
      noReceiptOrPrintOrPayLink: true, unchangedBrowserRetention: true, noOverflow: true, noStartOrPrivateInputWrite: true });
    await shopper.page.screenshot({ path: new URL('retained-390.png', output).pathname, fullPage: true });
  } finally { await shopper.browser.close(); }
} else {
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, userAgent: 'BackroadBum-SelfCheck/1.0' });
      await context.addInitScript(saved => localStorage.setItem('dinkus.guest-checkout.v1', JSON.stringify(saved)), retention);
      let answer = pending, writes = 0, blocked = 0;
      const errors = [];
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== base) { blocked++; return route.abort(); }
        if (request.method() === 'POST' && url.pathname === '/api/checkout/status') { writes++; return route.fulfill({ json: answer }); }
        if (request.method() === 'GET' || request.method() === 'HEAD') return route.continue();
        blocked++; return route.abort();
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.name));
      for (const [name, patch, visible] of [
        ['pending', {}, true],
        ['pending-open', { redirectUrl: 'https://checkout.stripe.com/c/pay/cs_test_review_fixture' }, true],
        ['recoverable', { state: 'recoverable-failure' }, true],
        ['older-payload', { pricing: undefined }, false],
        ['malformed', { pricing: { finalTotal: { currency: 'USD', minor: '<b>7900</b>' } } }, false],
        ['prepared', { attemptId: null }, false],
        ['released', { state: 'released-retry', retryAfter: retention.attemptId }, false],
        ['paid', { state: 'paid', order: { orderId: 'order-review', receiptId: 'receipt-review', lines: [{ catalogItemId: 'bandana', name: 'Saved bandana', quantity: 1, unitPrice: { currency: 'USD', minor: '7400' }, imageUrl: '/backroad/bandana.svg' }], total: { currency: 'USD', minor: '7900' } } }, false],
      ]) {
        answer = { ...pending, checkout: { ...pending.checkout, ...patch } };
        await page.goto(base + '/checkout/success');
        await expect(page.locator('[data-guest-checkout-return-status]')).not.toHaveText('Checking the saved checkout status.');
        const review = page.locator('[data-guest-checkout-pending-review]');
        if (visible) {
          await expect(review).toBeVisible();
          await expect(page.locator('[data-guest-checkout-pending-amount]')).toHaveText('$79.00');
          await expect(review).toContainText('not a paid receipt');
          await expect(page.locator('h1')).toHaveText('Checkout status');
          const cart = review.getByRole('link', { name: 'View current cart', exact: true });
          await cart.focus(); await expect(cart).toBeFocused();
          expect(await cart.evaluate(e => e.getBoundingClientRect().height >= 44)).toBe(true);
        } else await expect(review).toBeHidden();
        if (name !== 'paid') {
          await expect(page.locator('[data-guest-checkout-order]')).toBeHidden();
          await expect(page.locator('[data-guest-checkout-print]')).toBeHidden();
        } else {
          await expect(page.locator('[data-guest-checkout-order]')).toBeVisible();
          await expect(page.locator('[data-guest-checkout-print]')).toBeVisible();
          await expect(page.locator('h1')).toHaveText('Order confirmation');
        }
        if (name === 'pending-open') await expect(page.locator('[data-guest-checkout-retry]')).toBeVisible();
        else await expect(page.locator('[data-guest-checkout-retry]')).toBeHidden();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (name === 'pending') {
          await page.screenshot({ path: new URL(`pending-${width}.png`, output).pathname, fullPage: true });
          await review.getByRole('link', { name: 'View current cart', exact: true }).press('Enter');
          await expect(page).toHaveURL(base + '/cart');
        }
      }
      expect(errors).toEqual([]); expect(blocked).toBe(0);
      results.push({ width, syntheticStates: 8, originalAmount: '$79.00', keyboardCartLink: true, target44px: true,
        noOverflow: true, browserErrors: 0, statusAnswers: writes, noStartOrPaymentOrMerchantWrite: true });
      await context.close();
    }
  } finally { await browser.close(); }
}
const report = { checkedAt: new Date().toISOString(), scope: stateFile ? 'One real retained pending checkout, read-only input.' : 'Real storefront, synthetic Commerce status answers; no provider payment or expiry claim.', results };
await writeFile(new URL(stateFile ? 'retained.json' : 'verification.json', output), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
