// Repeatable shopper proof for the merchant's sized tee. No checkout or merchant writes.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.BACKROADBUM_VERIFY_URL ?? 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/variants/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    const page = await context.newPage();
    const errors = [], checkout = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\/api\/checkout\//.test(request.url())) checkout.push(new URL(request.url()).pathname); });
    const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await page.goto(base + '/shop')).status()).toBe(200);
    await expect(page.locator('[data-commerce-product][data-product-link]')).toHaveCount(6);
    const tee = page.locator('[data-product-link][href="/products/wrong-turn-tee"]');
    await expect(tee).toHaveCount(1);
    await expect(tee.locator('[data-commerce-availability]')).toHaveText('Check options');
    await expect(tee.locator('[data-commerce-availability]')).toHaveAttribute('data-commerce-availability', 'options');
    await expect(page.locator('[href="/products/creekside-camp-mug"] [data-commerce-availability]')).toHaveText('In stock');
    await page.screenshot({ path: new URL(`shop-options-${width}.png`, output).pathname, fullPage: true });
    await tee.focus(); await page.keyboard.press('Enter');
    await expect(page).toHaveURL(base + '/products/wrong-turn-tee');
    await expect(page.locator('[data-product-summary]')).toContainText('choose your size below');
    await expect(page.locator('[data-product-variants] legend')).toHaveText(['Size']);
    const members = JSON.parse(await page.locator('[data-variant-members]').textContent());
    const member = size => members.find(item => item.values.Size === size);
    expect(members).toHaveLength(3);
    expect(new Set(members.map(item => item.id)).size).toBe(3);
    for (const size of ['M', 'L', 'XL']) expect(member(size)).toBeTruthy();
    const publicItem = await page.request.get(base + '/_emdash/api/plugins/r_gshdrqaldna3r7sn/catalog/public/item?itemId=' + encodeURIComponent(await page.locator('[data-commerce-item]').getAttribute('data-commerce-item')));
    expect(publicItem.ok()).toBe(true);
    const projected = (await publicItem.json()).data.variants.members;
    const metadataAtSelection = async size => {
      const raw = projected.find(value => value.catalogItemId === member(size).id);
      expect(raw).toBeTruthy();
      const metadata = JSON.parse(await page.locator('[data-product-jsonld]').textContent());
      expect(metadata).toMatchObject({ '@type': 'Product', url: base + '/products/wrong-turn-tee' });
      if (raw.sku) {
        expect(metadata.sku).toBe(raw.sku);
        expect(metadata.offers).toMatchObject({ price: '34.00', availability: 'https://schema.org/' + (size === 'XL' ? 'OutOfStock' : 'InStock') });
      } else {
        expect(metadata).not.toHaveProperty('sku');
        expect(metadata).not.toHaveProperty('offers');
      }
    };
    const add = page.locator('[data-add-to-cart]');
    await expect(page.getByRole('radio', { name: 'M', exact: true })).toBeChecked();
    await expect(add).toHaveAttribute('data-add-to-cart', member('M').id);
    await metadataAtSelection('M');
    await add.click();
    await expect(page.locator('[data-add-to-cart-view]')).toBeVisible();
    await page.getByRole('radio', { name: 'L', exact: true }).check();
    await expect(page.locator('[data-add-to-cart-view]')).toBeHidden();
    await expect(add).toHaveAttribute('data-add-to-cart', member('L').id);
    await expect(page.locator('[data-variant-price]')).toHaveText(member('L').price);
    await metadataAtSelection('L');
    await page.locator('[data-add-to-cart-qty]').fill('2'); await add.click();
    await expect(page.locator('[data-add-to-cart-status]')).toHaveText('Added to cart.');
    await page.getByRole('radio', { name: 'XL (sold out)', exact: true }).check();
    await expect(add).toBeDisabled();
    await expect(add).toHaveText('Sold out');
    await metadataAtSelection('XL');
    await expect(page.locator('[data-product-status]')).toHaveText('Out of stock');
    await expect(page.locator('[data-add-to-cart-view]')).toBeHidden();
    await page.evaluate(() => document.fonts.ready); await fits();
    await page.screenshot({ path: new URL(`sold-out-${width}.png`, output).pathname, fullPage: true });
    // Refresh the already-saved M/L choices through the real Commerce snapshot endpoint.
    await page.goto(base + '/cart');
    const lines = page.locator('[data-guest-cart-line]');
    await expect(lines).toHaveCount(2);
    const m = page.locator(`[data-guest-cart-line="${member('M').id}"]`);
    const l = page.locator(`[data-guest-cart-line="${member('L').id}"]`);
    await expect(m.getByRole('heading')).toHaveText('Wrong Turn Tee — M');
    await expect(l.getByRole('heading')).toHaveText('Wrong Turn Tee — L');
    await expect(m.locator('[data-guest-cart-qty]')).toHaveValue('1');
    await expect(l.locator('[data-guest-cart-qty]')).toHaveValue('2');
    await expect(page.locator('[data-guest-cart-subtotal-amount]')).toHaveText('$102.00');
    await page.reload();
    await expect(l.locator('[data-guest-cart-qty]')).toHaveValue('2');
    await expect(page.locator('[data-guest-cart-subtotal-amount]')).toHaveText('$102.00');
    await fits();
    await page.screenshot({ path: new URL(`cart-${width}.png`, output).pathname, fullPage: true });
    await l.locator('[data-guest-cart-remove]').click();
    await expect(lines).toHaveCount(1);
    await expect(m).toBeVisible();
    await expect(page.locator('[data-guest-cart-subtotal-amount]')).toHaveText('$34.00');
    await page.goto(base + '/products/creekside-camp-mug');
    const mugMetadata = JSON.parse(await page.locator('[data-product-jsonld]').textContent());
    expect(mugMetadata.sku).toBe(await page.locator('[data-product-sku]').getAttribute('data-product-sku'));
    expect(mugMetadata.offers).toMatchObject({ price: '18.00', availability: 'https://schema.org/InStock' });
    await page.goto(base + '/dashboard/');
    await expect(page.getByRole('heading', { name: 'November 10, 2026 · No borrowed identity' })).toBeVisible();
    await fits();
    await page.screenshot({ path: new URL(`metadata-dashboard-${width}.png`, output).pathname, fullPage: false });
    expect(errors).toEqual([]); expect(checkout).toEqual([]);
    results.push({ width, groupedShopFamilies: 6, distinctMemberIds: true, selectedTarget: true, savedFeedbackReset: true,
      soldOutRefused: true, independentCartQuantities: true, refreshedSubtotal: '102.00',
      removedOnlyChosenMember: true, selectedMetadataMatchesPublicProjection: true, simpleSaleMetadataPreserved: true,
      variantCardChecksOptions: true, simpleCardKeepsStock: true, keyboardCardNavigation: true,
      noOverflow: true, browserErrors: errors.length, checkoutRequests: checkout.length });
    await context.close();
    const plainContext = await browser.newContext({ viewport: { width, height: 1000 }, javaScriptEnabled: false, userAgent: 'BackroadBum-SelfCheck/1.0' });
    try {
      const plain = await plainContext.newPage();
      expect((await plain.goto(base + '/shop')).status()).toBe(200);
      const plainTee = plain.locator('[data-product-link][href="/products/wrong-turn-tee"]');
      await expect(plainTee.locator('[data-commerce-availability]')).toHaveText('Check options');
      await expect(plain.locator('[href="/products/creekside-camp-mug"] [data-commerce-availability]')).toHaveText('In stock');
      expect(await plain.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await plain.screenshot({ path: new URL(`shop-options-no-js-${width}.png`, output).pathname, fullPage: true });
      await plainTee.focus(); await plain.keyboard.press('Enter');
      await expect(plain).toHaveURL(base + '/products/wrong-turn-tee');
      results.push({ width, javaScript: false, variantCardChecksOptions: true, simpleCardKeepsStock: true, keyboardCardNavigation: true, noOverflow: true });
    } finally { await plainContext.close(); }
  }
} finally { await browser.close(); }
const evidence = { checkedAt: new Date().toISOString(), base, scope: 'Variant card guidance with JavaScript on/off, keyboard navigation, selected metadata against the signed public projection, simple-sale metadata, variant/cart behavior and dashboard. No checkout or merchant writes.', results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
