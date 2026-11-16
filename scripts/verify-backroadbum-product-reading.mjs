// Read-only product → native Field Note → same product journeys; all HTTP writes blocked.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

if (!process.argv.includes('--check')) {
  console.log('No action. --check verifies public product reading links. --expect-absent captures the old shelf-free behavior. BACKROADBUM_VERIFY_BASE/OUTPUT/BASELINE select preview, output and optional prior facts.');
} else {
  const base = process.env.BACKROADBUM_VERIFY_BASE || 'https://backroadbum.com';
  const output = process.env.BACKROADBUM_VERIFY_OUTPUT || new URL('../runs/backroadbum/product-reading/', import.meta.url).pathname;
  const absent = process.argv.includes('--expect-absent');
  const baseline = process.env.BACKROADBUM_VERIFY_BASELINE
    ? JSON.parse(await readFile(process.env.BACKROADBUM_VERIFY_BASELINE, 'utf8')) : null;
  const products = [
    ['county-line-field-book', 'A page from the road', '/field-note-a-page-from-the-road'],
    ['glovebox-field-tote', 'The reset after a road day', '/field-note-after-a-road-day'],
    ['creekside-camp-mug'], ['switchback-bandana'], ['wrong-turn-tee'], ['last-light-fleece'], ['long-way-cap'],
  ];
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const cases = [];
  try {
    for (const width of [1440, 390]) for (const colorScheme of ['light', 'dark']) for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme, javaScriptEnabled,
        reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
      try {
        const writes = [], errors = [], facts = {};
        await context.route('**/*', route => {
          if (!['GET', 'HEAD'].includes(route.request().method())) {
            writes.push(new URL(route.request().url()).pathname); return route.abort();
          }
          return route.continue();
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.name));
        let intent;
        for (const [slug, title, href] of products) {
          assert.equal((await page.goto(base + '/products/' + slug)).status(), 200);
          await page.evaluate(() => document.fonts.ready);
          const shelf = page.locator('[data-product-reading]');
          facts[slug] = await page.evaluate(() => ({
            name: document.querySelector('h1')?.textContent,
            price: document.querySelector('[data-product-price]')?.textContent,
            availability: document.querySelector('[data-product-status]')?.getAttribute('data-availability-status'),
            summary: document.querySelector('[data-product-summary]')?.textContent,
            details: document.querySelector('[data-product-details] .product-details__grid')?.textContent,
            structuredData: document.querySelector('[data-product-jsonld]')?.textContent,
          }));
          if (javaScriptEnabled && !intent) {
            intent = JSON.stringify({ version: 1, lines: [{ id: await page.locator('[data-commerce-item]').getAttribute('data-commerce-item'), quantity: 2 }] });
            await page.evaluate(raw => localStorage.setItem('dinkus.guest-cart.v1', raw), intent);
          }
          if (absent || !title) await expect(shelf).toHaveCount(0);
          else {
            await expect(shelf).toHaveCount(1);
            await expect(shelf).toHaveAttribute('aria-labelledby', 'product-reading-title');
            await expect(shelf.locator('li a')).toHaveCount(1);
            const link = shelf.getByRole('link', { name: title, exact: true });
            await expect(link).toHaveAttribute('href', href);
            assert((await link.boundingBox()).height >= 44);
            await link.focus();
            assert(parseFloat(await link.evaluate(a => getComputedStyle(a).outlineWidth)) >= 3);
            if (slug === 'county-line-field-book' && javaScriptEnabled) {
              await shelf.scrollIntoViewIfNeeded();
              await page.screenshot({ path: `${output}/after-${width}-${colorScheme}.png` });
            }
            await page.keyboard.press('Enter');
            await page.waitForURL(base + href);
            await expect(page.locator('h1')).toHaveText(title);
            const returnLink = page.locator(`main a[href="/products/${slug}"]`).first();
            await returnLink.focus();
            await page.keyboard.press('Enter');
            await page.waitForURL(base + '/products/' + slug);
            await expect(page.locator('[data-product-price]')).toHaveText(facts[slug].price);
            await shelf.getByRole('link', { name: 'All field notes', exact: true }).click();
            await page.waitForURL(base + '/field-notes');
            assert((await page.locator('.field-index .brb-story-link').count()) >= 8);
          }
          if (absent && slug === 'county-line-field-book' && javaScriptEnabled) {
            await page.locator('[data-product-details]').scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${output}/before-${width}-${colorScheme}.png` });
          }
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        }
        if (baseline) {
          const expected = structuredClone(baseline.cases.find(c => c.width === width && c.colorScheme === colorScheme && c.javaScriptEnabled === javaScriptEnabled).facts);
          // Local HTTP fixtures intentionally have a different request origin. Compare all
          // schema facts/paths exactly, allowing only this explicit origin translation.
          if (process.env.BACKROADBUM_VERIFY_ALLOW_ORIGIN_CHANGE === '1') for (const product of Object.values(expected)) {
            const schema = JSON.parse(product.structuredData);
            for (const node of [schema, schema.offers].filter(Boolean)) if (node.url) {
              const url = new URL(node.url);
              assert.equal(url.origin, 'https://backroadbum.com');
              node.url = new URL(url.pathname + url.search + url.hash, base).href;
            }
            product.structuredData = JSON.stringify(schema);
          }
          assert.deepEqual(facts, expected);
        }
        assert.equal((await page.goto(base + '/products/not-a-real-product')).status(), 404);
        await expect(page.locator('[data-product-reading]')).toHaveCount(0);
        await page.goto(base + '/categories/road-day');
        assert.deepEqual(await page.locator('[data-collection-reading] li a').evaluateAll(nodes => nodes.map(n => n.getAttribute('href'))),
          ['/field-note-a-page-from-the-road', '/field-note-after-a-road-day']);
        if (javaScriptEnabled) {
          assert.equal(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1')), intent);
          assert.equal(await page.evaluate(() => localStorage.getItem('dinkus.guest-checkout.v1')), null);
        }
        assert.deepEqual(writes, []); assert.deepEqual(errors, []);
        cases.push({ width, colorScheme, javaScriptEnabled, facts, readingPresent: !absent, nativeKeyboardRoundTrip: !absent,
          unrelatedProductsEmpty: true, collectionPreserved: true, intentPreserved: true, noOverflow: true, writes, errors });
      } finally { await context.close(); }
    }
    await writeFile(`${output}/verification.json`, JSON.stringify({ checkedAt: new Date().toISOString(), schemaOriginTranslated: process.env.BACKROADBUM_VERIFY_ALLOW_ORIGIN_CHANGE === '1', cases }, null, 2));
    console.log(`${cases.length} product-reading journeys passed; no HTTP writes.`);
  } finally { await browser.close(); }
}
