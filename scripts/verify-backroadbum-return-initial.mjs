// Read-only public return-page startup checks in fresh, empty browser contexts.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';

if (!process.argv.includes('--check')) {
  console.log('No action. --check verifies disabled, blocked and delayed scripts without a retained checkout; --capture saves ignored screenshots.');
  process.exit(0);
}
const origin = 'https://backroadbum.com';
const capture = process.argv.includes('--capture');
const output = 'runs/backroadbum/return-initial';
const results = [];
let browser;
try {
  if (capture) mkdirSync(output, { recursive: true });
  browser = await chromium.launch();
  for (const width of [1440, 390]) for (const mode of ['disabled', 'blocked', 'delayed']) {
    const context = await browser.newContext({ viewport: { width, height: 900 },
      javaScriptEnabled: mode !== 'disabled', serviceWorkers: 'block', userAgent: 'BackroadBum-SelfCheck/1.0' });
    let releaseScripts = () => {};
    const gate = new Promise(resolve => { releaseScripts = resolve; });
    let blockedWrites = 0, scripts = 0, statusRequests = 0;
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin || !['GET', 'HEAD'].includes(request.method())) {
        blockedWrites++;
        await route.abort();
        return;
      }
      if (url.pathname === '/api/checkout/status') statusRequests++;
      if (request.resourceType() === 'script') {
        scripts++;
        if (mode === 'blocked') { await route.abort(); return; }
        if (mode === 'delayed') await gate;
      }
      await route.continue();
    });
    try {
      const page = await context.newPage();
      await page.goto(origin + '/checkout/success?session_id=forged&paid=1', { waitUntil: 'commit' });
      const root = page.locator('[data-guest-checkout-return]');
      await expect(root.getByRole('heading', { name: 'Checkout status', exact: true })).toBeVisible();
      const status = root.locator('[data-guest-checkout-return-status]');
      await expect(status).toContainText('has not checked your saved checkout yet');
      await expect(status).toContainText('enable JavaScript and reload');
      await expect(status).toContainText('browser you checked out with');
      await expect(status).toContainText('Keep that browser’s site data');
      for (const selector of ['[data-guest-checkout-order]', '[data-guest-checkout-retry]',
        '[data-guest-checkout-status-retry]', '[data-guest-checkout-print]']) await expect(root.locator(selector)).toBeHidden();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (capture && mode !== 'delayed') await page.screenshot({ path: `${output}/after-${width}-${mode}.png` });
      if (mode === 'delayed') {
        // Do not await font/screenshot readiness while deferred modules are held.
        releaseScripts();
        await expect(root.getByRole('heading', { name: 'No saved checkout in this browser', exact: true })).toBeVisible();
        await expect(status).not.toContainText('has not checked your saved checkout yet');
        await expect(root.locator('[data-guest-checkout-order]')).toBeHidden();
        if (capture) await page.screenshot({ path: `${output}/after-${width}-enhanced.png` });
      } else {
        const shop = root.getByRole('link', { name: 'Continue shopping', exact: true });
        await expect(shop).toHaveAttribute('href', '/shop');
        await shop.focus();
        await page.keyboard.press('Enter');
        await page.waitForURL(url => url.pathname === '/shop');
      }
      if (mode !== 'disabled') assert.ok(scripts > 0);
      assert.equal(blockedWrites, 0);
      assert.equal(statusRequests, 0);
      results.push({ width, mode, uncheckedGuidance: true, noOverflow: true, hiddenReceiptAndRetries: true,
        enhancedEmptyState: mode === 'delayed', keyboardShopLink: mode !== 'delayed', blockedWrites, statusRequests });
    } finally { releaseScripts(); await context.close(); }
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
} catch {
  console.error('Return startup verification failed; no browser state or private response emitted.');
  process.exitCode = 1;
} finally { await browser?.close(); }
