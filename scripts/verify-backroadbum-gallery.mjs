// Real public gallery, keyboard and no-JavaScript proof. No admin state, server writes or checkout requests.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/gallery/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const options = { userAgent: 'BackroadBum-SelfCheck/1.0', reducedMotion: 'reduce' };
const productPath = '/products/switchback-bandana';
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ ...options, viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = [], writes = [], checkoutRequests = [];
    page.on('pageerror', error => errors.push(error.name));
    page.on('request', request => { if (/checkout\/|guest-cart\/snapshot/.test(request.url())) checkoutRequests.push(new URL(request.url()).pathname); });
    await context.route('**/*', route => {
      const request = route.request();
      if (['GET', 'HEAD'].includes(request.method())) return route.continue();
      writes.push(new URL(request.url()).pathname); return route.abort();
    });
    expect((await page.goto(base + productPath)).status()).toBe(200);
    const gallery = page.locator('[data-product-gallery]'), main = gallery.locator('img[data-commerce-image]');
    const controls = gallery.locator('[data-gallery-controls]'), thumbs = gallery.locator('[data-gallery-thumb]');
    await expect(controls).toBeVisible(); await expect(thumbs).toHaveCount(2);
    await expect(gallery.locator('[data-gallery-open]')).toHaveCount(0);
    await expect.poll(() => main.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    const originalSrc = await main.getAttribute('src'), originalAlt = await main.getAttribute('alt');
    expect(originalAlt).toBe('Switchback Bandana — blue contour-pattern illustrated design');
    const price = await page.locator('[data-product-price]').textContent();
    const metadata = await page.locator('[data-product-jsonld]').textContent();
    const id = await page.locator('[data-commerce-item]').getAttribute('data-commerce-item');
    const cart = JSON.stringify({ version: 1, lines: [{ id, quantity: 2 }] });
    await page.evaluate(raw => localStorage.setItem('dinkus.guest-cart.v1', raw), cart);
    for (const thumb of await thumbs.all()) {
      const box = await thumb.boundingBox(); expect(box.width).toBeGreaterThanOrEqual(48); expect(box.height).toBeGreaterThanOrEqual(48);
    }
    await thumbs.first().focus(); await page.keyboard.press('Tab'); await expect(thumbs.nth(1)).toBeFocused();
    await page.keyboard.press('Space'); await expect(thumbs.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(thumbs.first()).toHaveAttribute('aria-pressed', 'false'); await expect(thumbs.nth(1)).toBeFocused();
    await expect(main).not.toHaveAttribute('src', originalSrc);
    await expect(main).toHaveAttribute('alt', 'Switchback Bandana — illustrated detail of cream contours and the yellow BRB corner');
    await expect.poll(() => main.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    expect(await main.evaluate(image => new URL(image.currentSrc).origin)).toBe(new URL(base).origin);
    expect(await main.evaluate(image => image.naturalWidth)).toBeGreaterThanOrEqual(300);
    await expect(main).toHaveAttribute('width', '1200'); await expect(main).toHaveAttribute('height', '900');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await gallery.scrollIntoViewIfNeeded();
    await page.screenshot({ path: new URL(`after-js-${width}.png`, output).pathname });
    await page.keyboard.press('Shift+Tab'); await expect(thumbs.first()).toBeFocused(); await page.keyboard.press('Enter');
    await expect(main).toHaveAttribute('src', originalSrc); await expect(main).toHaveAttribute('alt', originalAlt);
    await expect(thumbs.first()).toHaveAttribute('aria-pressed', 'true'); await expect(thumbs.nth(1)).toHaveAttribute('aria-pressed', 'false');
    expect(await page.locator('[data-product-price]').textContent()).toBe(price);
    expect(await page.locator('[data-product-jsonld]').textContent()).toBe(metadata);
    expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'))).toBe(cart);
    expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-checkout.v1'))).toBeNull();
    // A single-picture product must not acquire a fake gallery, fallback links or unusable controls.
    await page.goto(base + '/products/creekside-camp-mug');
    await expect(page.locator('[data-gallery-controls], [data-gallery-open]')).toHaveCount(0);
    expect(errors).toEqual([]); expect(writes).toEqual([]); expect(checkoutRequests).toEqual([]);
    results.push({ width, javaScript: true, pictures: 2, keyboardSpaceAndEnter: true, focusPreserved: true, altAndImageChange: true,
      originalRestored: true, sameOriginResponsiveImage: true, priceAndMetadataUnchanged: true, cartUnchanged: true,
      singleImageNoControls: true, fits: true, networkWrites: 0, checkoutRequests: 0, browserErrors: 0 });
    await context.close();
  }
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ ...options, javaScriptEnabled: false, viewport: { width, height: 1000 } });
    const page = await context.newPage();
    expect((await page.goto(base + productPath)).status()).toBe(200);
    const gallery = page.locator('[data-product-gallery]');
    await expect(gallery.locator('[data-gallery-controls]')).toBeHidden();
    const links = gallery.locator('[data-gallery-open]'); await expect(links).toHaveCount(2);
    const detail = links.nth(1); await expect(detail).toHaveAccessibleName(/Open picture 2 of 2:.*illustrated detail/);
    expect((await detail.boundingBox()).height).toBeGreaterThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await gallery.scrollIntoViewIfNeeded(); await page.screenshot({ path: new URL(`after-nojs-${width}.png`, output).pathname });
    const currentPrice = await page.locator('[data-product-price]').textContent();
    const href = await detail.getAttribute('href');
    expect(new URL(href, base).origin).toBe(new URL(base).origin);
    const imageResponse = page.waitForResponse(response => response.url() === new URL(href, base).href && response.request().isNavigationRequest());
    await detail.focus(); await page.keyboard.press('Enter');
    const response = await imageResponse; expect(response.status()).toBe(200); expect(response.headers()['content-type']).toMatch(/^image\/png/);
    await page.goBack(); await expect(page).toHaveURL(base + productPath); await expect(page.locator('h1')).toHaveText('Switchback Bandana');
    expect(await page.locator('[data-product-price]').textContent()).toBe(currentPrice);
    results.push({ width, javaScript: false, inertControlsHidden: true, publicImageLinks: 2, keyboardDetailImage: true, imageHttp: 200, browserBackWorks: true, fits: true });
    await context.close();
  }
} finally { await browser.close(); }
const evidence = { verifiedAt: new Date().toISOString(), base, results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
