import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

/** Browser proof against the real merchant page/wrapper and actual old-kernel capabilities.
 * Artifacts, when requested, must be kept outside git; no capabilities are written.
 */
export async function proveRetainedReceipt({ merchant, origin, scenarios, artifacts }) {
  const { chromium, expect } = createRequire(join(merchant, 'package.json'))('@playwright/test');
  const browser = await chromium.launch();
  const reports = [];
  if (artifacts) mkdirSync(artifacts, { recursive: true });
  try {
    const nojs = await browser.newContext({ javaScriptEnabled: false });
    const nojsPage = await nojs.newPage(); await nojsPage.goto(origin + '/checkout/retained');
    if (artifacts) writeFileSync(join(artifacts, 'nojs.html'), await nojsPage.content());
    await expect(nojsPage.locator('[data-retained-receipt] noscript p')).toBeVisible();
    await expect(nojsPage.locator('[data-retained-receipt] noscript p')).toContainText('needs JavaScript');
    await expect(nojsPage.locator('[data-retained-check]')).toBeHidden();
    await nojs.close();
    for (const width of [1440, 390]) for (const scheme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
      const page = await context.newPage(); page.setDefaultTimeout(20000);
      const posts = []; const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname); });
      const route = origin + '/checkout/retained';
      const initial = await page.goto(route);
      assert.match(initial.headers()['cache-control'], /no-store/);
      assert.equal(await page.locator('[data-retained-order]').isVisible(), false);
      assert.equal(posts.length, 0, 'Page entry must not send an old capability automatically');
      await page.locator('[data-retained-check]').click();
      await expect(page.locator('[data-retained-status]')).toContainText('No earlier checkout');
      assert.equal(posts.length, 0, 'Missing original state must not mint a capability');
      for (const scenario of scenarios) {
        const saved = JSON.stringify(scenario.retention);
        await page.evaluate(raw => {
          localStorage.setItem('dinkus.guest-checkout.v1', raw);
          localStorage.setItem('dinkus.guest-cart.v1', '{"version":1,"lines":[]}');
        }, saved);
        // A new server cart is intentionally present. Retained receipt reads must not adopt/replace it.
        await context.addCookies([{ name: 'dk_cart', value: 'current-cart.untouched', url: origin, httpOnly: true, sameSite: 'Lax' }]);
        await page.locator('[data-retained-check]').click();
        if (scenario.state === 'paid') {
          await expect(page.locator('[data-retained-order]')).toBeVisible();
          await expect(page.locator('[data-retained-order]')).toContainText('$32.00');
          assert.equal(await page.locator('[data-retained-order]').innerText().then(value => value.includes('$28.00')), false);
          // Stale already-painted private data must disappear after a real cross-tab storage event.
          const tab = await context.newPage(); await tab.goto(origin);
          await tab.evaluate(() => localStorage.removeItem('dinkus.guest-checkout.v1'));
          await expect(page.locator('[data-retained-order]')).toBeHidden();
          await expect(page.locator('[data-retained-status]')).toContainText('changed in another tab');
          await tab.close(); await page.evaluate(raw => localStorage.setItem('dinkus.guest-checkout.v1', raw), saved);
          await page.locator('[data-retained-check]').click(); await expect(page.locator('[data-retained-order]')).toBeVisible();
          await page.emulateMedia({ media: 'print' });
          assert.equal(await page.locator('[data-retained-check]').isVisible(), false);
          assert.equal(await page.locator('[data-retained-order]').isVisible(), true);
          await page.emulateMedia({ media: 'screen' });
          if (artifacts) {
            await page.screenshot({ path: join(artifacts, `paid-${width}-${scheme}.png`), fullPage: true });
            if (width === 1440 && scheme === 'light') {
              // Static painted snapshot for the official four-view auditor, not a fake API response.
              const html = await page.content();
              assert(!html.includes(scenario.retention.capability));
              writeFileSync(join(artifacts, 'paid-audit.html'), html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace('<head>', `<head><base href="${origin}/">`));
            }
          }
        } else {
          await expect(page.locator('[data-retained-status]')).toContainText('not confirmed');
          await expect(page.locator('[data-retained-order]')).toBeHidden();
        }
        assert.equal(await page.evaluate(() => localStorage.getItem('dinkus.guest-checkout.v1')), saved);
        assert.equal(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1')), '{"version":1,"lines":[]}');
        assert.equal((await context.cookies()).find(cookie => cookie.name === 'dk_cart')?.value, 'current-cart.untouched');
      }
      assert.deepEqual([...new Set(posts)], ['/api/checkout/status']);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      reports.push({ width, scheme, originalPaidAndPending: true, frozenTotal: '3200', storageUnchanged: true, newCartCookieUnchanged: true, onlyStatusPosts: true, crossTabRevocation: true, print: true, overflow: false });
      await context.close();
    }
    await browser.close();
    // Optional workspace UI skill; not a dependency of the portable qualification.
    let auditExit = null;
    if (artifacts && process.env.UI_DESIGN_AUDITOR) {
      const child = spawn(process.execPath, [process.env.UI_DESIGN_AUDITOR, join(artifacts, 'paid-audit.html'), '--screenshots', join(artifacts, 'audit')], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      child.stdout.on('data', chunk => stdout += chunk); child.stderr.on('data', chunk => stderr += chunk);
      auditExit = await new Promise(resolve => child.on('exit', resolve));
      writeFileSync(join(artifacts, 'audit.md'), stdout); writeFileSync(join(artifacts, 'audit.stderr'), stderr);
      assert.equal(auditExit, 0, 'Official rendered audit must complete; inspect findings separately');
    }
    return { contexts: reports, auditExit, noScriptGuidance: true, actualOldKernelCapabilities: true, liveBrowserUsed: false };
  } finally { await browser.close(); }
}
