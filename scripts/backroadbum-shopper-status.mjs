// Read-only reconciliation of the existing paid guest-browser proof.
// Does not prepare a cart, create a Stripe session or submit a payment.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { openShopperPreview } from './lib/backroadbum-shopper-preview.mjs';
if (!process.argv.includes('--check')) {
  console.log('No action. --check reads a retained receipt in private preview; --public uses the real public store.');
  process.exit(0);
}
const capture = process.argv.includes('--capture');
const publicStore = process.argv.includes('--public');
const fulfillment = process.argv.find(value => value.startsWith('--fulfillment='))?.slice('--fulfillment='.length);
if (fulfillment && !['processing', 'completed'].includes(fulfillment)) throw Error('Unknown fulfillment expectation');
const statePath = process.argv.find(value => value.startsWith('--state-file='))?.slice('--state-file='.length);
const captureDir = 'runs/backroadbum/shopper-status';
if (capture) mkdirSync(captureDir, { recursive: true });
const report = { checkedAt: new Date().toISOString(), surface: publicStore ? 'public-store' : 'private-preview', viewportChecks: [] };
try {
  let stableOrder;
  for (const width of [1440, 390]) {
    const shopper = await openShopperPreview({ saved: true, width, statePath, publicStore });
    try {
      const { page } = shopper;
      await page.goto('https://backroadbum.com/checkout/success', { waitUntil: 'domcontentloaded' });
      await page.locator('[data-guest-checkout-order]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-guest-checkout-test]').isVisible(), true);
      const order = await page.locator('[data-guest-checkout-order-number]').innerText();
      stableOrder ??= order;
      assert.equal(order, stableOrder);
      assert.match(await page.locator('[data-guest-checkout-order-items]').innerText(), /Creekside Camp Mug × 1/);
      assert.match(await page.locator('[data-guest-checkout-order-totals]').innerText(), /\$22\.00/);
      assert.doesNotMatch(await page.locator('main').innerText(), /email is coming|shipping email/);
      if (fulfillment) {
        assert.equal(await page.locator('[data-guest-checkout-fulfillment]').isVisible(), true);
        assert.equal(await page.locator('[data-guest-checkout-fulfillment-status]').innerText(),
          fulfillment === 'completed' ? 'Demo fulfillment complete' : 'Processing');
        if (fulfillment === 'completed') {
          assert.match(await page.locator('[data-guest-checkout-fulfillment-note]').innerText(), /No parcel was sent/);
          assert.match(await page.locator('[data-guest-checkout-fulfillment-details]').innerText(), /BRB-TEST-1003-NOT-SHIPPED/);
        } else assert.equal(await page.locator('[data-guest-checkout-fulfillment-details]').innerText(), '');
        assert.equal(await page.locator('[data-guest-checkout-fulfillment] a').count(), 0);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('[data-guest-checkout-order]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-guest-checkout-order-number]').innerText(), stableOrder);
      if (fulfillment) assert.equal(await page.locator('[data-guest-checkout-fulfillment-status]').innerText(),
        fulfillment === 'completed' ? 'Demo fulfillment complete' : 'Processing');
      if (capture) {
        await page.evaluate(() => document.fonts.ready);
        await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
        await page.screenshot({ path: `${captureDir}/receipt-${width}.png`, fullPage: true });
      }
      await page.goto('https://backroadbum.com/cart', { waitUntil: 'domcontentloaded' });
      await page.locator('[data-guest-cart-empty]').waitFor({ state: 'visible' });
      report.viewportChecks.push({ width, paidReceipt: true, testLabel: true, reloadStable: true, purchasedCartSettled: true, noOverflow: true,
        ...(fulfillment ? { fulfillment, syntheticTrackingOnly: fulfillment === 'completed' } : {}) });
    } finally { await shopper.browser.close(); }
  }
  const stranger = await openShopperPreview({ publicStore });
  try {
    await stranger.page.goto('https://backroadbum.com/checkout/success?session_id=cs_test_not_authority', { waitUntil: 'domcontentloaded' });
    await stranger.page.waitForFunction(() => !document.querySelector('[data-guest-checkout-return-status]')?.textContent?.includes('Checking'));
    assert.equal(await stranger.page.locator('[data-guest-checkout-order]').isVisible(), false);
    report.urlWithoutCapabilityDenied = true;
  } finally { await stranger.browser.close(); }
  console.log(JSON.stringify(report, null, 2));
} catch {
  console.error('Shopper receipt verification failed; no response body, URL or browser state emitted.');
  process.exitCode = 1;
}
