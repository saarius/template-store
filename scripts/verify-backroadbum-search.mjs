// Public discovery proof. Default is read-only; --cart adds/removes ONE cap, never starts checkout.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/search/', import.meta.url);
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
    expect((await page.goto(base + '/search')).status()).toBe(200);
    await expect(page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'Search', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('input[type=search]')).toHaveCount(1);
    await expect(page.locator('[data-search-prompt]')).toContainText('A good place to start.');
    await page.getByLabel('What are you looking for?', { exact: true }).focus();
    expect(await page.locator('input').evaluate(input => getComputedStyle(input).outlineStyle)).not.toBe('none');
    await page.getByLabel('What are you looking for?', { exact: true }).fill('mug');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(base + '/search?q=mug');
    const gear = page.getByRole('region', { name: 'Gear', exact: true });
    await expect(gear.getByRole('link', { name: 'Creekside Camp Mug', exact: true })).toHaveAttribute('href', '/products/creekside-camp-mug');
    await expect(page.getByRole('region', { name: 'Field notes & guides', exact: true })).toContainText('The wet-gear reset');
    await fits(); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: new URL(`results-${width}.png`, output).pathname, fullPage: true });
    await gear.getByRole('link', { name: 'Creekside Camp Mug', exact: true }).click();
    await expect(page.locator('h1')).toHaveText('Creekside Camp Mug');
    await expect(page.locator('[data-product-price]')).toBeVisible();
    // Native starter categories were unpublished, not removed from the database.
    // Current published collections remain searchable; empty starter hits must stay gone.
    await page.goto(base + '/search?q=camp');
    await expect(page.getByRole('region', { name: 'Collections', exact: true }).getByRole('link', { name: 'Slow camp', exact: true })).toHaveAttribute('href', '/categories/slow-camp');
    for (const [query, title] of [['tee', 'Tees'], ['hat', 'Hats'], ['hoodie', 'Hoodies']]) {
      await page.goto(base + '/search?q=' + query);
      await expect(page.locator('[data-search-results]').getByRole('link', { name: title, exact: true })).toHaveCount(0);
      if (query === 'tee') {
        await expect(page.getByRole('region', { name: 'Gear', exact: true }).getByRole('link', { name: 'Wrong Turn Tee', exact: true })).toHaveAttribute('href', '/products/wrong-turn-tee');
        await fits();
        await page.screenshot({ path: new URL(`tee-${width}.png`, output).pathname, fullPage: true });
      }
    }
    await page.goto(base + '/search?q=wet');
    await page.getByRole('region', { name: 'Field notes & guides' }).getByRole('link', { name: 'The wet-gear reset', exact: true }).click();
    await expect(page.locator('h1')).toHaveText('The wet-gear reset');
    expect((await page.goto(base + '/search?q=zzzznonexistentgear')).status()).toBe(200);
    await expect(page.locator('[data-search-empty]')).toContainText('No matches this time.');
    await fits(); await page.screenshot({ path: new URL(`empty-${width}.png`, output).pathname, fullPage: true });
    await page.goto(base + '/search?q=m');
    await expect(page.locator('[data-search-prompt]')).toContainText('Enter at least two characters');
    await page.goto(base + '/search?q=' + 'x'.repeat(150));
    await expect(page.locator('input[type=search]')).toHaveValue('x'.repeat(120)); await fits();
    let cart = false;
    if (width === 1440 && process.argv.includes('--cart')) {
      await page.goto(base + '/search?q=cap');
      await page.getByRole('region', { name: 'Gear' }).getByRole('link', { name: 'Long Way Cap', exact: true }).click();
      const price = (await page.locator('[data-product-price]').innerText()).match(/\$[\d,.]+/g)?.at(-1);
      expect(price).toBeTruthy();
      await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
      await expect(page.locator('[data-add-to-cart-status]')).toHaveText('Added to cart.');
      await page.goto(base + '/cart');
      await expect(page.locator('[data-guest-cart-subtotal]')).toHaveText('Subtotal ' + price);
      await page.locator('[data-guest-cart-remove]').click();
      await expect(page.locator('[data-guest-cart-line]')).toHaveCount(0); cart = true;
    }
    expect(errors).toEqual([]); expect(checkout).toEqual([]);
    results.push({ width, oneSearchField: true, groupedDestinations: true, gearAndStoryLinks: true, emptyAndShortStates: true, boundedQuery: true, nativeStarterCategoriesAbsent: true, publishedCollectionFindable: true, keyboardFocus: true, noOverflow: true, cartAddedAndRemoved: cart, browserErrors: 0, checkoutRequests: 0 });
    await context.close();
  }
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 }, userAgent: 'BackroadBum-SelfCheck/1.0' });
  const page = await context.newPage();
  await page.goto(base + '/search');
  await page.getByLabel('What are you looking for?', { exact: true }).fill('mug');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Gear' })).toContainText('Creekside Camp Mug');
  await page.goto(base + '/search?q=tee');
  await expect(page.getByRole('region', { name: 'Gear' })).toContainText('Wrong Turn Tee');
  await expect(page.locator('[data-search-results]').getByRole('link', { name: 'Tees', exact: true })).toHaveCount(0);
  await context.close();
} finally { await browser.close(); }
const evidence = { checkedAt: new Date().toISOString(), results, noJavaScriptSearch: true };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
