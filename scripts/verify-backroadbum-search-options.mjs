// Read-only shopper option discovery. Never adds intent, authenticates or checks out.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

if (!process.argv.includes('--check')) {
  console.log('No action. --check verifies public size search and exact product selection, with browser writes blocked. BACKROADBUM_VERIFY_BASE/OUTPUT select an isolated preview and evidence directory.');
} else {
  const base = process.env.BACKROADBUM_VERIFY_BASE || 'https://backroadbum.com';
  const output = process.env.BACKROADBUM_VERIFY_OUTPUT || new URL('../runs/backroadbum/search-options/', import.meta.url).pathname;
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const checks = [];
  try {
    for (const width of [1440, 390]) for (const colorScheme of ['light', 'dark']) for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme, javaScriptEnabled, userAgent: 'BackroadBum-SelfCheck/1.0' });
      try {
        const writes = [], errors = [];
        await context.route('**/*', async route => {
          if (!['GET', 'HEAD'].includes(route.request().method())) {
            writes.push(new URL(route.request().url()).pathname); await route.abort();
          } else await route.continue();
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        expect((await page.goto(base + '/search')).status()).toBe(200);
        await page.getByLabel('What are you looking for?', { exact: true }).fill('tee XL');
        await page.getByRole('button', { name: 'Search', exact: true }).click();
        await expect(page).toHaveURL(base + '/search?q=tee+XL');
        await expect(page.locator('[data-search-results-count]')).toHaveText('1 result.');
        const choice = page.locator('[data-search-option] a');
        await expect(choice).toHaveCount(1);
        await expect(page.getByRole('region', { name: 'Gear', exact: true }).getByRole('link')).toHaveCount(1);
        await expect(choice).toHaveAccessibleName('Wrong Turn Tee Size: XL');
        await expect(choice).toHaveAccessibleDescription('Out of stock');
        const teeHref = await choice.getAttribute('href');
        expect(teeHref).toMatch(/^\/products\/wrong-turn-tee\?item=[A-Za-z0-9._-]+$/);
        await choice.focus();
        expect(await choice.evaluate(a => getComputedStyle(a).outlineStyle)).not.toBe('none');
        const rect = await choice.boundingBox();
        expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (javaScriptEnabled) {
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({ path: `${output}/after-${width}-${colorScheme}.png`, fullPage: true });
        }
        await choice.press('Enter');
        await expect(page).toHaveURL(base + teeHref);
        await expect(page.locator('[data-product-status]')).toHaveAttribute('data-availability-status', 'out-of-stock');
        const teeItem = new URL(base + teeHref).searchParams.get('item');
        if (javaScriptEnabled) await expect(page.locator('[data-variant-choice][value="XL"]')).toBeChecked();
        else await expect(page.locator('[data-product-options-fallback] select')).toHaveValue(teeItem);
        await page.reload();
        await expect(page.locator('[data-product-status]')).toHaveAttribute('data-availability-status', 'out-of-stock');
        await page.goto(base + '/search?q=fleece+XL');
        await expect(page.locator('[data-search-results-count]')).toHaveText('1 result.');
        const fleece = page.locator('[data-search-option] a');
        await expect(page.getByRole('region', { name: 'Gear', exact: true }).getByRole('link')).toHaveCount(1);
        await expect(fleece).toHaveAccessibleName('Last Light Fleece Size: XL');
        await expect(fleece).toHaveAccessibleDescription('Available on backorder');
        const fleeceHref = await fleece.getAttribute('href');
        await fleece.click();
        await expect(page).toHaveURL(base + fleeceHref);
        await expect(page.locator('[data-product-status]')).toHaveAttribute('data-availability-status', 'available-on-backorder');
        if (javaScriptEnabled) await expect(page.locator('[data-variant-choice][value="XL"]')).toBeChecked();
        else await expect(page.locator('[data-product-options-fallback] select')).toHaveValue(new URL(base + fleeceHref).searchParams.get('item'));
        await page.goto(base + '/search?q=XL');
        await expect(page.locator('[data-search-results-count]')).toHaveText('2 results.');
        await expect(page.locator('[data-search-option]')).toHaveCount(2);
        await expect(page.getByRole('region', { name: 'Gear', exact: true }).getByRole('link')).toHaveCount(2);
        for (const [size, productWasIndexed] of [['L', true], ['M', false]]) {
          await page.goto(base + '/search?q=fleece+' + size);
          await expect(page.locator('[data-search-results-count]')).toHaveText('2 results.');
          const note = page.getByRole('link', { name: 'A layer within reach', exact: true });
          await expect(note).toHaveAttribute('href', '/field-note-a-layer-within-reach');
          const exact = page.getByRole('region', { name: 'Gear', exact: true }).getByRole('link');
          await expect(exact).toHaveCount(1);
          await expect(exact).toHaveAccessibleName(`Last Light Fleece Size: ${size}`);
          await expect(exact).toHaveAccessibleDescription('In stock');
          const href = await exact.getAttribute('href');
          expect(href).toMatch(/^\/products\/last-light-fleece\?item=[A-Za-z0-9._-]+$/);
          if (productWasIndexed && [[1440, 'light', false], [390, 'dark', true]].some(([w, scheme, js]) =>
              w === width && scheme === colorScheme && js === javaScriptEnabled)) {
            await page.evaluate(() => document.fonts.ready);
            await page.locator('[data-search-results]').screenshot({ path: `${output}/indexed-${width}-${colorScheme}.png` });
          }
          await exact.focus(); await exact.press('Enter');
          await expect(page).toHaveURL(base + href);
          await expect(page.locator('[data-product-status]')).toHaveAttribute('data-availability-status', 'in-stock');
          if (javaScriptEnabled) await expect(page.locator(`[data-variant-choice][value="${size}"]`)).toBeChecked();
          else await expect(page.locator('[data-product-options-fallback] select')).toHaveValue(new URL(base + href).searchParams.get('item'));
        }
        await page.goto(base + '/search?q=tee');
        await expect(page.getByRole('link', { name: 'Wrong Turn Tee', exact: true })).toHaveAttribute('href', '/products/wrong-turn-tee');
        await expect(page.locator('[data-search-option]')).toHaveCount(0);
        await page.goto(base + '/search?q=tee+XXL');
        await expect(page.locator('[data-search-empty]')).toBeVisible();
        await page.goto(base + '/search?q=mug');
        await expect(page.getByRole('region', { name: 'Gear', exact: true }).getByRole('link', { name: 'Creekside Camp Mug', exact: true })).toBeVisible();
        expect(await page.getByRole('region', { name: 'Field notes & guides', exact: true }).locator('li p').count()).toBeGreaterThan(0);
        await expect(page.locator('[data-search-option-summary]')).toHaveCount(0);
        expect(errors).toEqual([]); expect(writes).toEqual([]);
        checks.push({ width, colorScheme, javaScriptEnabled, teeHref, fleeceHref, exactSelection: true, oneDestinationPerExactMatch: true, reload: true, keyboard: true, touchTarget: true, nativeSearchPreserved: true, sizeAndNativeNote: true, noOverflow: true, writes, errors });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  await writeFile(`${output}/verification.json`, JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2));
  console.log(`${checks.length} public size-search journeys passed; no browser writes.`);
}
