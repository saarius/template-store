// Read an existing paid receipt, exercise local printing and inspect its PDF.
// No cart prepare/start, payment, catalog edit or fulfillment action is allowed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openShopperPreview } from './lib/backroadbum-shopper-preview.mjs';

if (!process.argv.includes('--check')) {
  console.log('No action. --check reads the public retained receipt; requires pdftotext. --capture keeps private local artifacts.');
  process.exit(0);
}
const statePath = process.argv.find(value => value.startsWith('--state-file='))?.slice('--state-file='.length) ?? '/etc/backroadbum/public-shopper-browser.json';
const capture = process.argv.includes('--capture');
const directory = 'runs/backroadbum/receipt-print';
if (capture) mkdirSync(directory, { recursive: true });
const report = { checkedAt: new Date().toISOString(), source: 'public Commerce-authorized retained receipt', checks: [] };
try {
  for (const width of [1440, 390]) {
    const shopper = await openShopperPreview({ saved: true, width, statePath, publicStore: true });
    try {
      const { page } = shopper;
      let checkoutReads = 0;
      let checkoutWrites = 0;
      const errors = [];
      page.on('pageerror', () => errors.push('pageerror'));
      page.on('request', request => {
        if (/\/checkout\/guest\/(prepare|start)$/u.test(new URL(request.url()).pathname)) checkoutWrites++;
        if (/\/(checkout\/guest\/status|api\/checkout\/status)$/u.test(new URL(request.url()).pathname)) checkoutReads++;
      });
      await page.goto('https://backroadbum.com/checkout/success', { waitUntil: 'networkidle' });
      const button = page.getByRole('button', { name: 'Print or save receipt', exact: true });
      await button.waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-guest-checkout-order]').isVisible(), true);
      const heading = await page.locator('[data-guest-checkout-order-number]').innerText();
      const totals = await page.locator('[data-guest-checkout-order-totals]').innerText();
      assert.match(heading, /^Order #\d+$/u);
      assert.match(totals, /\$22\.00/u);
      assert.equal(await page.locator('[data-guest-checkout-test]').isVisible(), true);
      const before = await page.evaluate(() => JSON.stringify({ ...localStorage }));
      const readsBefore = checkoutReads;
      await page.evaluate(() => { window.receiptPrintCalls = 0; window.print = () => { window.receiptPrintCalls++; }; });
      await button.focus();
      assert.equal(await button.evaluate(element => element.matches(':focus-visible')), true);
      await page.keyboard.press('Enter');
      await button.click(); // A second invocation after a dismissed print dialog.
      assert.equal(await page.evaluate(() => window.receiptPrintCalls), 2);
      assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage })), before);
      assert.equal(checkoutReads, readsBefore);
      assert.equal(checkoutWrites, 0);
      assert.equal(await page.locator('[data-guest-checkout-order-number]').innerText(), heading);
      assert.equal(await page.locator('[data-guest-checkout-order-totals]').innerText(), totals);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.evaluate(() => document.fonts.ready);
      if (capture) await page.screenshot({ path: `${directory}/screen-${width}.png`, fullPage: true });
      await page.emulateMedia({ media: 'print' });
      for (const selector of ['[data-store-header]', '[data-store-footer]', '[data-receipt-screen-only]', '.guest-checkout-actions', '.guest-checkout-item-thumb']) {
        assert.equal(await page.locator(selector).first().isVisible(), false);
      }
      assert.equal(await page.locator('.receipt-print-header').isVisible(), true);
      assert.equal(await page.locator('[data-guest-checkout-test]').isVisible(), true);
      const pdf = await page.pdf({ format: width === 1440 ? 'Letter' : 'A4', displayHeaderFooter: false, printBackground: false });
      const text = execFileSync('pdftotext', ['-layout', '-', '-'], { input: pdf, encoding: 'utf8' });
      for (const expected of ['Backroad Bum', 'backroadbum.com', 'Demo / test store', heading, 'TEST', 'Creekside Camp Mug', '$22.00', 'Fulfillment', 'Receipt copy.']) assert.ok(text.includes(expected));
      assert.doesNotMatch(text, /Continue shopping|Shopper account|Print or save receipt|Search the shop|The experiment/u);
      const retained = JSON.parse(await page.evaluate(() => localStorage.getItem('dinkus.guest-checkout.v1')));
      for (const secret of [retained.capability, retained.capabilityId, retained.attemptId]) if (secret) assert.equal(text.includes(secret), false);
      assert.equal(text.split('\f').filter(value => value.trim()).length, 1);
      if (capture) writeFileSync(`${directory}/receipt-${width}.pdf`, pdf);
      await page.emulateMedia({ media: 'screen' });
      assert.equal(await button.isVisible(), true);
      assert.deepEqual(errors, []);
      if (width === 1440) {
        await page.emulateMedia({ media: 'print' });
        // Browser-only pagination fixture, not another Commerce order or proof.
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
      report.checks.push({ width, keyboardPrint: true, repeatedInvocation: true, printDialog: 'stubbed; PDF rendered separately', canonicalNumberAndTotals: true, testLabel: true, onePagePdf: true, paper: width === 1440 ? 'Letter' : 'A4', noCheckoutWrites: true, printCausedNoReads: true, storageUnchanged: true, noCapabilitiesInPdf: true, noOverflow: true, pageErrors: 0 });
    } finally { await shopper.browser.close(); }
  }
  const stranger = await openShopperPreview({ width: 390, publicStore: true });
  try {
    await stranger.page.goto('https://backroadbum.com/checkout/success', { waitUntil: 'networkidle' });
    assert.equal(await stranger.page.locator('[data-guest-checkout-print]').isVisible(), false);
    assert.equal(await stranger.page.locator('[data-guest-checkout-order]').isVisible(), false);
    report.noSavedCheckoutOffersNoReceiptPrint = true;
  } finally { await stranger.browser.close(); }
  console.log(JSON.stringify(report, null, 2));
} catch {
  console.error('Receipt-print verification failed; private receipt content and browser state withheld.');
  process.exitCode = 1;
}
