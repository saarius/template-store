// Shopper regression for the native-admin bandana adoption. No starts or merchant writes.
// Normal unused guest-capability preparation/status is allowed; payment routes are blocked.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.BACKROADBUM_VERIFY_URL ?? 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/bandana/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    const errors = [], checkoutRequests = [], blockedWrites = [];
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() === 'GET' || request.method() === 'HEAD') return route.continue();
      const capabilityRead = request.method() === 'POST' && url.origin === new URL(base).origin &&
        (url.pathname === '/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/prepare' || url.pathname === '/api/checkout/status');
      if (capabilityRead) { checkoutRequests.push(url.pathname); return route.continue(); }
      blockedWrites.push(url.pathname);
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await page.goto(base + '/shop')).status()).toBe(200);
    await expect(page.locator('[data-commerce-product][data-product-link]')).toHaveCount(7);
    const card = page.locator('[data-product-link][href="/products/switchback-bandana"]');
    await expect(card).toContainText('Switchback Bandana');
    const id = await card.getAttribute('data-commerce-product');
    expect(id).toBeTruthy();
    // Native merchant pricing can change without a theme deployment. Compare
    // every surface to the current Commerce fact, not the original seed price.
    const response = await context.request.get(base + '/api/guest-cart/snapshot?ids=' + encodeURIComponent(id));
    expect(response.ok()).toBe(true);
    const product = (await response.json()).products[0];
    expect(product.found && product.availability.sellable).toBe(true);
    expect(product.price.unitMinor).toMatch(/^\d+$/u);
    const minor = BigInt(product.price.unitMinor);
    const decimal = amount => `${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`;
    const price = '$' + decimal(minor), subtotal = '$' + decimal(minor * 2n);
    await expect(card.locator('.price')).toHaveText(price);
    await card.click();
    await expect(page).toHaveURL(base + '/products/switchback-bandana');
    await expect(page.locator('h1')).toHaveText('Switchback Bandana');
    await expect(page.locator('[data-product-summary]')).toContainText('One small square for the whole slow day.');
    await expect(page.locator('[data-product-price]')).toHaveText(price);
    await expect(page.locator('[data-product-status]')).toHaveText('In stock');
    await expect(page.locator('[data-product-sku]')).toHaveText('SKU BRB-BANDANA');
    await expect(page.locator('[data-product-details]')).toContainText('22 × 22 in cotton bandana');
    await expect(page.locator('[data-product-details]')).toContainText('decorative, not a map');
    const image = page.locator('.product-detail__visual img').first();
    await expect(image).toHaveAttribute('alt', 'Switchback Bandana — blue contour-pattern illustrated design');
    await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
    const metadata = JSON.parse(await page.locator('[data-product-jsonld]').textContent());
    expect(metadata).toMatchObject({ sku: 'BRB-BANDANA', url: base + '/products/switchback-bandana',
      offers: { price: decimal(minor), priceCurrency: 'USD', availability: 'https://schema.org/InStock' } });
    expect(await page.locator('[data-commerce-item]').getAttribute('data-commerce-item')).toBeTruthy();
    await page.locator('img').evaluateAll(async images => {
      for (const image of images) image.loading = 'eager';
      await Promise.all(images.map(image => image.decode()));
    });
    await page.evaluate(() => document.fonts.ready); await fits();
    await page.screenshot({ path: new URL(`product-${width}.png`, output).pathname, fullPage: true });
    await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
    await expect(page.locator('[data-add-to-cart-view]')).toBeVisible();
    await page.locator('[data-add-to-cart-view]').click();
    await expect(page).toHaveURL(base + '/cart');
    const line = page.locator('[data-guest-cart-line]');
    await expect(line).toHaveCount(1);
    await expect(line.getByRole('heading')).toHaveText('Switchback Bandana');
    await line.locator('[data-guest-cart-qty]').fill('2');
    await expect(page.locator('[data-guest-cart-subtotal-amount]')).toHaveText(subtotal);
    await page.reload();
    await expect(line.locator('[data-guest-cart-qty]')).toHaveValue('2');
    await expect(page.locator('[data-guest-cart-subtotal-amount]')).toHaveText(subtotal);
    await fits();
    await line.locator('[data-guest-cart-remove]').click();
    await expect(line).toHaveCount(0);
    for (const slug of ['road-day', 'slow-camp']) {
      expect((await page.goto(base + '/categories/' + slug)).status()).toBe(200);
      await expect(page.locator('[data-commerce-product]')).toHaveCount(4);
      const collectionCard = page.locator('[data-product-link][href="/products/switchback-bandana"]');
      await expect(collectionCard).toHaveCount(1);
      await expect(collectionCard.locator('.price')).toHaveText(price);
      await fits();
    }
    await page.goto(base + '/search?q=bandana');
    await expect(page.getByRole('link', { name: 'Switchback Bandana', exact: true })).toHaveCount(1);
    await fits();
    expect(errors).toEqual([]); expect(blockedWrites).toEqual([]);
    results.push({ width, shopFamilies: 6, collectionCounts: [4, 4], cmsCopyAndMedia: true, publicPriceAndMetadata: decimal(minor),
      cartQuantity: 2, refreshedSubtotal: decimal(minor * 2n), removalAndSearch: true, noOverflow: true, browserErrors: 0,
      capabilityRequests: checkoutRequests, checkoutStarts: 0, blockedWrites: 0 });
    await context.close();
  }
} finally { await browser.close(); }
const evidence = { checkedAt: new Date().toISOString(), base, scope: 'Native-admin product adoption through public browsing and browser-local cart only.', results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
