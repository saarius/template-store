// Read an existing signed-Commerce receipt and exercise local printing while
// new checkout may be closed. Never prepare/start, mutate fulfillment or save state.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openRetainedReceipt, nativeReceiptStatusPath, receiptOrigin, receiptStatusPath, retainedCheckoutKey } from './lib/backroadbum-retained-receipt.mjs';

if (!process.argv.includes('--check')) {
  console.log('No action. --check reads a retained public receipt independently of new-checkout readiness; requires pdftotext. --capture keeps private local artifacts.');
  process.exit(0);
}
const statePath = process.argv.find(value => value.startsWith('--state-file='))?.slice('--state-file='.length) ?? '/etc/backroadbum/public-shopper-browser.json';
const capture = process.argv.includes('--capture');
const directory = 'runs/backroadbum/receipt-print-signed';
if (capture) mkdirSync(directory, { recursive: true });
const stateDigest = () => createHash('sha256').update(readFileSync(statePath)).digest('hex');
const compact = value => value.replace(/\s/gu, '');
const report = { checkedAt: new Date().toISOString(), source: 'public Commerce-authorized retained receipt', checks: [] };
let phase = 'state-file';
const setPhase = value => { phase = value; if (process.env.BACKROADBUM_VERIFY_PROGRESS === '1') console.error(value); };
try {
  const beforeFile = stateDigest();
  for (const width of [1440, 390]) {
    const shopper = await openRetainedReceipt({ width, statePath, native: true });
    try {
      const { page } = shopper;
      let checkoutReads = 0;
      const errors = [];
      page.on('pageerror', () => errors.push('pageerror'));
      page.on('response', response => {
        if ([receiptStatusPath, nativeReceiptStatusPath].includes(new URL(response.url()).pathname)) checkoutReads++;
      });
      setPhase('paid-receipt');
      await page.goto(receiptOrigin + '/checkout/success', { waitUntil: 'networkidle' });
      const button = page.getByRole('button', { name: 'Print or save receipt', exact: true });
      await button.waitFor({ state: 'visible' });
      // Expectations come from Commerce's response, never a browser URL, an
      // assumed legacy number/TEST field, a local order lookup or rendered text.
      const wire = await page.evaluate(async ({ key, path }) => {
        const saved = JSON.parse(localStorage.getItem(key));
        const response = await fetch(path, { method: 'POST', cache: 'no-store', headers: {
          'content-type': 'application/json', 'x-commerce-guest-capability': saved.capability,
        }, body: JSON.stringify(saved.attemptId ? { attemptId: saved.attemptId } : {}), signal: AbortSignal.timeout(15000) });
        const body = await response.json();
        const value = body?.success === true ? body.data : body;
        // No capability, provider identifiers or response diagnostics leave the browser.
        return { ok: value.ok, checkout: { state: value.checkout?.state, order: value.checkout?.order } };
      }, { key: retainedCheckoutKey, path: nativeReceiptStatusPath });
      assert.equal(wire?.ok, true);
      assert.equal(wire.checkout?.state, 'paid');
      const order = wire.checkout.order;
      assert.ok(order?.orderId && order.lines?.length > 0 && order.total);
      const expectedHeading = Number.isSafeInteger(order.number) && order.number > 0
        ? `Order #${order.number}` : `Order ${order.orderId.replace(/^order:/u, '')}`;
      const total = new Intl.NumberFormat('en-US', { style: 'currency', currency: order.total.currency }).format(Number(order.total.minor) / 100);
      assert.equal(await page.locator('[data-guest-checkout-order-number]').innerText(), expectedHeading);
      const totals = await page.locator('[data-guest-checkout-order-totals]').innerText();
      assert.ok(totals.includes(total));
      assert.equal(await page.locator('[data-guest-checkout-test]').isVisible(), order.test === true);
      assert.equal(await page.locator('[data-guest-checkout-fulfillment]').isVisible(), Boolean(order.fulfillment));
      for (const line of order.lines) {
        assert.ok((await page.locator('[data-guest-checkout-order-items]').innerText()).includes(`${line.name ?? line.catalogItemId} × ${line.quantity}`));
      }
      setPhase('print-action');
      const before = await page.evaluate(() => JSON.stringify({ ...localStorage }));
      const readsBefore = checkoutReads;
      await page.evaluate(() => { window.receiptPrintCalls = 0; window.print = () => { window.receiptPrintCalls++; }; });
      await button.focus();
      assert.equal(await button.evaluate(element => element.matches(':focus-visible')), true);
      await page.keyboard.press('Enter');
      await button.click();
      assert.equal(await page.evaluate(() => window.receiptPrintCalls), 2);
      assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage })), before);
      assert.equal(checkoutReads, readsBefore);
      assert.equal(shopper.blockedRequests(), 0);
      assert.equal(await page.locator('[data-guest-checkout-order-totals]').innerText(), totals);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.evaluate(() => document.fonts.ready);
      if (capture) await page.screenshot({ path: `${directory}/screen-${width}.png`, fullPage: true });
      setPhase('print-css');
      await page.emulateMedia({ media: 'print' });
      for (const selector of ['[data-store-header]', '[data-store-footer]', '[data-receipt-screen-only]', '.guest-checkout-actions', '.guest-checkout-item-thumb']) {
        assert.equal(await page.locator(selector).first().isVisible(), false);
      }
      assert.equal(await page.locator('.receipt-print-header').isVisible(), true);
      setPhase('pdf-facts');
      const pdf = await page.pdf({ format: width === 1440 ? 'Letter' : 'A4', displayHeaderFooter: false, printBackground: false });
      if (capture) writeFileSync(`${directory}/receipt-${width}.pdf`, pdf, { mode: 0o600 });
      const text = execFileSync('pdftotext', ['-layout', '-', '-'], { input: pdf, encoding: 'utf8' });
      for (const [index, expected] of ['Backroad Bum', 'backroadbum.com', 'Demo / test store', expectedHeading, total, 'Receipt copy.'].entries()) {
        phase = `pdf-fact-${index}`;
        assert.ok(compact(text).includes(compact(expected)));
      }
      phase = 'pdf-items';
      for (const line of order.lines) if (line.name) assert.ok(compact(text).includes(compact(line.name)));
      if (order.test === true) assert.ok(text.includes('TEST'));
      if (order.fulfillment) assert.ok(text.includes('Fulfillment'));
      assert.doesNotMatch(text, /Continue shopping|Shopper account|Print or save receipt|Search the shop|The experiment/u);
      phase = 'pdf-capabilities';
      const retained = JSON.parse(await page.evaluate(key => localStorage.getItem(key), retainedCheckoutKey));
      for (const secret of [retained.capability, retained.capabilityId]) if (secret) assert.equal(text.includes(secret), false);
      // Signed Commerce may use the attempt UUID in its canonical order ID.
      // That public heading is not a capability and cannot recover an order.
      if (retained.attemptId && !order.orderId.includes(retained.attemptId)) assert.equal(text.includes(retained.attemptId), false);
      phase = 'pdf-page-count';
      assert.equal(text.split('\f').filter(value => value.trim()).length, 1);
      assert.equal(checkoutReads, readsBefore);
      assert.equal(shopper.blockedRequests(), 0);
      await page.emulateMedia({ media: 'screen' });
      assert.equal(await button.isVisible(), true);
      assert.deepEqual(errors, []);
      if (width === 1440) {
        setPhase('long-layout');
        await page.emulateMedia({ media: 'print' });
        // Layout-only copies in this browser, never additional Commerce orders.
        await page.locator('[data-guest-checkout-order-items]').evaluate(list => {
          const template = list.firstElementChild;
          for (let index = 1; index <= 35; index++) {
            const row = template.cloneNode(true);
            row.querySelector('[data-guest-checkout-item-details]').textContent = `Synthetic layout row ${index}`;
            list.append(row);
          }
        });
        const longPdf = await page.pdf({ format: 'Letter', displayHeaderFooter: false });
        const longText = execFileSync('pdftotext', ['-layout', '-', '-'], { input: longPdf, encoding: 'utf8' });
        for (let index = 1; index <= 35; index++) assert.ok(longText.includes(`Synthetic layout row ${index}`));
        assert.ok(longText.includes('Receipt copy.'));
        const pages = longText.split('\f').filter(value => value.trim());
        assert.ok(pages.length > 1 && pages.length < 5);
        assert.ok(pages.every(value => value.trim().length > 20));
        report.syntheticLongReceiptPdf = { browserOnlyFixture: true, addedRows: 35, allRowsPresent: true, pages: pages.length, noBlankPages: true };
        await page.emulateMedia({ media: 'screen' });
      }
      report.checks.push({ width, keyboardPrint: true, repeatedInvocation: true, printDialog: 'stubbed; PDF rendered separately', factsMatchCommerce: true,
        canonicalNumberPresent: Number.isSafeInteger(order.number), testBadgePresent: order.test === true, fulfillmentPresent: Boolean(order.fulfillment),
        onePagePdf: true, paper: width === 1440 ? 'Letter' : 'A4', blockedRequests: 0, printCausedNoStatusReads: true,
        browserStorageUnchangedByPrint: true, noCapabilitiesInPdf: true,
        canonicalIdSharesAttemptId: Boolean(retained.attemptId && order.orderId.includes(retained.attemptId)), noOverflow: true, pageErrors: 0 });
    } finally { await shopper.browser.close(); }
  }
  setPhase('empty-browser');
  const stranger = await openRetainedReceipt({ width: 390, saved: false });
  try {
    await stranger.page.goto(receiptOrigin + '/checkout/success', { waitUntil: 'networkidle' });
    assert.equal(await stranger.page.locator('[data-guest-checkout-print]').isVisible(), false);
    assert.equal(await stranger.page.locator('[data-guest-checkout-order]').isVisible(), false);
    assert.equal(stranger.blockedRequests(), 0);
    report.noSavedCheckoutOffersNoReceiptPrint = true;
  } finally { await stranger.browser.close(); }
  setPhase('state-file-unchanged');
  assert.equal(stateDigest(), beforeFile);
  report.privateStateFileUnchanged = true;
  console.log(JSON.stringify(report, null, 2));
} catch {
  console.error(`Receipt-print verification failed at ${phase}; private receipt content and browser state withheld.`);
  process.exitCode = 1;
}
