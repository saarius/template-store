// Inspect one retained guest checkout without opening new-checkout admission.
// No prepare/start, payment submission, operator dispatcher or saved-state writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

if (!process.argv.includes('--check')) {
  console.log('No action. --check inspects a retained public receipt; --native also diagnoses the signed status response. --state-file=PATH selects private browser state.');
  process.exit(0);
}
const origin = 'https://backroadbum.com';
const statusPath = '/api/checkout/status';
const nativePath = '/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/status';
const key = 'dinkus.guest-checkout.v1';
const path = process.argv.find(arg => arg.startsWith('--state-file='))?.slice('--state-file='.length) ?? '/etc/backroadbum/public-shopper-browser.json';
const report = { checkedAt: new Date().toISOString(), surface: 'public retained guest checkout', responses: [], blockedWrites: 0 };
const safeCode = value => typeof value === 'string' && /^[A-Z_]{1,80}$/u.test(value) ? value : null;
const summarize = (http, body) => {
  const value = body?.success === true ? body.data : body;
  return { http, transportSuccess: typeof body?.success === 'boolean' ? body.success : null,
    ok: value?.ok === true, code: safeCode(value?.error?.code),
    state: ['paid', 'pending', 'recoverable-failure', 'released-retry'].includes(value?.checkout?.state) ? value.checkout.state : null,
    hasPaidOrder: Boolean(value?.ok && value.checkout?.state === 'paid' && value.checkout.order) };
};
let browser;
try {
  const state = JSON.parse(readFileSync(path, 'utf8'));
  const origins = state.origins.filter(entry => entry.origin === origin);
  const retained = origins[0]?.localStorage.find(entry => entry.name === key)?.value;
  assert.equal(typeof retained, 'string');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: { cookies: [], origins } });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method()) && !(request.method() === 'POST' && url.origin === origin &&
        (url.pathname === statusPath || process.argv.includes('--native') && url.pathname === nativePath))) {
      report.blockedWrites++;
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  const reads = [];
  page.on('response', response => {
    if (new URL(response.url()).pathname !== statusPath) return;
    reads.push((async () => {
      let body;
      try { body = await response.json(); } catch { /* Only shape/codes leave this process. */ }
      report.responses.push(summarize(response.status(), body));
    })());
  });
  await page.goto(origin + '/checkout/success', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.querySelector('[data-guest-checkout-return-status]')?.textContent?.includes('Checking'));
  await Promise.all(reads);
  report.receiptVisible = await page.locator('[data-guest-checkout-order]').isVisible();
  report.printVisible = await page.locator('[data-guest-checkout-print]').isVisible();
  if (process.argv.includes('--native')) {
    // Read with the same capability in the same browser origin. Never return the body/identifiers to the operator log.
    const result = await page.evaluate(async ({ key, nativePath }) => {
      const saved = JSON.parse(localStorage.getItem(key));
      const response = await fetch(nativePath, { method: 'POST', cache: 'no-store', headers: {
        'content-type': 'application/json', 'x-commerce-guest-capability': saved.capability,
      }, body: JSON.stringify(saved.attemptId ? { attemptId: saved.attemptId } : {}) });
      let body;
      try { body = await response.json(); } catch { return { http: response.status }; }
      const value = body?.success === true ? body.data : body;
      return { http: response.status, body: { success: body?.success, ok: value?.ok,
        error: { code: value?.error?.code }, checkout: { state: value?.checkout?.state,
          order: Boolean(value?.checkout?.order) } } };
    }, { key, nativePath });
    // The evaluate result is deliberately reduced before crossing the browser boundary.
    report.native = summarize(result.http, result.body?.success === true ? { ...result.body, data: result.body } : result.body);
  }
  report.retentionUnchanged = await page.evaluate(({ key, retained }) => localStorage.getItem(key) === retained, { key, retained });
  report.noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  assert.equal(report.blockedWrites, 0);
  assert.equal(report.noOverflow, true);
  assert.ok(report.responses.length > 0);
  console.log(JSON.stringify(report, null, 2));
} catch {
  console.error('Receipt inspection failed; browser state, response bodies and identifiers withheld.');
  process.exitCode = 1;
} finally { await browser?.close(); }
