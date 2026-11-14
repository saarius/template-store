// Merchant journey presentation: real catalog reads, synthetic checkout transport only.
// Never authorizes a payment, writes CMS data, or opens an operator's saved browser.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const base = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
const before = process.argv.includes('--before');
const publicDir = process.env.BACKROADBUM_DESIGN_PROOF_DIR;
const fixtures = process.env.BACKROADBUM_DESIGN_AUDIT_DIR;
const output = new URL('../runs/backroadbum/journey-design/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
if (publicDir) await mkdir(publicDir, { recursive: true });
if (fixtures) await mkdir(fixtures, { recursive: true });
const usd = minor => ({ currency: 'USD', minor });
const projection = { schema: 'dinkuskit.commerce.guest-checkout-projection/v1', state: 'pending', attemptId: null,
  lines: [], total: null, redirectUrl: null, order: null, retryAfter: null, unavailable: null };
const capability = { capabilityId: 'layout-proof', capability: 'layout-proof.synthetic', retention: 'json-body', header: 'x-commerce-guest-capability' };
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) for (const colorScheme of (before ? ['light'] : ['light', 'dark'])) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme,
      reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    let mode = 'prepared', prepares = 0, statusReads = 0;
    const unexpected = [], errors = [];
    try {
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.name));
      // Admission is simulated in browser HTML even when the preview is deliberately closed.
      // All checkout requests below are intercepted; no capability can reach the server.
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== new URL(base).origin) { unexpected.push('foreign request'); return route.abort(); }
        if (request.method() === 'GET' && ['/cart', '/checkout', '/checkout/'].includes(url.pathname)) {
          const response = await route.fetch();
          return route.fulfill({ response, body: (await response.text()).replace('data-guest-checkout-admitted="false"', 'data-guest-checkout-admitted="true"') });
        }
        if (['GET', 'HEAD'].includes(request.method())) return route.continue();
        if (url.pathname.endsWith('/checkout/guest/prepare')) {
          prepares++; return route.fulfill({ json: { ok: true, capabilityId: capability.capabilityId, capability, checkout: projection } });
        }
        if (url.pathname === '/api/checkout/status' || url.pathname.endsWith('/checkout/guest/status')) {
          statusReads++;
          if (mode === 'prepared') return route.fulfill({ json: { ok: true, capabilityId: capability.capabilityId, checkout: projection } });
          const line = { catalogItemId: 'layout-mug', name: 'Creekside Camp Mug · layout proof', quantity: 2, unitPrice: usd('1800'), imageUrl: '/backroad/mug.svg' };
          const contact = { email: 'camper@example.invalid', delivery: { name: 'Demo Camper', line1: '123 Demo Trail', city: 'Sampleville', region: 'OR', postalCode: '97000', country: 'US' } };
          return route.fulfill({ json: { ok: true, capabilityId: capability.capabilityId, checkout: {
            ...projection, attemptId: 'layout-attempt', state: mode === 'paid' ? 'paid' : 'pending', lines: [line], total: usd('4100'),
            pricing: { merchandiseSubtotal: usd('3600'), shipping: { mode: 'flat', charge: usd('500') }, finalTotal: usd('4100') },
            order: mode === 'paid' ? { orderId: 'order:layout-proof', receiptId: 'receipt:layout-proof', number: 4242, test: true,
              lines: [line], total: usd('4100'), contact, fulfillment: { status: 'completed', completedAt: '2026-11-14T00:00:00Z', carrier: 'USPS sandbox', tracking: 'LAYOUT-ONLY' } } : null,
          } } });
        }
        unexpected.push(url.pathname); return route.abort();
      });
      const capture = async (name, selector) => {
        await page.evaluate(() => document.fonts.ready);
        const path = `${publicDir || output}/phase3-${before ? 'before' : 'after'}-${name}-${width}-${colorScheme}.png`;
        if (selector) await page.locator(selector).screenshot({ path });
        else await page.screenshot({ path });
        await chmod(path, 0o644);
        if (fixtures && !before && width === 1440 && colorScheme === 'light') {
          let html = await page.content();
          html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace('<head>', `<head><base href="${base}/">`);
          await writeFile(`${fixtures}/${name}.html`, html);
        }
      };
      const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.goto(base + '/products/creekside-camp-mug');
      const id = await page.locator('[data-commerce-item]').getAttribute('data-commerce-item'); expect(id).toBeTruthy();
      await page.evaluate(id => localStorage.setItem('dinkus.guest-cart.v1', JSON.stringify({ version: 1, lines: [{ id, quantity: 2 }] })), id);
      await page.goto(base + '/cart');
      await expect(page.locator('[data-guest-cart-subtotal-amount]')).toHaveText('$36.00');
      await expect(page.locator('[data-guest-cart-checkout]')).toBeEnabled();
      await fits(); await capture('cart');
      await page.goto(base + '/checkout');
      await expect(page.locator('[data-guest-cart-subtotal-amount]')).toHaveText('$36.00');
      await expect(page.locator('[data-guest-cart-checkout]')).toBeEnabled();
      await expect(page.locator('[data-guest-cart-delivery]')).toBeVisible();
      await expect(page.locator('[data-guest-cart-billing]')).toBeHidden();
      const email = page.locator('[data-guest-cart-email]');
      if (!before) {
        for (const selector of ['[data-guest-cart-delivery-postal-code]', '[data-guest-cart-delivery-region]']) {
          const box = await page.locator(selector).boundingBox(); expect(box.width).toBeLessThanOrEqual(224); expect(box.height).toBeGreaterThanOrEqual(44);
        }
        const manifest = await page.locator('[data-checkout-manifest]').boundingBox(), vault = await page.locator('[data-checkout-vault]').boundingBox();
        if (width === 390) expect(manifest.y + manifest.height).toBeLessThanOrEqual(vault.y);
        else { expect(manifest.x).toBeGreaterThan(vault.x); expect(Math.abs(manifest.y - vault.y)).toBeLessThan(1); }
      }
      await fits(); await capture('checkout');
      await page.locator('[data-guest-cart-checkout]').click();
      await expect(email).toBeFocused(); await expect(email).toHaveAttribute('aria-invalid', 'true');
      await email.fill('camper@example.invalid'); await expect(email).not.toHaveAttribute('aria-invalid', 'true');
      await page.locator('[data-guest-cart-billing-same]').uncheck();
      await expect(page.locator('[data-guest-cart-billing]')).toBeVisible();
      await page.locator('[data-guest-cart-billing-same]').check();
      await expect(page.locator('[data-guest-cart-billing]')).toBeHidden();
      await fits();
      mode = 'paid';
      await page.evaluate(({ capability }) => localStorage.setItem('dinkus.guest-checkout.v1', JSON.stringify({ ...capability, attemptId: 'layout-attempt' })), { capability });
      await page.goto(base + '/checkout/success');
      await expect(page.locator('[data-guest-checkout-order]')).toBeVisible();
      await expect(page.locator('[data-guest-checkout-order-number]')).toHaveText('Order #4242');
      await expect(page.locator('[data-guest-checkout-order-totals]')).toContainText('$41.00');
      await fits(); await capture('receipt');
      const readsBeforePrint = statusReads;
      const savedBeforePrint = await page.evaluate(() => JSON.stringify({ ...localStorage }));
      await page.evaluate(() => { window.printCalls = 0; window.print = () => { window.printCalls++; }; });
      await page.locator('[data-guest-checkout-print]').focus(); await page.keyboard.press('Enter');
      expect(await page.evaluate(() => window.printCalls)).toBe(1);
      await page.emulateMedia({ media: 'print' });
      const pdf = await page.pdf({ format: 'A4', displayHeaderFooter: false });
      const text = execFileSync('pdftotext', ['-layout', '-', '-'], { input: pdf, encoding: 'utf8' });
      for (const word of ['Backroad Bum', 'Order #4242', '$41.00', 'Receipt copy.']) expect(text.replace(/\s/g, '')).toContain(word.replace(/\s/g, ''));
      expect(text).not.toMatch(/layout-proof\.synthetic|Continue shopping|Print or save receipt/);
      expect(text.split('\f').filter(part => part.trim())).toHaveLength(1);
      expect(await page.locator('[data-store-header]').isVisible()).toBe(false);
      expect(statusReads).toBe(readsBeforePrint);
      expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).toBe(savedBeforePrint);
      await page.emulateMedia({ media: 'screen' });
      mode = 'pending'; await page.goto(base + '/checkout/success');
      await expect(page.locator('[data-guest-checkout-pending-review]')).toBeVisible();
      await expect(page.locator('[data-guest-checkout-pending-amount]')).toHaveText('$41.00');
      await expect(page.locator('[data-guest-checkout-order]')).toBeHidden(); await expect(page.locator('[data-guest-checkout-print]')).toBeHidden();
      await fits(); await capture('pending');
      for (const [name, path] of [['field-notes','/field-notes'], ['story','/field-note-after-a-road-day'], ['guide','/test-store'], ['shipping','/shipping'], ['returns','/returns']]) {
        await page.goto(base + path); await fits(); await capture(name);
      }
      expect(unexpected).toEqual([]); expect(errors).toEqual([]);
      results.push({ width, colorScheme, syntheticCheckoutTransport: true, realMugCatalog: true, clientValidation: true,
        conditionalBilling: true, responsiveReview: !before, proportionalAddressFields: !before, pendingNotReceipt: true,
        keyboardPrint: true, onePagePdf: true, printPreservesStorageAndReads: true, noOverflow: true, preparesIntercepted: prepares, statusReadsIntercepted: statusReads, serverWrites: 0, starts: 0, errors: 0 });
    } finally { await context.close(); }
    if (!before) {
      const plain = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme,
        javaScriptEnabled: false, userAgent: 'BackroadBum-SelfCheck/1.0' });
      try {
        const page = await plain.newPage();
        await plain.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
        await page.goto(base + '/cart');
        await expect(page.locator('.guest-cart noscript p')).toContainText('Your cart needs JavaScript');
        await expect(page.locator('[data-guest-cart-summary]')).toBeHidden();
        await page.goto(base + '/checkout');
        await expect(page.locator('[data-checkout-no-script]')).toBeVisible();
        await expect(page.locator('.guest-checkout-grid')).toBeHidden();
        await page.goto(base + '/checkout/success');
        await expect(page.locator('[data-guest-checkout-return-status]')).toContainText('This page has not checked');
        await expect(page.locator('[data-guest-checkout-print]')).toBeHidden();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        results.push({ width, colorScheme, javaScript: false, honestCartAndCheckoutFallbacks: true, noUnconfirmedReceipt: true, noOverflow: true });
      } finally { await plain.close(); }
    }
  }
} finally { await browser.close(); }
const report = { checkedAt: new Date().toISOString(), scope: 'Actual storefront/catalog with intercepted synthetic prepare/status. Not a provider journey or original retained receipt.', before, results };
await writeFile(`${output}/verification-${before ? 'before' : 'after'}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
