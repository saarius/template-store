// Exercise an existing receipt's optional catalog media, never a new checkout.
// The unavailable case changes only this browser's GET response, not store data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openRetainedReceipt, nativeReceiptStatusPath, receiptOrigin, retainedCheckoutKey } from './lib/backroadbum-retained-receipt.mjs';

if (!process.argv.includes('--check')) {
  console.log('No action. --check --state-file=PATH verifies a retained receipt whose images all use catalog fallback, with at least one current catalog image, then simulates an unavailable catalog lookup in this browser only. Never prepares, pays, buys a label or saves browser state.');
  process.exit(0);
}
const statePath = process.argv.find(arg => arg.startsWith('--state-file='))?.slice('--state-file='.length) ?? '/etc/backroadbum/public-shopper-browser.json';
const report = { checkedAt: new Date().toISOString(), surface: 'retained paid receipt; optional catalog media', checks: [] };
let phase = 'private-state';
try {
  const beforeFile = readFileSync(statePath);
  for (const [width, unavailable] of [[1440, false], [390, false], [390, true]]) {
    const shopper = await openRetainedReceipt({ width, statePath, native: true });
    let releaseMedia;
    const mediaGate = new Promise(resolve => { releaseMedia = resolve; });
    try {
      const { page, context } = shopper;
      const errors = [];
      let fallbackRequests = 0;
      page.on('pageerror', () => errors.push('pageerror'));
      // Other requests still pass through openRetainedReceipt's read-only guard.
      await context.route(`${receiptOrigin}/api/guest-cart/snapshot?*`, async route => {
        if (route.request().method() !== 'GET') return route.fallback();
        fallbackRequests++;
        await mediaGate;
        if (!unavailable) return route.fallback();
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'catalog_unavailable' }) });
      });
      const lookupStarted = page.waitForRequest(request => new URL(request.url()).pathname === '/api/guest-cart/snapshot' && request.method() === 'GET');
      phase = 'paid-receipt';
      await page.goto(receiptOrigin + '/checkout/success', { waitUntil: 'domcontentloaded' });
      await page.locator('[data-guest-checkout-print]').waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.querySelector('[data-guest-checkout-return-status]')?.textContent?.includes('Checking'));
      const savedBefore = await page.evaluate(() => JSON.stringify({ ...localStorage }));
      // Keep private rendered facts in memory only; media must not change them.
      const facts = () => page.evaluate(() => JSON.stringify({
        heading: document.querySelector('[data-guest-checkout-order-number]')?.textContent,
        items: [...document.querySelectorAll('[data-guest-checkout-item-details], [data-guest-checkout-item-amount]')].map(element => element.textContent),
        totals: document.querySelector('[data-guest-checkout-order-totals]')?.textContent,
      }));
      const factsBefore = await facts();
      await lookupStarted;
      // Printing and all paid facts are already available while the optional
      // catalog GET is deliberately held in this browser. No sleep-based race.
      const beforeMedia = await page.evaluate(() => ({
        lines: document.querySelectorAll('[data-guest-checkout-item]').length,
        images: document.querySelectorAll('[data-guest-checkout-item-thumbnail]').length,
        placeholders: document.querySelectorAll('[data-guest-checkout-item-thumb-placeholder]').length,
      }));
      assert.equal(beforeMedia.images, 0);
      assert.equal(beforeMedia.placeholders, beforeMedia.lines);
      const lookupResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/guest-cart/snapshot');
      releaseMedia();
      const response = await lookupResponse;
      assert.equal(response.status(), unavailable ? 503 : 200);
      phase = unavailable ? 'unavailable-placeholder' : 'catalog-image';
      if (!unavailable) {
        await page.waitForFunction(() => {
          const images = [...document.querySelectorAll('[data-guest-checkout-item-thumbnail]')];
          return images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0);
        }, null, { timeout: 20_000 });
      }
      const media = await page.evaluate(() => ({
        lines: document.querySelectorAll('[data-guest-checkout-item]').length,
        images: document.querySelectorAll('[data-guest-checkout-item-thumbnail]').length,
        loadedImages: [...document.querySelectorAll('[data-guest-checkout-item-thumbnail]')].filter(image => image.complete && image.naturalWidth > 0).length,
        placeholders: document.querySelectorAll('[data-guest-checkout-item-thumb-placeholder]').length,
      }));
      assert.ok(media.lines > 0);
      assert.equal(media.images + media.placeholders, media.lines);
      assert.ok(fallbackRequests > 0, 'This verification requires receipt lines using catalog fallback.');
      if (unavailable) {
        assert.equal(media.images, 0);
        assert.equal(media.placeholders, media.lines);
      } else assert.equal(media.loadedImages, media.images);
      assert.equal(await facts(), factsBefore);
      phase = 'signed-paid-facts';
      // Native authority is consulted with the same saved capability. Only
      // comparisons/presence flags leave the browser, never response bodies.
      const native = await page.evaluate(async ({ key, path }) => {
        const saved = JSON.parse(localStorage.getItem(key));
        const response = await fetch(path, { method: 'POST', cache: 'no-store', headers: {
          'content-type': 'application/json', 'x-commerce-guest-capability': saved.capability,
        }, body: JSON.stringify(saved.attemptId ? { attemptId: saved.attemptId } : {}), signal: AbortSignal.timeout(15000) });
        const body = await response.json();
        const value = body?.success === true ? body.data : body;
        const order = value?.checkout?.order;
        const details = [...document.querySelectorAll('[data-guest-checkout-item-details]')].map(element => element.textContent);
        const total = order?.total ? new Intl.NumberFormat(undefined, { style: 'currency', currency: order.total.currency }).format(Number(order.total.minor) / 100) : null;
        return { http: response.status, paid: value?.ok === true && value.checkout?.state === 'paid',
          canonicalNumberPresent: Number.isSafeInteger(order?.number), nativeImageLines: order?.lines?.filter(line => typeof line.imageUrl === 'string').length,
          itemsMatch: Boolean(order?.lines?.length && order.lines.length === details.length && order.lines.every((line, index) => details[index].includes(`${line.name ?? line.catalogItemId} × ${line.quantity}`))),
          totalMatches: Boolean(total && document.querySelector('[data-guest-checkout-order-totals]')?.textContent?.includes(total)) };
      }, { key: retainedCheckoutKey, path: nativeReceiptStatusPath });
      assert.equal(native.http, 200);
      assert.equal(native.paid, true);
      assert.equal(native.nativeImageLines, 0, 'This verification requires all receipt media to use catalog fallback.');
      assert.equal(native.itemsMatch, true);
      assert.equal(native.totalMatches, true);
      assert.equal(await page.locator('[data-guest-checkout-print]').isVisible(), true);
      assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage })), savedBefore);
      assert.equal(await page.evaluate(({ key, retained }) => localStorage.getItem(key) === retained, { key: retainedCheckoutKey, retained: shopper.retained }), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(shopper.blockedRequests(), 0);
      assert.deepEqual(errors, []);
      report.checks.push({ width, catalog: unavailable ? 'browser-only 503' : 'actual public catalog', fallbackRequests, beforeMedia, media, native,
        paidFactsUnchanged: true, printAvailable: true, browserStorageUnchanged: true, noOverflow: true, blockedRequests: 0, pageErrors: 0 });
    } finally { releaseMedia(); await shopper.browser.close(); }
  }
  assert.equal(beforeFile.equals(readFileSync(statePath)), true);
  report.privateStateFileUnchanged = true;
  console.log(JSON.stringify(report, null, 2));
} catch {
  console.error(`Receipt-media verification failed at ${phase}; private receipt content and browser state withheld.`);
  process.exitCode = 1;
}
