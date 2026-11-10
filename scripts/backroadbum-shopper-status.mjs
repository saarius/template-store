// Read-only reconciliation of the existing paid guest-browser proof.
// Does not prepare a cart, create a Stripe session or submit a payment.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { openShopperPreview } from './lib/backroadbum-shopper-preview.mjs';
if (!process.argv.includes('--check')) {
  console.log('No action. Start the private checkout preview, then --check verifies the retained shopper receipt.');
  process.exit(0);
}
const capture = process.argv.includes('--capture');
const captureDir = 'runs/backroadbum/shopper-status';
if (capture) mkdirSync(captureDir, { recursive: true });
const report = { checkedAt: new Date().toISOString(), publicRollout: 'closed', viewportChecks: [] };
try {
  let stableOrder;
  for (const width of [1440, 390]) {
    const shopper = await openShopperPreview({ saved: true, width });
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
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('[data-guest-checkout-order]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-guest-checkout-order-number]').innerText(), stableOrder);
      if (capture) await page.screenshot({ path: `${captureDir}/receipt-${width}.png`, fullPage: true });
      await page.goto('https://backroadbum.com/cart', { waitUntil: 'domcontentloaded' });
      await page.locator('[data-guest-cart-empty]').waitFor({ state: 'visible' });
      report.viewportChecks.push({ width, paidReceipt: true, testLabel: true, reloadStable: true, purchasedCartSettled: true, noOverflow: true });
    } finally { await shopper.browser.close(); }
  }
  const stranger = await openShopperPreview();
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
