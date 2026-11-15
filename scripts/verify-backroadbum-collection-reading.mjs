// Read-only published collection → note → product journey. Blocks all writes.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
const origin = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
const captures = process.env.CAPTURE_DIR;
const absent = process.argv.includes('--expect-absent');
if (captures) mkdirSync(captures, { recursive: true });
const report = { checkedAt: new Date().toISOString(), origin: new URL(origin).hostname, cases: [] };
const browser = await chromium.launch();
try {
  for (const width of [390, 1440]) for (const colorScheme of ['light', 'dark']) for (const javaScriptEnabled of [false, true]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme, javaScriptEnabled,
      reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    const writes = [], errors = [];
    await context.route('**/*', route => {
      if (!['GET', 'HEAD'].includes(route.request().method())) { writes.push(new URL(route.request().url()).pathname); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.name));
    assert.equal((await page.goto(origin + '/categories/road-day')).status(), 200);
    await page.evaluate(() => document.fonts.ready);
    const shelf = page.locator('[data-collection-reading]');
    const facts = await page.locator('[data-commerce-product]').allTextContents();
    const intent = JSON.stringify({ version: 1, lines: [{ id: await page.locator('[data-commerce-product]').first().getAttribute('data-commerce-product'), quantity: 2 }] });
    if (javaScriptEnabled) await page.evaluate(raw => localStorage.setItem('dinkus.guest-cart.v1', raw), intent);
    if (absent) {
      assert.equal(await shelf.count(), 0);
      if (captures) {
        await page.locator('[data-commerce-product]').last().scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${captures}/before-${width}-${colorScheme}-${javaScriptEnabled ? 'js' : 'native'}.png` });
      }
    } else {
      assert.equal(await shelf.count(), 1);
      assert.equal(await shelf.getAttribute('aria-labelledby'), 'collection-reading-title');
      const items = shelf.locator('li a');
      assert.equal(await items.count(), 2);
      assert.deepEqual(await items.evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))),
        ['/field-note-a-page-from-the-road', '/field-note-after-a-road-day']);
      await shelf.scrollIntoViewIfNeeded();
      if (captures) await page.screenshot({ path: `${captures}/reading-${width}-${colorScheme}-${javaScriptEnabled ? 'js' : 'native'}.png` });
      for (const [note, product] of [['A page from the road', 'county-line-field-book'], ['The reset after a road day', 'glovebox-field-tote']]) {
        const link = shelf.getByRole('link', { name: note, exact: true });
        assert((await link.boundingBox()).height >= 44);
        await link.focus();
        assert(parseFloat(await link.evaluate(node => getComputedStyle(node).outlineWidth)) >= 3);
        await page.keyboard.press('Enter');
        await page.waitForURL(url => url.pathname.startsWith('/field-note-'));
        assert.equal(await page.locator('h1').textContent(), note);
        const productLink = page.locator(`main a[href="/products/${product}"]`).first();
        await productLink.focus();
        await page.keyboard.press('Enter');
        await page.waitForURL(url => url.pathname === `/products/${product}`);
        assert.equal((await page.locator('h1').count()), 1);
        await page.goto(origin + '/categories/road-day');
        assert.deepEqual(await page.locator('[data-commerce-product]').allTextContents(), facts);
      }
      await shelf.getByRole('link', { name: 'All field notes', exact: true }).click();
      await page.waitForURL(url => url.pathname === '/field-notes');
      assert.equal(await page.locator('.field-index .brb-story-link').count(), 7);
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.goto(origin + '/categories/slow-camp');
    assert.equal(await page.locator('[data-collection-reading]').count(), absent ? 0 : 1);
    if (!absent) assert.deepEqual(await page.locator('[data-collection-reading] li a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))),
      ['/field-note-after-a-road-day'], 'Only the shared tote supplies a Slow camp relationship');
    assert((await page.locator('[data-commerce-product]').count()) > 0);
    assert.equal((await page.goto(origin + '/categories/not-a-real-collection')).status(), 404);
    assert.equal(await page.locator('[data-collection-reading]').count(), 0);
    if (javaScriptEnabled) {
      assert.equal(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1')), intent);
      assert.equal(await page.evaluate(() => localStorage.getItem('dinkus.guest-checkout.v1')), null);
    }
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    report.cases.push({ width, colorScheme, javaScriptEnabled, readingPresent: !absent, nativeKeyboardJourney: !absent,
      commerceFactsRetained: true, writes: 0, pageErrors: 0, noOverflow: true });
    await context.close();
  }
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
