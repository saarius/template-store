// Read-only native specification/care proof. The source file is an authorship
// checklist, never a runtime content, price or availability authority.
import { readFile, mkdir, writeFile } from 'node:fs/promises';

export async function verifyProductDetails(sourceName = 'backroadbum-cap-details.json') {
  if (!/^backroadbum-[a-z-]+\.json$/.test(sourceName)) throw Error('Choose a product-details checklist in seed/.');
  const source = JSON.parse(await readFile(new URL('../seed/' + sourceName, import.meta.url), 'utf8'));
  const careParagraphs = Array.isArray(source.care) ? source.care : [source.care];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.slug) || typeof source.title !== 'string' ||
      typeof source.tableHeading !== 'string' || typeof source.careHeading !== 'string' ||
      !Array.isArray(source.rows) || !source.rows.length ||
      !source.rows.every(row => typeof row.label === 'string' && typeof row.value === 'string') ||
      !careParagraphs.length || !careParagraphs.every(text => typeof text === 'string' && text.length > 0)) {
    throw Error('Product-details checklist is incomplete.');
  }
  const { chromium, expect } = await import('@playwright/test');
  const base = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
  const output = new URL(`../runs/backroadbum/product-details-${source.slug}/`, import.meta.url);
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [1440, 390]) for (const colorScheme of ['light', 'dark']) for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ javaScriptEnabled, colorScheme, viewport: { width, height: 1000 },
        userAgent: 'BackroadBum-SelfCheck/1.0', reducedMotion: 'reduce' });
      const writes = [], checkoutRequests = [], errors = [];
      await context.route('**/*', route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (/\/checkout\/|\/api\/checkout\//.test(path)) checkoutRequests.push(path);
        if (['GET', 'HEAD'].includes(request.method())) return route.continue();
        writes.push(path); return route.abort();
      });
      try {
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.name));
        expect((await page.goto(base + '/products/' + source.slug)).status()).toBe(200);
        await expect(page.locator('h1')).toHaveText(source.title);
        const id = await page.locator('[data-commerce-item]').getAttribute('data-commerce-item');
        expect(id).toBeTruthy();
        const response = await context.request.get(base + '/api/guest-cart/snapshot?ids=' + encodeURIComponent(id));
        expect(response.ok()).toBe(true);
        const product = (await response.json()).products[0];
        expect(product.found).toBe(true);
        // The snapshot owns formatted prices; its legacy wire has no currency field.
        if (product.price.saleText) {
          await expect(page.locator('[data-product-price] [data-regular-price]')).toHaveText(product.price.regularText);
          await expect(page.locator('[data-product-price] [data-sale-price]')).toHaveText(product.price.saleText);
        } else await expect(page.locator('[data-product-price]')).toHaveText(product.price.regularText);
        const metadata = await page.locator('[data-product-jsonld]').textContent();
        expect(Number(JSON.parse(metadata).offers.price)).toBe(Number(product.price.unitMinor) / 100);
        const summary = await page.locator('[data-product-summary]').innerText();
        const leadImage = await page.locator('[data-product-gallery] img').first().evaluate(image => ({
          src: image.getAttribute('src'), alt: image.alt, srcset: image.getAttribute('srcset'),
        }));
        const details = page.locator('[data-product-details]');
        const specs = details.getByRole('region', { name: source.tableHeading, exact: true });
        await expect(specs).toBeVisible();
        expect(await specs.locator('dt').allTextContents()).toEqual(source.rows.map(row => row.label));
        expect(await specs.locator('dd').allTextContents()).toEqual(source.rows.map(row => row.value));
        const care = details.locator('details').filter({ has: page.locator('summary', { hasText: source.careHeading }) });
        await expect(care).toHaveCount(1);
        await expect(care).toHaveAttribute('open', '');
        await expect(care.locator('summary')).toHaveText(source.careHeading);
        expect(await care.locator('.product-section__body p').allTextContents()).toEqual(careParagraphs);
        // Care is native HTML; Enter works with JavaScript disabled too.
        const intent = JSON.stringify({ version: 1, lines: [{ id, quantity: 2 }] });
        await page.evaluate(raw => localStorage.setItem('dinkus.guest-cart.v1', raw), intent);
        await care.locator('summary').focus(); await expect(care.locator('summary')).toBeFocused();
        await page.keyboard.press('Enter'); await expect(care).not.toHaveAttribute('open');
        await page.keyboard.press('Enter'); await expect(care).toHaveAttribute('open', '');
        expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'))).toBe(intent);
        expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-checkout.v1'))).toBeNull();
        expect(await page.locator('[data-product-jsonld]').textContent()).toBe(metadata);
        await page.evaluate(() => document.fonts.ready);
        await details.scrollIntoViewIfNeeded();
        await page.screenshot({ path: new URL(`details-${width}-${colorScheme}-js-${javaScriptEnabled ? 'on' : 'off'}.png`, output).pathname });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(writes).toEqual([]); expect(checkoutRequests).toEqual([]); expect(errors).toEqual([]);
        results.push({ width, colorScheme, javaScriptEnabled, product, metadata, summary, leadImage,
          specRows: source.rows.length, careParagraphs: careParagraphs.length, keyboardCareDisclosure: true,
          unchangedIntent: true, noOverflow: true, writes: 0, checkoutRequests: 0, browserErrors: 0 });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  const report = { checkedAt: new Date().toISOString(), base,
    scope: 'Published native content, current Commerce facts and browser intent retention; not a purchase or physical-sample test.', results };
  await writeFile(new URL('verification.json', output), JSON.stringify(report, null, 2));
  return report;
}
if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length === 0) console.log('No action. --check [--source=backroadbum-cap-details.json] verifies native specifications and care without merchant writes or checkout requests.');
  else if (args[0] === '--check' && args.length <= 2 && (!args[1] || args[1].startsWith('--source='))) {
    console.log(JSON.stringify(await verifyProductDetails(args[1]?.slice('--source='.length)), null, 2));
  } else { console.error('Only --check and an optional --source checklist are supported.'); process.exitCode = 1; }
}
