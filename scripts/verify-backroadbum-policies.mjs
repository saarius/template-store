// Read-only public policy/navigation check. No admin access or payment-start requests.
import { chromium, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const base = 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/policies/', import.meta.url);
const baselinePath = process.env.BACKROADBUM_POLICY_BASELINE;
const baseline = baselinePath ? JSON.parse(await readFile(baselinePath, 'utf8')) : null;
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const { width, javaScriptEnabled } of [
    { width: 1440, javaScriptEnabled: true },
    { width: 390, javaScriptEnabled: true },
    { width: 390, javaScriptEnabled: false },
  ]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, javaScriptEnabled, reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    const page = await context.newPage();
    const errors = [];
    const checkoutRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\/api\/checkout\//.test(request.url())) checkoutRequests.push(new URL(request.url()).pathname); });
    const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const policies = [];
    for (const kind of ['shipping', 'returns']) {
      expect((await page.goto(base + '/' + kind)).status()).toBe(200);
      await expect(page.locator('h1')).toHaveText(kind === 'shipping' ? 'Shipping' : 'Returns');
      expect((await page.locator('h1').boundingBox()).y).toBeLessThan(350);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', base + '/' + kind);
      const nav = page.getByRole('navigation', { name: 'Store policies', exact: true });
      await expect(nav.getByRole('link')).toHaveCount(2);
      await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('href', '/' + kind);
      await expect(page.locator('[data-policy-body]')).toBeVisible();
      await expect(page.locator('[data-shipping-policy-unset], [data-return-policy-unset]')).toHaveCount(0);
      const body = await page.locator('[data-policy-body]').innerText();
      const sha256 = createHash('sha256').update(body).digest('hex');
      const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
      if (baseline) {
        expect(sha256).toBe(baseline[kind].sha256);
        expect(jsonLd).toEqual(baseline[kind].jsonLd);
      }
      await expect(page.locator('[data-policy-recovery]')).toContainText('Only its latest checkout is saved');
      const receipt = page.locator('[data-policy-recovery] a');
      await expect(receipt).toHaveAttribute('href', '/checkout/success');
      expect((await receipt.boundingBox()).height).toBeGreaterThanOrEqual(48);
      await expect(page.locator('[data-policy-support-section]')).toHaveAttribute('data-section-source', 'cms');
      await expect(page.locator('[data-policy-support-section] a')).toHaveAttribute('href', '/test-store');
      // The inherited shared CMS note claimed an order shipping charge; the guide replaces that note.
      await expect(page.locator('main')).not.toContainText('shipping charge for an order');
      await fits();
      if (javaScriptEnabled) {
        await page.evaluate(() => document.fonts.ready);
        await receipt.focus();
        await expect(receipt).toBeFocused();
        expect(await receipt.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
        await page.screenshot({ path: new URL(`${kind}-${width}.png`, output).pathname, fullPage: true });
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(base + '/checkout/success');
        await expect(page.locator('h1')).toHaveText('No saved checkout in this browser');
        await page.goto(base + '/' + kind);
      }
      const other = kind === 'shipping' ? 'Returns' : 'Shipping';
      await page.getByRole('navigation', { name: 'Store policies', exact: true }).getByRole('link', { name: other, exact: true }).click();
      await expect(page).toHaveURL(base + '/' + other.toLowerCase());
      await page.locator('[data-policy-support-section] a').click();
      await expect(page).toHaveURL(base + '/test-store');
      await expect(page.locator('main')).toContainText('4242 4242 4242 4242');
      await page.goto(base + '/' + kind);
      await page.getByRole('link', { name: 'Back to shop', exact: true }).click();
      await expect(page).toHaveURL(base + '/shop');
      await expect(page.locator('[data-commerce-product]')).toHaveCount(7);
      policies.push({ kind, sha256, publishedTextAndJsonLdUnchanged: baseline ? true : null });
    }
    expect(errors).toEqual([]);
    expect(checkoutRequests).toEqual([]);
    results.push({ width, javaScriptEnabled, policies, noOverflow: true, linkedGuideAndShop: true, emptyBrowserRecovery: javaScriptEnabled ? true : null, browserErrors: 0, checkoutRequests: 0 });
    await context.close();
  }
} finally { await browser.close(); }
const evidence = { verifiedAt: new Date().toISOString(), base, results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
