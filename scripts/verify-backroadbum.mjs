// Repeatable public smoke test. No admin sessions, orders or real personal data.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const [name, width] of [['desktop', 1440], ['mobile', 390]]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 500) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    await page.goto(base);
    await expect(page.locator('h1')).toHaveText('Take the long way back.');
    await expect(page.locator('[data-commerce-product]')).toHaveCount(5);
    await expect.poll(() => page.locator('[data-commerce-product] img').evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
    await page.locator('img').evaluateAll(async imgs => {
      for (const img of imgs) img.loading = 'eager';
      await Promise.all(imgs.map(img => img.decode()));
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: new URL(`${name}.png`, output).pathname, fullPage: true });
    await page.goto(base + '/products/long-way-cap');
    await expect(page.locator('[data-product-price]')).toContainText('$24.00');
    await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
    await expect(page.locator('[data-add-to-cart-status]')).toHaveText('Added to cart.');
    await page.goto(base + '/cart');
    await expect(page.locator('[data-guest-cart-subtotal]')).toHaveText('Subtotal $24.00');
    const qty = page.locator('[data-guest-cart-qty]');
    await qty.fill('3'); await qty.press('Tab');
    await expect(page.locator('[data-guest-cart-subtotal]')).toHaveText('Subtotal $72.00');
    await page.reload();
    await expect(qty).toHaveValue('3');
    await expect(page.locator('[data-guest-cart-checkout]')).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: new URL(`cart-${name}.png`, output).pathname, fullPage: true });
    await page.locator('[data-guest-cart-remove]').click();
    await expect(page.locator('[data-guest-cart-line]')).toHaveCount(0);
    await page.goto(base + '/field-notes');
    await expect(page.locator('.brb-story-link')).toHaveCount(2);
    await page.goto(base + '/test-store');
    await expect(page.locator('main')).toContainText('4242 4242 4242 4242');
    await expect(page.locator('main')).toContainText('Try a test purchase');
    await page.goto(base + '/dashboard/');
    await expect(page.locator('main')).toContainText('A store, built in the open.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    for (const path of ['/_emdash/admin', '/_emdash/api/setup/dev-bypass', '/_emdash/api/auth/dev-bypass']) {
      expect((await page.request.get(base + path)).status()).toBe(401);
    }
    const checkout = await page.request.get(base + '/api/checkout/health');
    expect(checkout.status()).toBe(200);
    expect(await checkout.json()).toMatchObject({ admission: 'open', readiness: 'supported', mode: 'test' });
    results.push({ viewport: name, width, productCount: 5, cartPersistence: true, quantitySubtotal: '72.00', checkoutReadyAdvisory: true, adminProtected: true, imagesLoaded: true, browserErrors: 0 });
    await context.close();
  }
} finally { await browser.close(); }
const evidence = { verifiedAt: new Date().toISOString(), base, results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
