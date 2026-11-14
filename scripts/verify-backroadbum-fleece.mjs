// Verify native-published fleece options/content through the actual signed catalog.
// Fresh anonymous browsers only; no checkout, merchant writes or saved user state.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
if (!process.argv.includes('--check')) {
  console.log('No action. --check verifies published fleece sizes, fit copy and browser-only carts. --capture saves local screenshots. No checkout starts.');
  process.exit(0);
}
const source = JSON.parse(readFileSync(new URL('../seed/backroadbum-fleece-fit.json', import.meta.url)));
const base = process.env.BACKROADBUM_VERIFY_BASE ?? 'https://backroadbum.com';
const path = '/products/' + source.slug;
const capture = process.argv.includes('--capture');
const output = new URL('../runs/backroadbum/fleece/', import.meta.url);
if (capture) mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const [width, colorScheme, javaScriptEnabled] of [[1440, 'light', true], [390, 'dark', true], [1440, 'dark', false], [390, 'light', false]]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme, javaScriptEnabled,
      serviceWorkers: 'block', reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    try {
      let blocked = 0;
      const refused = [];
      await context.route('**/*', route => {
        if (['GET', 'HEAD'].includes(route.request().method()) && new URL(route.request().url()).origin === new URL(base).origin) return route.continue();
        refused.push({ method: route.request().method(), path: new URL(route.request().url()).origin === new URL(base).origin ? new URL(route.request().url()).pathname : 'external-resource' });
        blocked++; return route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', () => errors.push('pageerror'));
      expect((await page.goto(base + path)).status()).toBe(200);
      await expect(page.locator('h1')).toHaveText('Last Light Fleece');
      await expect(page.locator('[data-product-summary]')).toHaveText(source.summary);
      const details = page.locator('#product-details');
      await expect(details.locator('summary')).toHaveText(source.heading);
      for (const paragraph of source.paragraphs) await expect(details).toContainText(paragraph);
      const specs = details.getByRole('region', { name: source.tableHeading, exact: true });
      await expect(specs.locator('dt')).toHaveText(source.rows.map(row => row.label));
      await expect(specs.locator('dd')).toHaveText(source.rows.map(row => row.value));
      const members = JSON.parse(await page.locator('[data-variant-members]').textContent());
      expect(members).toHaveLength(3);
      expect(new Set(members.map(member => member.id)).size).toBe(3);
      const productId = await page.locator('[data-commerce-item]').getAttribute('data-commerce-item');
      const response = await context.request.get(base + '/_emdash/api/plugins/r_gshdrqaldna3r7sn/catalog/public/item?itemId=' + encodeURIComponent(productId));
      expect(response.ok()).toBe(true);
      const wire = await response.json();
      expect(wire.success).toBe(true);
      const projected = wire.data.variants.members;
      const member = label => members.find(item => item.values.Size === label);
      const usd = minor => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(minor) / 100);
      const amounts = {};
      for (const variant of source.variants) {
        const item = member(variant.label);
        expect(item).toBeTruthy();
        const raw = projected.find(value => value.catalogItemId === item.id);
        expect(raw.price).toEqual({ currency: 'USD', minor: variant.regularMinor });
        expect(raw.availability.sellable).toBe(true);
        expect(raw.availability.status).toBe(variant.stockStatus === 'on-backorder' ? 'available-on-backorder' : variant.stockStatus);
        amounts[variant.label] = BigInt(raw.price.minor);
        if (javaScriptEnabled) {
          await page.getByRole('radio', { name: variant.label, exact: true }).check();
          await expect(page.locator('[data-add-to-cart]')).toHaveAttribute('data-add-to-cart', item.id);
          await expect(page.locator('[data-add-to-cart]')).toBeEnabled();
        } else {
          await page.getByLabel('View a product option', { exact: true }).selectOption(item.id);
          await page.getByRole('button', { name: 'View option', exact: true }).click();
          await expect(page.getByLabel('View a product option', { exact: true })).toHaveValue(item.id);
          await expect(page.locator(`[data-variant-choice][value="${variant.label}"]`)).toBeChecked();
          await expect(page.locator('[data-add-to-cart]')).not.toBeVisible();
        }
        await expect(page.locator('[data-product-price]')).toHaveText(usd(raw.price.minor));
        await expect(page.locator('[data-product-status]')).toHaveText(variant.stockStatus === 'on-backorder' ? 'Available on backorder' : 'In stock');
        const metadata = JSON.parse(await page.locator('[data-product-jsonld]').textContent());
        if (raw.sku) expect(metadata.sku).toBe(raw.sku);
        else { expect(metadata.sku).toBeUndefined(); expect(metadata.offers).toBeUndefined(); }
      }
      // A native keyboard disclosure remains usable and does not lose XL.
      const disclosure = details.locator('summary');
      await disclosure.focus(); await page.keyboard.press('Enter');
      await expect(details.locator('details')).not.toHaveAttribute('open');
      await page.keyboard.press('Enter');
      await expect(details.locator('details')).toHaveAttribute('open', '');
      await expect(page.locator('[data-variant-choice][value="XL"]')).toBeChecked();
      if (capture) await page.screenshot({ path: new URL(`product-${width}-${colorScheme}.png`, output).pathname, fullPage: true });
      if (javaScriptEnabled) {
        // Buyable backorder is not sold out. This only saves untrusted browser intent.
        await page.locator('[data-add-to-cart-qty]').fill('2');
        await page.locator('[data-add-to-cart]').click();
        await page.getByRole('radio', { name: 'M', exact: true }).check();
        await page.locator('[data-add-to-cart-qty]').fill('1');
        await page.locator('[data-add-to-cart]').click();
        await page.goto(base + '/cart');
        await expect(page.locator('[data-guest-cart-line]')).toHaveCount(2);
        const row = label => page.locator(`[data-guest-cart-line="${member(label).id}"]`);
        await expect(row('M').getByRole('heading')).toHaveText('Last Light Fleece — M');
        await expect(row('XL').getByRole('heading')).toHaveText('Last Light Fleece — XL');
        await expect(row('XL').locator('[data-guest-cart-qty]')).toHaveValue('2');
        const total = usd((amounts.M + 2n * amounts.XL).toString());
        await expect(page.locator('[data-guest-cart-subtotal-amount]')).toHaveText(total);
        await page.reload();
        await expect(row('XL').locator('[data-guest-cart-qty]')).toHaveValue('2');
        await expect(page.locator('[data-guest-cart-subtotal-amount]')).toHaveText(total);
        await row('XL').locator('[data-guest-cart-remove]').click();
        await expect(page.locator('[data-guest-cart-line]')).toHaveCount(1);
        await expect(row('M')).toBeVisible();
        await expect(page.locator('[data-guest-cart-subtotal-amount]')).toHaveText(usd(amounts.M.toString()));
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      // The legacy cart bootstraps contact requirements via prepare. Refuse it
      // on the initial cart read and reload: this proof must mint no capability.
      assert.deepEqual(refused, Array.from({ length: javaScriptEnabled ? 2 : 0 }, () => ({
        method: 'POST', path: '/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/prepare',
      })));
      assert.deepEqual(errors, []);
      results.push({ width, colorScheme, javaScriptEnabled, nativeContentExact: true, threeDistinctOptions: true,
        selectedFactsMatchSignedCommerce: true, backorderBuyable: javaScriptEnabled ? true : 'inspection only; no-script cart remains unavailable',
        keyboardCare: true, separateCartLinesAndRemoval: javaScriptEnabled, cartReloadPreserved: javaScriptEnabled,
        noNonGetAdmitted: true, checkoutPreparationAttemptsRefused: blocked, checkoutStarts: 0, pageErrors: 0, noOverflow: true });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), source: 'Native-published content and actual signed Commerce, no response substitution', results }, null, 2));
