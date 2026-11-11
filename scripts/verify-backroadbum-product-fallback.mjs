// Product enhancement/fallback proof. Fresh contexts; no retained browser or provider action.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/product-nojs/', import.meta.url);
const capture = process.argv.includes('--capture');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    for (const mode of ['no-javascript', 'blocked-scripts', 'enhanced']) {
      const context = await browser.newContext({ javaScriptEnabled: mode !== 'no-javascript', viewport: { width, height: 1000 },
        reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
      try {
        const starts = [], errors = [];
        await context.route(url => /\/(?:checkout\/start|checkout\/guest\/start)$/.test(url.pathname), route => {
          starts.push('blocked'); return route.abort();
        });
        if (mode === 'blocked-scripts') await context.route('**/*', route => route.request().resourceType() === 'script' ? route.abort() : route.fallback());
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.name));
        const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.goto(origin + '/products/switchback-bandana');
        if (mode === 'enhanced') {
          await expect(page.locator('[data-add-to-cart]')).toBeVisible();
          await expect(page.locator('[data-add-to-cart-requirement]')).toBeHidden();
        } else {
          await expect(page.locator('[data-add-to-cart]')).toBeHidden();
          await expect(page.locator('[data-add-to-cart-qty]')).toBeHidden();
          for (const step of await page.locator('[data-add-to-cart-qty-step]').all()) await expect(step).toBeHidden();
          await expect(page.locator('[data-add-to-cart-requirement]')).toContainText('Cart controls need JavaScript.');
          await expect(page.locator('[data-add-to-cart-requirement] a')).toHaveAttribute('href', '/shop');
          if (capture) await page.locator('.guest-cart-add').screenshot({ path: new URL(`${mode}-simple-${width}.png`, output).pathname });
        }
        await fits();
        await page.goto(origin + '/products/wrong-turn-tee');
        const members = JSON.parse(await page.locator('[data-variant-members]').textContent());
        const large = members.find(member => member.values.Size === 'L');
        const soldOut = members.find(member => member.values.Size === 'XL');
        expect(large.sellable).toBe(true); expect(soldOut.sellable).toBe(false);
        if (mode === 'no-javascript') {
          const form = page.locator('[data-product-options-fallback]');
          await expect(page.locator('[data-product-variants]')).toBeHidden();
          await expect(page.locator('[data-add-to-cart]')).toBeHidden();
          await expect(form).toHaveAttribute('method', 'get');
          await expect(form.locator('select')).toHaveValue(members.find(member => member.values.Size === 'M').id);
          for (const member of [large, soldOut]) {
            await form.getByLabel('View a product option', { exact: true }).selectOption(member.id);
            await form.getByRole('button', { name: 'View option', exact: true }).click();
            expect(new URL(page.url()).searchParams.get('item')).toBe(member.id);
            await expect(page.locator('[data-product-price]')).toHaveText(member.price);
            await expect(page.locator('[data-product-status]')).toHaveText(member.status);
            await expect(form.locator('select')).toHaveValue(member.id);
            await expect(page.locator('[data-add-to-cart]')).toBeHidden();
            await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', origin + '/products/wrong-turn-tee');
            await fits();
          }
          if (capture) await page.locator('.product-detail__body').screenshot({ path: new URL(`no-javascript-xl-${width}.png`, output).pathname });
          await page.goto(origin + '/products/wrong-turn-tee?item=removed-option');
          await expect(page.locator('[data-product-price]')).toBeHidden();
          await expect(form.locator('select')).toHaveValue('');
          await form.locator('select').selectOption(large.id);
          await form.getByRole('button', { name: 'View option', exact: true }).click();
          await expect(page.locator('[data-product-status]')).toHaveText(large.status);
          expect(new URL(page.url()).searchParams.get('item')).toBe(large.id);
        } else if (mode === 'blocked-scripts') {
          await expect(page.locator('[data-product-variants]')).toBeHidden();
          await expect(page.locator('[data-add-to-cart]')).toBeHidden();
          await expect(page.locator('[data-add-to-cart-requirement]')).toBeVisible();
          await expect(page.locator('[data-product-options-fallback]')).toHaveCount(0);
        } else {
          await expect(page.locator('[data-product-options-fallback]')).toHaveCount(0);
          await page.locator('[data-variant-choice][value="XL"]').check();
          await expect(page.locator('[data-product-status]')).toHaveText(soldOut.status);
          await expect(page.locator('[data-add-to-cart]')).toBeDisabled();
          await page.locator('[data-variant-choice][value="L"]').check();
          await expect(page.locator('[data-product-status]')).toHaveText(large.status);
          await page.getByRole('button', { name: 'Increase quantity', exact: true }).click();
          await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
          await expect(page.locator('[data-add-to-cart-status]')).toHaveText('Added to cart.');
          await expect(page.locator('[data-add-to-cart-view]')).toBeVisible();
          if (capture) await page.locator('.product-detail__body').screenshot({ path: new URL(`enhanced-l-${width}.png`, output).pathname });
          await page.locator('[data-add-to-cart-view]').click();
          await expect(page.locator('[data-guest-cart-qty]')).toHaveValue('2');
          const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dinkus.guest-cart.v1')));
          expect(stored.lines).toEqual([{ id: large.id, quantity: 2 }]);
          await page.locator('[data-guest-cart-remove]').click();
          await expect(page.locator('[data-guest-cart-line]')).toHaveCount(0);
        }
        await fits(); expect(starts).toEqual([]); expect(errors).toEqual([]);
        results.push({ width, mode, inertCartControlsHidden: mode !== 'enhanced', ordinaryCartBehavior: mode === 'enhanced',
          nativeGetOptionInspection: mode === 'no-javascript', exactMemberPriceAndStock: mode !== 'blocked-scripts',
          missingOptionRecovery: mode === 'no-javascript', noOverflow: true, checkoutStarts: 0, pageErrors: 0 });
      } finally { await context.close(); }
    }
  }
} finally { await browser.close(); }
const evidence = { checkedAt: new Date().toISOString(), origin, scope: 'Read-only option GETs and disposable browser-local add/remove; no checkout start or merchant mutation.', results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
