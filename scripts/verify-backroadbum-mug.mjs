// Merchant regression: published CMS details + Commerce media/facts, never a checkout start.
import { readFile, mkdir, writeFile } from 'node:fs/promises';

export async function verifyMug() {
  const { chromium, expect } = await import('@playwright/test');
  const source = JSON.parse(await readFile(new URL('../seed/backroadbum-mug-details.json', import.meta.url), 'utf8'));
  const base = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
  const output = new URL('../runs/backroadbum/mug-details/', import.meta.url);
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [1440, 390]) for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ javaScriptEnabled, viewport: { width, height: 1000 },
        userAgent: 'BackroadBum-SelfCheck/1.0', reducedMotion: 'reduce' });
      try {
        const page = await context.newPage();
        const writes = [], errors = [];
        await context.route('**/*', route => {
          if (['GET', 'HEAD'].includes(route.request().method())) return route.continue();
          writes.push(new URL(route.request().url()).pathname); return route.abort();
        });
        page.on('pageerror', error => errors.push(error.name));
        expect((await page.goto(base + '/products/' + source.slug)).status()).toBe(200);
        await expect(page.locator('h1')).toHaveText(source.title);
        const id = await page.locator('[data-commerce-item]').getAttribute('data-commerce-item');
        expect(id).toBeTruthy();
        const snapshot = await context.request.get(base + '/api/guest-cart/snapshot?ids=' + encodeURIComponent(id));
        expect(snapshot.ok()).toBe(true);
        const fact = (await snapshot.json()).products[0];
        expect(fact.found).toBe(true);
        const decimal = `${BigInt(fact.price.unitMinor) / 100n}.${String(BigInt(fact.price.unitMinor) % 100n).padStart(2, '0')}`;
        await expect(page.locator('[data-product-price]')).toHaveText('$' + decimal);
        const metadata = JSON.parse(await page.locator('[data-product-jsonld]').textContent());
        expect(metadata.offers.price).toBe(decimal);
        const details = page.locator('[data-product-details]');
        const specs = details.getByRole('region', { name: source.tableHeading, exact: true });
        await expect(specs).toBeVisible();
        expect(await specs.locator('dt').allTextContents()).toEqual(source.rows.map(row => row.label));
        expect(await specs.locator('dd').allTextContents()).toEqual(source.rows.map(row => row.value));
        const care = details.locator('details');
        await expect(care).toHaveAttribute('open', '');
        await expect(care.locator('summary')).toHaveText(source.careHeading);
        await expect(care.locator('.product-section__body')).toHaveText(source.care);
        await care.locator('summary').focus(); await expect(care.locator('summary')).toBeFocused();
        await page.keyboard.press('Enter'); await expect(care).not.toHaveAttribute('open');
        await page.keyboard.press('Enter'); await expect(care).toHaveAttribute('open', '');
        const gallery = page.getByRole('region', { name: 'Product pictures', exact: true });
        const images = gallery.locator('img');
        await expect(images).toHaveCount(3);
        expect(await images.evaluateAll(nodes => nodes.map(image => image.alt))).toEqual([
          'Creekside Camp Mug — illustrated demo design', ...source.pictures.map(picture => picture.alt),
        ]);
        await expect(images.first()).toHaveAttribute('loading', 'eager');
        await expect(images.first()).toHaveAttribute('fetchpriority', 'high');
        for (const image of (await images.all()).slice(1)) await expect(image).toHaveAttribute('loading', 'lazy');
        const lead = await images.first().getAttribute('src');
        const beforeMetadata = await page.locator('[data-product-jsonld]').textContent();
        const intent = JSON.stringify({ version: 1, lines: [{ id, quantity: 2 }] });
        await page.evaluate(raw => localStorage.setItem('dinkus.guest-cart.v1', raw), intent);
        for (const image of await images.all()) {
          await image.evaluate(node => node.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'end' }));
          await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
          expect(await image.evaluate(node => new URL(node.currentSrc).origin)).toBe(new URL(base).origin);
        }
        if (width === 390) expect(await gallery.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
        else expect(await gallery.evaluate(node => node.scrollWidth === node.clientWidth)).toBe(true);
        expect(await images.first().getAttribute('src')).toBe(lead);
        expect(await page.locator('[data-product-jsonld]').textContent()).toBe(beforeMetadata);
        expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'))).toBe(intent);
        expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-checkout.v1'))).toBeNull();
        await page.evaluate(() => document.fonts.ready);
        if (!javaScriptEnabled) {
          await gallery.evaluate(node => { node.scrollLeft = 0; });
          await gallery.scrollIntoViewIfNeeded();
          await page.screenshot({ path: new URL(`gallery-${width}.png`, output).pathname });
          await details.scrollIntoViewIfNeeded();
          await page.screenshot({ path: new URL(`details-${width}.png`, output).pathname });
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(writes).toEqual([]); expect(errors).toEqual([]);
        results.push({ width, javaScriptEnabled, pictures: 3, nativeSpecRows: 3, keyboardCareDisclosure: true,
          authoritativePrice: decimal, galleryPreservesIntentAndMetadata: true, noOverflow: true, writes: 0, checkoutStarts: 0, errors: 0 });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  const result = { checkedAt: new Date().toISOString(), scope: 'Published native mug content and read-only public browsing; not a purchase or physical-sample test.', results };
  await writeFile(new URL('verification.json', output), JSON.stringify(result, null, 2));
  return result;
}
if (import.meta.main) {
  if (process.argv.length === 2) console.log('No action. --check verifies the published mug without merchant writes or checkout starts.');
  else if (process.argv.length === 3 && process.argv[2] === '--check') console.log(JSON.stringify(await verifyMug(), null, 2));
  else { console.error('Only --check is supported.'); process.exitCode = 1; }
}
