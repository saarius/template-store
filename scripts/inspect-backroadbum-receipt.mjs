// Inspect one retained guest checkout without opening new-checkout admission.
// No prepare/start, payment submission, operator dispatcher or saved-state writes.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { summarizeGuestFulfillment } from './lib/backroadbum-guest-fulfillment.mjs';
import { boundedResponseJson } from './lib/bounded-response-json.mjs';
import { openRetainedReceipt, nativeReceiptStatusPath as nativePath, receiptStatusPath as statusPath, retainedCheckoutKey as key } from './lib/backroadbum-retained-receipt.mjs';

if (!process.argv.includes('--check')) {
  console.log('No action. --check inspects a retained public receipt; --native also diagnoses the signed status response. --fulfillment adds a read-only canonical TEST order comparison (implies --native). --state-file=PATH selects private browser state.');
  process.exit(0);
}
const origin = 'https://backroadbum.com';
const fulfillment = process.argv.includes('--fulfillment');
const native = fulfillment || process.argv.includes('--native');
const path = process.argv.find(arg => arg.startsWith('--state-file='))?.slice('--state-file='.length) ?? '/etc/backroadbum/public-shopper-browser.json';
const report = { checkedAt: new Date().toISOString(), surface: 'public retained guest checkout', responses: [], blockedRequests: 0 };
const safeCode = value => typeof value === 'string' && /^[A-Z_]{1,80}$/u.test(value) ? value : null;
const summarize = (http, body) => {
  const value = body?.success === true ? body.data : body;
  return { http, transportSuccess: typeof body?.success === 'boolean' ? body.success : null,
    ok: typeof value?.ok === 'boolean' ? value.ok : null, code: safeCode(value?.error?.code),
    state: ['paid', 'pending', 'recoverable-failure', 'released-retry'].includes(value?.checkout?.state) ? value.checkout.state : null,
    hasPaidOrder: typeof value?.ok === 'boolean' ? Boolean(value.ok && value.checkout?.state === 'paid' && value.checkout.order) : null };
};
let browser;
const progress = stage => { if (process.env.BACKROADBUM_VERIFY_PROGRESS === '1') console.error(stage); };
try {
  progress('opening');
  const beforeFile = readFileSync(path);
  const shopper = await openRetainedReceipt({ statePath: path, native });
  browser = shopper.browser;
  const page = shopper.page;
  progress('browser-ready');
  const retained = shopper.retained;
  assert.equal(typeof retained, 'string');
  const reads = [];
  page.on('response', response => {
    if (new URL(response.url()).pathname !== statusPath) return;
    reads.push((async () => {
      const body = await boundedResponseJson(response);
      report.responses.push(summarize(response.status(), body));
    })());
  });
  progress('loading');
  await page.goto(origin + '/checkout/success', { waitUntil: 'networkidle' });
  progress('loaded');
  await page.waitForFunction(() => !document.querySelector('[data-guest-checkout-return-status]')?.textContent?.includes('Checking'), null, { timeout: 20_000 });
  progress('status-settled');
  await Promise.all(reads);
  progress('status-read');
  report.receiptVisible = await page.locator('[data-guest-checkout-order]').isVisible();
  report.printVisible = await page.locator('[data-guest-checkout-print]').isVisible();
  if (native) {
    // Read with the same capability in the same browser origin. Never log bodies
    // or identifiers. The explicit operator-only comparison uses the paid order
    // ID internally to join its canonical TEST record, not as shopper authority.
    progress('native-read');
    const result = await page.evaluate(async ({ key, nativePath, fulfillment }) => {
      const saved = JSON.parse(localStorage.getItem(key));
      const response = await fetch(nativePath, { method: 'POST', cache: 'no-store', headers: {
        'content-type': 'application/json', 'x-commerce-guest-capability': saved.capability,
      }, body: JSON.stringify(saved.attemptId ? { attemptId: saved.attemptId } : {}), signal: AbortSignal.timeout(15000) });
      let body;
      try { body = await response.json(); } catch { return { http: response.status }; }
      const value = body?.success === true ? body.data : body;
      const order = value?.checkout?.order;
      return { http: response.status, body: { success: body?.success, ok: value?.ok,
        error: { code: value?.error?.code }, checkout: { state: value?.checkout?.state,
          order: Boolean(order) } }, ...(fulfillment ? { comparison: {
            paid: value?.ok === true && value?.checkout?.state === 'paid',
            orderId: typeof order?.orderId === 'string' ? order.orderId : null,
            fulfillmentPresent: Boolean(order?.fulfillment ?? value?.checkout?.fulfillment),
            completionPresent: Boolean(order?.completed),
            statusPresent: typeof order?.status === 'string',
          } } : {}) };
    }, { key, nativePath, fulfillment });
    // The evaluate result is deliberately reduced before crossing the browser boundary.
    report.native = summarize(result.http, result.body?.success === true ? { ...result.body, data: result.body } : result.body);
    if (fulfillment) {
      const db = new DatabaseSync('/var/lib/backroadbum/content.db', { readOnly: true });
      try {
        const records = db.prepare("SELECT data FROM _plugin_storage WHERE collection='orders'").all().map(row => JSON.parse(row.data));
        report.fulfillment = summarizeGuestFulfillment(result.comparison, records);
        report.fulfillment.receiptFulfillmentVisible = await page.locator('[data-guest-checkout-fulfillment]').isVisible();
      } finally { db.close(); }
    }
  }
  report.retentionUnchanged = await page.evaluate(({ key, retained }) => localStorage.getItem(key) === retained, { key, retained });
  report.noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  report.privateStateFileUnchanged = beforeFile.equals(readFileSync(path));
  assert.equal(report.privateStateFileUnchanged, true);
  report.blockedRequests = shopper.blockedRequests();
  assert.equal(report.blockedRequests, 0);
  assert.equal(report.noOverflow, true);
  assert.ok(report.responses.length > 0);
  console.log(JSON.stringify(report, null, 2));
} catch {
  console.error('Receipt inspection failed; browser state, response bodies and identifiers withheld.');
  process.exitCode = 1;
} finally { await browser?.close(); }
