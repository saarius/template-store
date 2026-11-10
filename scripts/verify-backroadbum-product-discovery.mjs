// Public product discovery proof. --cart adds/removes ONE cap; no checkout is started.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/product-discovery/', import.meta.url);
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
    const catalog = await page.locator('[data-commerce-product][data-product-link]').evaluateAll(cards => cards.map(card => ({
      id: card.dataset.commerceProduct, path: card.getAttribute('href'), name: card.querySelector('h3')?.textContent,
      price: card.querySelector('.price')?.textContent, availability: card.querySelector('[data-commerce-availability]')?.getAttribute('data-commerce-availability'),
    })));
    expect(catalog.length).toBeGreaterThan(0);
    for (const product of catalog) {
      expect((await page.goto(base + product.path)).status()).toBe(200);
      await expect(page.locator('h1')).toHaveText(product.name);
      await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).getByRole('link', { name: 'Shop', exact: true })).toHaveAttribute('href', '/shop');
      await expect(page.locator('[data-rough-callout]')).toHaveCount(0);
      await expect(page.locator('[data-product-price]')).toContainText(product.price.match(/\$[\d,.]+/g).at(-1));
      const related = page.locator('[data-related-gear]');
      const cards = related.locator('[data-commerce-product]');
      expect(await cards.count()).toBeGreaterThan(0); expect(await cards.count()).toBeLessThanOrEqual(3);
      const ids = [];
      for (const card of await cards.all()) {
        const id = await card.getAttribute('data-commerce-product'); ids.push(id);
        expect(id).not.toBe(product.id);
        const listed = catalog.find(candidate => candidate.id === id); expect(listed).toBeTruthy();
        await expect(card).toHaveAttribute('href', listed.path);
        await expect(card.locator('h3')).toHaveText(listed.name);
        expect(await card.locator('.price').textContent()).toBe(listed.price);
        await expect(card.locator('[data-commerce-availability]')).toHaveAttribute('data-commerce-availability', listed.availability);
      }
      expect(new Set(ids).size).toBe(ids.length);
      if (product.path === '/products/glovebox-field-tote' || product.path === '/products/creekside-camp-mug') {
        const details = page.locator('[data-product-details] details').first();
        await expect(details).toHaveAttribute('open', '');
        await details.locator('summary').click(); await expect(details).not.toHaveAttribute('open', '');
        await details.locator('summary').click(); await expect(details).toHaveAttribute('open', '');
        await page.evaluate(() => document.fonts.ready); await fits();
        await page.screenshot({ path: new URL(`${product.path.split('/').pop()}-${width}.png`, output).pathname, fullPage: true });
      }
      if (product.path === '/products/glovebox-field-tote') {
        const collections = related.getByRole('navigation', { name: 'This product’s collections' });
        for (const [name, slug] of [['Road day', 'road-day'], ['Slow camp', 'slow-camp']]) {
          await expect(collections.getByRole('link', { name, exact: true })).toHaveAttribute('href', '/categories/' + slug);
        }
        await page.keyboard.press('Tab'); // Establish keyboard modality after pointer-operated details.
        await cards.first().focus();
        expect(await cards.first().evaluate(card => getComputedStyle(card).outlineStyle)).not.toBe('none');
        const destination = await cards.first().getAttribute('href');
        const name = await cards.first().locator('h3').innerText();
        await cards.first().press('Enter'); await expect(page).toHaveURL(base + destination);
        await expect(page.locator('h1')).toHaveText(name);
        await page.goto(base + product.path);
        await page.getByRole('navigation', { name: 'This product’s collections' }).getByRole('link', { name: 'Slow camp', exact: true }).click();
        await expect(page.locator('h1')).toHaveText('Slow camp');
        await expect(page.locator('[data-product-link][href="/products/glovebox-field-tote"]')).toBeVisible();
      }
      await fits();
    }
    let cart = false;
    if (width === 1440 && process.argv.includes('--cart')) {
      await page.goto(base + '/products/glovebox-field-tote');
      await page.locator('[data-related-gear] a[href="/products/long-way-cap"]').click();
      const sale = (await page.locator('[data-product-price]').innerText()).match(/\$[\d,.]+/g).at(-1);
      await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
      await expect(page.locator('[data-add-to-cart-status]')).toHaveText('Added to cart.');
      await page.goto(base + '/cart');
      await expect(page.locator('[data-guest-cart-subtotal]')).toHaveText('Subtotal ' + sale);
      await page.locator('[data-guest-cart-remove]').click();
      await expect(page.locator('[data-guest-cart-line]')).toHaveCount(0); cart = true;
    }
    expect((await page.goto(base + '/products/not-a-real-backroad-product')).status()).toBe(404);
    await expect(page.locator('[data-related-gear]')).toHaveCount(0);
    expect(errors).toEqual([]); expect(checkout).toEqual([]);
    results.push({ width, productsChecked: catalog.length, relatedBoundedAndDeduplicated: true, noSelfLinks: true,
      matchesCurrentShopFacts: true, multiCollectionNavigation: true, keyboardProductNavigation: true, detailsToggle: true,
      missingProduct404: true, noOverflow: true, cartAddedAndRemoved: cart, browserErrors: 0, checkoutRequests: 0 });
    await context.close();
  }
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 }, userAgent: 'BackroadBum-SelfCheck/1.0' });
  const page = await context.newPage();
  await page.goto(base + '/products/glovebox-field-tote');
  await page.locator('[data-related-gear] [data-product-link]').first().click();
  await expect(page.locator('[data-product-price]')).toBeVisible();
  await context.close();
} finally { await browser.close(); }
const evidence = { checkedAt: new Date().toISOString(), results, noJavaScriptRelatedNavigation: true };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
