// Public, read-only discovery proof. No checkout preparation or cart writes.
// Optional captures belong in ignored runs/, never in git.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
const origin = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
const captures = process.env.CAPTURE_DIR;
// Optional native-publication proof; comma-separated current product slugs, not a second catalog.
const expectedRoadDay = process.argv.find(arg => arg.startsWith('--road-day-order='))?.split('=')[1].split(',');
if (captures) mkdirSync(captures, { recursive: true });
const browser = await chromium.launch();
const report = { checkedAt: new Date().toISOString(), viewports: [] };
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 1000 },
      userAgent: 'BackroadBum-SelfCheck/1.0', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], writes = [];
    page.on('pageerror', error => errors.push(error.name));
    page.on('request', request => { if (request.method() !== 'GET') writes.push(new URL(request.url()).pathname); });
    const fit = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const listings = () => page.locator('[data-commerce-product]').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.getAttribute('data-commerce-product'), {
      name: node.querySelector('h3')?.textContent,
      price: node.querySelector('.price')?.textContent,
      availability: node.querySelector('[data-commerce-availability]')?.getAttribute('data-commerce-availability'),
      href: node.getAttribute('href'),
    }])));
    assert.equal((await page.goto(origin + '/')).status(), 200);
    await page.evaluate(() => document.fonts.ready);
    const section = page.getByRole('region', { name: 'Shop by collection', exact: true });
    await section.waitFor();
    const introductions = await section.locator('article').evaluateAll(nodes => nodes.map(node => ({
      title: node.querySelector('h2')?.textContent,
      description: node.querySelector('p')?.textContent ?? '',
      href: node.querySelector('a')?.getAttribute('href'),
    })));
    assert(introductions.length > 0);
    assert(new Set(introductions.map(intro => intro.href)).size === introductions.length);
    const all = await listings();
    const order = await page.evaluate(() => {
      const intro = document.querySelector('[data-collection-discovery]');
      const catalog = document.querySelector('[data-commerce-catalog]');
      return Boolean(intro && catalog && (intro.compareDocumentPosition(catalog) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    assert(order, 'Collection links must precede the full catalog');
    await fit();
    if (captures) { await section.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${captures}/discovery-${width}.png` }); }
    for (const intro of introductions) {
      await page.goto(origin + '/');
      const link = page.getByRole('region', { name: 'Shop by collection', exact: true }).getByRole('link', { name: intro.title, exact: true });
      assert((await link.boundingBox()).height >= 48);
      await link.focus();
      const outline = await link.evaluate(node => getComputedStyle(node).outlineWidth);
      assert(parseFloat(outline) >= 3);
      await page.keyboard.press('Enter');
      await page.waitForURL(origin + intro.href);
      assert.equal(await page.locator('h1').textContent(), intro.title);
      assert.equal(await page.locator('.collection-intro .lead').textContent(), intro.description);
      const selected = await listings();
      assert(Object.keys(selected).length > 0);
      if (expectedRoadDay && intro.href === '/categories/road-day') {
        assert.deepEqual(Object.values(selected).map(product => product.href), expectedRoadDay.map(slug => `/products/${slug}`),
          'Road day must follow its published native reference order');
      }
      for (const [id, product] of Object.entries(selected)) assert.deepEqual(product, all[id], 'Commerce facts changed between home and collection');
      assert.equal(await page.getByRole('navigation', { name: 'Shop collections' }).locator('[aria-current="page"]').getAttribute('href'), intro.href);
      await fit();
      if (captures) await page.screenshot({ path: `${captures}/collection-${intro.href.split('/').at(-1)}-${width}.png` });
    }
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    report.viewports.push({ width, javaScript: false, collections: introductions.length,
      cmsCopyMatches: true, keyboardNavigation: true, visibleFocus: true, commerceFactsMatch: true,
      nativeOrderChecked: Boolean(expectedRoadDay), writes: 0, noOverflow: true });
    await context.close();
  }
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
