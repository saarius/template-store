// Read-only shopper checks. Never request a code, verify a code or save a session.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

if (!process.argv.includes('--check')) {
  console.log('No action. --check verifies the paused merchant sign-in and browser-bound receipt path; --capture saves ignored local screenshots.');
  process.exit(0);
}
const origin = 'https://backroadbum.com';
const captures = process.argv.includes('--capture');
const results = [];
let browser;
try {
  browser = await chromium.launch({ headless: true });
  if (captures) mkdirSync('runs/backroadbum/account', { recursive: true });
  for (const width of [1440, 390]) {
    for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, javaScriptEnabled });
      let accountRequests = 0, blockedWrites = 0;
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname.includes('/account/')) accountRequests++;
        if (!['GET', 'HEAD'].includes(request.method()) &&
            !(request.method() === 'POST' && url.origin === origin && url.pathname === '/api/checkout/status')) {
          blockedWrites++;
          return route.abort();
        }
        return route.continue();
      });
      const page = await context.newPage();
      const response = await page.goto(origin + '/account', { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      await page.locator('[data-account-email-paused]').waitFor();
      assert.equal(await page.locator('h1').innerText(), 'Account');
      assert.equal(await page.locator('[data-account-start-form], [data-account-verify-form]').count(), 0);
      const recovery = page.locator('[data-account-receipt-link]');
      assert.equal(await recovery.getAttribute('href'), '/checkout/success');
      assert.match(await page.locator('[data-account-email-paused]').innerText(), /Only its latest checkout is saved/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const box = await recovery.boundingBox();
      assert.ok(box.height >= 48);
      if (captures) await page.screenshot({ path: `runs/backroadbum/account/${width}-${javaScriptEnabled ? 'js' : 'no-js'}.png` });
      // Tab to the ordinary link and follow it with no script-driven navigation.
      let reached = false;
      for (let step = 0; step < 20; step++) {
        await page.keyboard.press('Tab');
        reached = await recovery.evaluate(link => document.activeElement === link);
        if (reached) break;
      }
      assert.equal(reached, true);
      await Promise.all([page.waitForURL(origin + '/checkout/success'), page.keyboard.press('Enter')]);
      if (javaScriptEnabled) {
        await page.waitForFunction(() => document.querySelector('#guest-checkout-return-title')?.textContent === 'No saved checkout in this browser');
        assert.equal(await page.locator('[data-guest-checkout-order]').isVisible(), false);
      } else {
        // The recovery controller itself needs JavaScript; this only proves navigation.
        assert.equal(await page.locator('#guest-checkout-return-title').innerText(), 'Order confirmation');
      }
      assert.equal(blockedWrites, 0);
      assert.equal(accountRequests, 0);
      results.push({ width, javaScriptEnabled, pausedForm: true, keyboardReceiptPath: true,
        minimumTarget: true, noOverflow: true, accountRequests, blockedWrites });
      await context.close();
    }
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), surface: 'merchant account email pause', results }, null, 2));
} catch {
  console.error('Account verification failed; no browser state, response body or private configuration emitted.');
  process.exitCode = 1;
} finally { await browser?.close(); }
