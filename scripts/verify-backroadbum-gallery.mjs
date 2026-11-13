// Read-only public gallery proof. No staff session, CMS/catalog writes or checkout starts.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/gallery/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1280, 412]) for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({ javaScriptEnabled, hasTouch: width === 412, viewport: { width, height: 1000 }, userAgent: 'BackroadBum-SelfCheck/1.0', reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      const writes = [], errors = [], checkoutRequests = [];
      page.on('pageerror', error => errors.push(error.name));
      page.on('request', request => { if (/checkout\/|guest-cart\/snapshot/.test(request.url())) checkoutRequests.push(new URL(request.url()).pathname); });
      await context.route('**/*', route => {
        if (['GET', 'HEAD'].includes(route.request().method())) return route.continue();
        writes.push(route.request().method()); return route.abort();
      });
      expect((await page.goto(base + '/products/switchback-bandana')).status()).toBe(200);
      const gallery = page.getByRole('region', { name: 'Product pictures', exact: true });
      const images = gallery.locator('img');
      await expect(images).toHaveCount(2);
      await expect(gallery.locator('button, noscript, [hidden]')).toHaveCount(0);
      await expect(images.first()).toHaveAttribute('loading', 'eager');
      await expect(images.first()).toHaveAttribute('fetchpriority', 'high');
      await expect(images.last()).toHaveAttribute('loading', 'lazy');
      await expect(images.first()).toHaveAttribute('alt', 'Switchback Bandana — blue contour-pattern illustrated design');
      await expect(images.last()).toHaveAttribute('alt', 'Switchback Bandana — illustrated detail of cream contours and the yellow BRB corner');
      const initialSrc = await images.first().getAttribute('src');
      const metadata = await page.locator('[data-product-jsonld]').textContent();
      const price = await page.locator('[data-product-price]').textContent();
      const id = await page.locator('[data-commerce-item]').getAttribute('data-commerce-item');
      const cart = JSON.stringify({ version: 1, lines: [{ id, quantity: 2 }] });
      await page.evaluate(raw => localStorage.setItem('dinkus.guest-cart.v1', raw), cart);
      await page.evaluate(() => document.fonts.ready);
      await expect.poll(() => images.first().evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      await gallery.screenshot({ path: new URL(`server-${width}-js-${javaScriptEnabled ? 'on' : 'off'}.png`, output).pathname });
      const geometry = await gallery.evaluate(node => ({ client: node.clientWidth, scroll: node.scrollWidth, snap: getComputedStyle(node).scrollSnapType, lead: node.firstElementChild.getBoundingClientRect().width }));
      if (width === 412) {
        expect(geometry.snap).toBe('x mandatory');
        expect(geometry.scroll).toBeGreaterThan(geometry.client);
        expect(geometry.lead).toBeLessThan(geometry.client);
        await gallery.focus(); await expect(gallery).toBeFocused();
        const session = await context.newCDPSession(page);
        try {
          const box = await gallery.boundingBox(), y = box.y + Math.min(100, box.height / 2);
          await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * .8, y }] });
          for (let step = 1; step <= 10; step++) {
            await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * (.8 - step * .06), y }] });
            await page.waitForTimeout(16);
          }
          await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await expect.poll(() => gallery.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
        } finally { await session.detach(); }
      } else expect(geometry.scroll).toBe(geometry.client);
      for (const image of await images.all()) {
        await image.evaluate(node => node.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'end' }));
        await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
        expect(await image.evaluate(node => new URL(node.currentSrc).origin)).toBe(new URL(base).origin);
        // Both authored illustrations are 4:3. The installed primary renders at 640x480,
        // the detail at 1200x900; responsive candidates are capped by source width.
        const dimensions = await image.evaluate(node => ({ width: Number(node.getAttribute('width')), height: Number(node.getAttribute('height')) }));
        expect(dimensions.width).toBeGreaterThan(0); expect(dimensions.height).toBeGreaterThan(0);
        expect(dimensions.width / dimensions.height).toBeCloseTo(4 / 3);
        await expect(image).toHaveAttribute('srcset', /300w.*600w/);
        if (dimensions.width >= 1200) await expect(image).toHaveAttribute('srcset', /1200w/);
        else await expect(image).not.toHaveAttribute('srcset', /1200w/);
      }
      await expect(images.first()).toHaveAttribute('src', initialSrc);
      expect(await page.locator('[data-product-price]').textContent()).toBe(price);
      expect(await page.locator('[data-product-jsonld]').textContent()).toBe(metadata);
      expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'))).toBe(cart);
      expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-checkout.v1'))).toBeNull();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.goto(base + '/products/creekside-camp-mug');
      await expect(page.locator('[data-product-gallery] img')).toHaveCount(1);
      await expect(page.locator('[data-gallery-extras], .product-gallery--multiple')).toHaveCount(0);
      expect(writes).toEqual([]); expect(errors).toEqual([]); expect(checkoutRequests).toEqual([]);
      results.push({ width, javaScriptEnabled, pictures: 2, geometry, sameOriginResponsiveImages: true, unchangedLeadPriceMetadataCart: true, metadataSha256: createHash('sha256').update(metadata).digest('hex'), singleImageNoStrip: true, syntheticChromiumTouch: width === 412, keyboardFocus: width === 412, arrowScrollingQualified: false, writes: 0, checkoutRequests: 0, errors: 0 });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
const evidence = { verifiedAt: new Date().toISOString(), base, results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
