// Read-only storefront, synthetic status transport. No private browser or provider calls.
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, chmod } from 'node:fs/promises';
const base = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
const before = process.argv.includes('--before');
const output = process.env.BACKROADBUM_STATUS_FOCUS_OUTPUT || new URL('../runs/backroadbum/status-focus/', import.meta.url).pathname;
const fixtures = process.env.BACKROADBUM_STATUS_FOCUS_AUDIT;
await mkdir(output, { recursive: true });
if (fixtures) await mkdir(fixtures, { recursive: true });
const capability = { capabilityId: 'focus-proof', capability: 'focus-proof.synthetic', retention: 'json-body', header: 'x-commerce-guest-capability', attemptId: 'focus-attempt' };
const money = minor => ({ currency: 'USD', minor });
const line = { catalogItemId: 'focus-mug', name: 'Camp mug · synthetic proof', quantity: 1, unitPrice: money('1800'), imageUrl: '/backroad/mug.svg' };
function response(mode) {
  if (mode === 'failure') return { ok: false };
  return { ok: true, capabilityId: capability.capabilityId, checkout: {
    schema: 'dinkuskit.commerce.guest-checkout-projection/v1', state: mode, attemptId: capability.attemptId,
    lines: [line], total: money('1800'), redirectUrl: null, unavailable: null,
    retryAfter: mode === 'released-retry' ? capability.attemptId : null,
    order: mode === 'paid' ? { orderId: 'order:focus-proof', receiptId: 'receipt:focus-proof', number: 4242, test: true, lines: [line], total: money('1800') } : null,
  } };
}
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) for (const colorScheme of (before ? ['light'] : ['light', 'dark'])) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme, reducedMotion: 'reduce', serviceWorkers: 'block', userAgent: 'BackroadBum-SelfCheck/1.0' });
    const blocked = [], errors = [];
    let calls = 0, next = 'pending', held = null, delay = false;
    try {
      await context.addInitScript(capability => {
        if (localStorage.getItem('dinkus.guest-checkout.v1') === null) localStorage.setItem('dinkus.guest-checkout.v1', JSON.stringify(capability));
      }, capability);
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin !== new URL(base).origin) { blocked.push('foreign'); return route.abort(); }
        if (url.pathname === '/api/checkout/status' || url.pathname.endsWith('/checkout/guest/status')) {
          calls++;
          assert.equal(req.method(), 'POST');
          if (delay) { await new Promise(resolve => { held = resolve; }); held = null; }
          return route.fulfill({ json: response(next) });
        }
        if (['GET', 'HEAD'].includes(req.method())) return route.continue();
        blocked.push(url.pathname); return route.abort('blockedbyclient');
      });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.name));
      const button = page.locator('[data-guest-checkout-status-retry]'), status = page.locator('[data-guest-checkout-return-status]');
      const active = () => page.evaluate(() => document.activeElement?.getAttribute('data-guest-checkout-status-retry') !== null && document.activeElement?.hasAttribute('data-guest-checkout-status-retry') ? 'retry' : document.activeElement?.hasAttribute('data-guest-checkout-return-status') ? 'status' : document.activeElement?.tagName.toLowerCase());
      const fresh = async () => {
        next = 'pending'; delay = false; await page.goto(base + '/checkout/success');
        await expect(status).toContainText('still pending'); await expect(button).toBeVisible();
        assert.equal(await active(), 'body', 'Initial automatic read must not steal focus');
      };
      const begin = async (focus = true) => {
        delay = true; const start = calls;
        if (focus) await button.focus();
        await page.keyboard.press('Enter');
        await expect(status).toHaveText('Checking the saved checkout status.');
        await expect.poll(() => held !== null).toBe(true);
        return start;
      };
      const finish = async (mode = 'pending') => { next = mode; delay = false; held(); await expect(status).not.toHaveText('Checking the saved checkout status.'); };
      const capture = async name => {
        await page.evaluate(() => document.fonts.ready);
        await status.scrollIntoViewIfNeeded();
        const path = `${output}/${before ? 'before' : 'after'}-${name}-${width}-${colorScheme}.png`;
        await page.screenshot({ path }); await chmod(path, 0o644);
        if (fixtures && width === 1440 && colorScheme === 'light') {
          const html = (await page.content()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace('<head>', `<head><base href="${base}/">`);
          await writeFile(`${fixtures}/${name}.html`, html);
        }
      };
      await fresh();
      const start = await begin(), pendingFocus = await active();
      // Repeat keyboard and scripted activation while the same request is held.
      await page.keyboard.press('Enter'); await page.keyboard.press('Space'); await button.dispatchEvent('click');
      assert.equal(calls, start + 1, 'In-flight reentry must not send another status call');
      if (!before) { await expect(button).toBeFocused(); await expect(button).toHaveAttribute('aria-disabled', 'true'); await expect(button).toHaveAttribute('aria-busy', 'true'); }
      await capture('checking'); await finish();
      const pendingResultFocus = await active();
      if (!before) { await expect(button).toBeFocused(); await expect(button).toHaveAttribute('aria-disabled', 'false'); await expect(button).not.toHaveAttribute('aria-busy'); }
      await capture('pending');
      if (before) {
        results.push({ width, colorScheme, pendingFocus, pendingResultFocus, inFlightRequests: calls - start, blocked, errors });
        continue;
      }
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dinkus.guest-checkout.v1')));
      assert.equal(saved.capability, capability.capability); assert.equal(saved.attemptId, capability.attemptId);
      // A second keyboard activation works without refocusing; terminal result replaces it with focused status.
      await begin(false); await finish('paid');
      await expect(page.locator('[data-guest-checkout-order]')).toBeVisible(); await expect(button).toBeHidden(); await expect(status).toBeFocused();
      await capture('confirmed');
      for (const mode of ['failure', 'released-retry']) {
        await fresh(); await begin(); await finish(mode);
        await expect(button).toBeHidden(); await expect(status).toBeFocused();
        await expect(page.locator('[data-guest-checkout-order]')).toBeHidden();
      }
      // No delayed result may pull focus back after the shopper moved to navigation.
      await fresh(); await begin();
      const shop = page.locator('.guest-checkout-continue'); await shop.focus();
      await finish('paid'); await expect(shop).toBeFocused();
      await fresh(); await begin(); await shop.focus(); await finish(); await expect(shop).toBeFocused();
      // Automatic + four explicit reads exhaust the established five-read budget.
      await fresh();
      for (let index = 0; index < 4; index++) { await begin(); await finish(); }
      await expect(status).toContainText('temporarily limited'); await expect(button).toHaveAttribute('aria-disabled', 'true'); await expect(button).toBeFocused();
      const limitedCalls = calls; await button.press('Enter'); await button.press('Space'); await button.dispatchEvent('click');
      assert.equal(calls, limitedCalls);
      await expect(status).toContainText('temporarily limited'); await expect(button).toBeVisible(); await expect(button).toBeFocused();
      await expect(page.locator('[data-guest-checkout-order]')).toBeHidden(); await capture('limited');
      await button.press('Tab'); await expect(button).not.toBeFocused();
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const retained = await page.evaluate(() => JSON.parse(localStorage.getItem('dinkus.guest-checkout.v1')));
      assert.equal(retained.capability, capability.capability); assert.equal(retained.attemptId, capability.attemptId);
      results.push({ width, colorScheme, pendingFocus, pendingResultFocus, repeatedActivationGuard: true, terminalFocus: ['paid', 'failure', 'released-retry'], movedAwayNotStolen: true, fiveReadBudgetPreserved: true, limitedControlFocusable: true, capabilityAndAttemptRetained: true, blocked, errors, calls, serverWrites: 0, providerCalls: 0, noOverflow: true });
    } finally { held?.(); await context.close(); }
  }
} finally { await browser.close(); }
const report = { checkedAt: new Date().toISOString(), before, scope: 'Synthetic browser-only status responses on actual storefront; not provider or original-retention qualification.', results };
await writeFile(`${output}/${before ? 'before' : 'after'}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
