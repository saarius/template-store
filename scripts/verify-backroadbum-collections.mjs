// Public shopper proof for the deployed Backroad Bum collection content.
// Optional captures stay in ignored runs/, never in git.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
const origin = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
const captures = process.env.CAPTURE_DIR;
if (captures) mkdirSync(captures, { recursive: true });
const browser = await chromium.launch({ headless: true });
const result = { origin, viewports: [] };
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const visit = async (path, status = 200) => {
      const response = await page.goto(origin + path);
      assert.equal(response.status(), status, path);
      await page.locator('h1').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, path + ' overflow');
    };
    const listings = () => page.locator('[data-commerce-product]').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.getAttribute('data-commerce-product'), {
      name: node.querySelector('h3')?.textContent,
      price: node.querySelector('.price')?.textContent,
      availability: node.querySelector('[data-commerce-availability]')?.getAttribute('data-commerce-availability'),
      href: node.getAttribute('href'),
    }])));
    await visit('/shop');
    assert.equal(await page.locator('[data-commerce-product]').count(), 6);
    const all = await listings();
    const nav = page.getByRole('navigation', { name: 'Shop collections' });
    assert.equal(await nav.getByRole('link').count(), 3);
    assert.equal(await nav.locator('[aria-current="page"]').textContent().then(text => text.trim()), 'All gear (6)');
    if (captures) await page.screenshot({ path: `${captures}/shop-${width}.png`, fullPage: true });
    for (const [slug, title, names] of [
      ['road-day', 'Road day', ['Wrong Turn Tee', 'Long Way Cap', 'Glovebox Field Tote', 'Switchback Bandana']],
      ['slow-camp', 'Slow camp', ['Creekside Camp Mug', 'Last Light Fleece', 'Glovebox Field Tote', 'Switchback Bandana']],
    ]) {
      await page.getByRole('navigation', { name: 'Shop collections' }).getByRole('link', { name: `${title} (4)`, exact: true }).click();
      await page.waitForURL(origin + '/categories/' + slug);
      assert.equal(await page.locator('h1').textContent(), title);
      assert.equal(await page.locator('[data-commerce-product]').count(), 4);
      const selected = await listings();
      assert.deepEqual(Object.values(selected).map(item => item.name).sort(), names.sort());
      for (const [id, item] of Object.entries(selected)) assert.deepEqual(item, all[id], 'Commerce facts differ from shop');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.getByRole('navigation', { name: 'Shop collections' }).locator('[aria-current="page"]').getAttribute('href'), '/categories/' + slug);
      if (captures) await page.screenshot({ path: `${captures}/${slug}-${width}.png`, fullPage: true });
    }
    // A collection listing takes the shopper to the canonical product and real cart.
    await page.getByRole('link', { name: /Creekside Camp Mug/ }).click();
    await page.waitForURL(origin + '/products/creekside-camp-mug');
    await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
    await page.getByText('Added to cart.', { exact: true }).waitFor();
    await visit('/cart');
    await page.locator('[data-guest-cart-line]').filter({ hasText: 'Creekside Camp Mug' }).waitFor();
    await page.reload();
    await page.locator('[data-guest-cart-line]').filter({ hasText: 'Creekside Camp Mug' }).waitFor();
    await visit('/categories/hats');
    assert.equal(await page.locator('[data-commerce-product]').count(), 0);
    assert.match(await page.locator('[data-commerce-empty]').textContent(), /No gear/);
    await visit('/categories/not-a-real-collection', 404);
    assert.equal(await page.getByRole('link', { name: 'Browse all gear', exact: true }).getAttribute('href'), '/shop');
    assert.deepEqual(errors, []);
    result.viewports.push({ width, products: 6, collections: 2, collectionCounts: [4, 4], cartPersists: true, emptyAndMissing: true, pageErrors: 0, overflow: false });
    await page.close();
  }
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
