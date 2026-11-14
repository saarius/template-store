// Real hosted recovery, not an expiry simulator. Never prepares/starts checkout,
// submits contact/payment, changes the cart or writes the private input file.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { releasedCheckoutBrowserState } from './lib/backroadbum-released-checkout.mjs';
import { receiptOrigin, receiptRequestAllowed, receiptStatusPath, retainedCheckoutKey } from './lib/backroadbum-retained-receipt.mjs';
import { GUEST_CART_STORAGE_KEY } from '../src/features/guest-cart/intent.ts';

if (!process.argv.includes('--check')) {
  console.log('No action. --check --state-file=PATH verifies a released original checkout through its saved cart, without starting a successor. Optional --width=390|1440 --scheme=light|dark.');
  process.exit(0);
}
let browser;
let stage = 'input';
let diagnostic = {};
try {
  const path = process.argv.find(arg => arg.startsWith('--state-file='))?.slice(13);
  assert.ok(path, 'Private original state required');
  const width = Number(process.argv.find(arg => arg.startsWith('--width='))?.slice(8) ?? 390);
  const colorScheme = process.argv.find(arg => arg.startsWith('--scheme='))?.slice(9) ?? 'light';
  assert.ok([390, 1440].includes(width)); assert.ok(['light', 'dark'].includes(colorScheme));
  const input = await readFile(path);
  const safe = releasedCheckoutBrowserState(JSON.parse(input));
  const retention = JSON.parse(safe.origins[0].localStorage.find(x => x.name === retainedCheckoutKey).value);
  const intent = safe.origins[0].localStorage.find(x => x.name === GUEST_CART_STORAGE_KEY).value;
  const hash = value => createHash('sha256').update(value).digest('hex');
  const output = new URL(`../runs/backroadbum/released-checkout/${width}-${colorScheme}/`, import.meta.url);
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme, storageState: safe, serviceWorkers: 'block', userAgent: 'BackroadBum-SelfCheck/1.0' });
  const blocked = [], errors = [], answers = [];
  await context.route('**/*', route => {
    const r = route.request();
    if (receiptRequestAllowed(r.url(), r.method())) return route.continue();
    blocked.push(r.method()); return route.abort('blockedbyclient');
  });
  // Observe a clone of the real fetch response in the page before navigation.
  // Chromium can discard response bodies before an out-of-page json() reader;
  // this observer neither fulfills a request nor substitutes an outcome.
  await context.addInitScript(({ origin, path, attempt }) => {
    window.__releasedChecks = [];
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (new URL(response.url).origin === origin && new URL(response.url).pathname === path) {
        try {
          const text = await response.clone().text();
          if (text.length > 65536) throw new Error('Bound');
          const wire = JSON.parse(text), body = wire?.success === true ? wire.data : wire;
          const checkout = body?.checkout;
          window.__releasedChecks.push({ http: response.status, ok: body?.ok === true,
            state: checkout?.state === 'released-retry' ? 'released-retry' : 'other',
            originalAttemptAndReleaseFenceMatch: checkout?.attemptId === attempt && checkout?.retryAfter === attempt,
            paidOrder: checkout?.order !== null, paymentLink: checkout?.redirectUrl !== null });
        } catch { window.__releasedChecks.push({ unreadable: true }); }
      }
      return response;
    };
  }, { origin: receiptOrigin, path: receiptStatusPath, attempt: retention.attemptId });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.name));
  const harvest = async () => {
    const observed = await page.evaluate(() => window.__releasedChecks);
    assert.ok(observed.length > 0);
    for (const value of observed) assert.deepEqual(value, { http: 200, ok: true, state: 'released-retry', originalAttemptAndReleaseFenceMatch: true, paidOrder: false, paymentLink: false });
    answers.push(...observed);
  };
  stage = 'return-status';
  await page.goto(receiptOrigin + '/checkout/success');
  await expect(page.locator('[data-guest-checkout-return-status]')).toContainText('Commerce released the original attempt');
  await expect(page.locator('[data-guest-checkout-order]')).toBeHidden();
  await expect(page.locator('[data-guest-checkout-print]')).toBeHidden();
  await expect(page.locator('[data-guest-checkout-retry]')).toBeHidden();
  await page.evaluate(async () => { await document.fonts.ready; document.documentElement.style.scrollBehavior = 'auto'; });
  await page.screenshot({ path: new URL('released.png', output).pathname });
  // Use the real shopper navigation, not a direct request or invented release.
  await harvest();
  stage = 'cart-navigation';
  await page.locator('header [data-guest-cart-nav]').press('Enter');
  await expect(page).toHaveURL(receiptOrigin + '/cart');
  stage = 'cart-ready';
  const recover = page.locator('[data-guest-cart-recover]');
  await expect(recover).toBeVisible();
  await recover.press('Enter');
  const checkout = page.locator('[data-guest-cart-checkout]');
  await expect(checkout).toBeEnabled();
  await expect(page.locator('[data-guest-cart-status]')).toContainText('original attempt was released');
  const expectedLines = JSON.parse(intent).lines;
  await expect(page.locator('[data-guest-cart-line]')).toHaveCount(expectedLines.length);
  await page.evaluate(async () => { await document.fonts.ready; document.documentElement.style.scrollBehavior = 'auto'; });
  await page.screenshot({ path: new URL('cart.png', output).pathname });
  // Opening the contact review is safe. Never activate its submit/start action.
  await harvest();
  stage = 'contact-review';
  await checkout.press('Enter');
  await expect(page).toHaveURL(receiptOrigin + '/checkout');
  const reviewRecover = page.locator('[data-guest-cart-recover]');
  await expect(reviewRecover).toBeVisible();
  await reviewRecover.press('Enter');
  await expect(page.locator('[data-guest-cart-checkout]')).toBeVisible();
  await expect(page.locator('[data-guest-cart-checkout]')).toBeEnabled();
  const saved = await page.evaluate(({ key, cartKey }) => ({ checkout: JSON.parse(localStorage.getItem(key)), cart: localStorage.getItem(cartKey) }), { key: retainedCheckoutKey, cartKey: GUEST_CART_STORAGE_KEY });
  assert.equal(saved.checkout.capability, retention.capability);
  assert.equal(saved.checkout.attemptId, retention.attemptId);
  assert.deepEqual(JSON.parse(saved.cart), JSON.parse(intent));
  stage = 'retention-and-transport';
  await harvest();
  diagnostic = { answers: answers.length, blockedMethods: blocked, pageErrors: errors.length,
    noOverflow: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), inputFileUnchanged: hash(await readFile(path)) === hash(input) };
  assert.ok(answers.length >= 3);
  assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(hash(await readFile(path)), hash(input));
  const report = { checkedAt: new Date().toISOString(), width, colorScheme, realHostedStatus: true,
    answers, nativeCartLink: true, explicitCartStatusCheck: true, savedLines: expectedLines.length, cartCheckoutEnabled: true,
    checkoutReviewEnabled: true, explicitReviewStatusCheck: true, originalCapabilityAndAttemptRetained: true, cartIntentUnchanged: true,
    inputFileUnchanged: true, noSuccessorStart: true, noPrepareOrContactWrite: true, noOverflow: true,
    blockedRequests: blocked.length, pageErrors: errors.length };
  await writeFile(new URL('verification.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch {
  console.error(`Released-checkout verification failed at ${stage}; private state, provider references and response bodies withheld. ${JSON.stringify(diagnostic)}`);
  process.exitCode = 1;
} finally { await browser?.close(); }
