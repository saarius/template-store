// Real Chromium default-font preferences, not a CSS font-size/zoom simulation.
// Fresh disposable profiles only; browser-local cart edits and invalid contact submission.
import { chromium, expect } from '@playwright/test';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/reflow/', import.meta.url);
const capture = process.argv.includes('--capture');
await mkdir(output, { recursive: true });
const results = [];
let originalPrice;
for (const { font, width } of [{ font: 16, width: 1440 }, { font: 16, width: 390 }, { font: 16, width: 320 }, { font: 32, width: 390 }, { font: 32, width: 320 }]) {
  const profile = await mkdtemp(join(tmpdir(), 'backroadbum-reflow-'));
  let context;
  try {
    await mkdir(join(profile, 'Default'));
    await writeFile(join(profile, 'Default', 'Preferences'), JSON.stringify({ webkit: { webprefs: { default_font_size: font } } }));
    // The default headless shell ignores this preference. Full Chromium must honor it.
    context = await chromium.launchPersistentContext(profile, { channel: 'chromium', viewport: { width, height: 1000 },
      reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    const starts = [], errors = [], routes = [];
    await context.route(url => /\/(?:checkout\/start|checkout\/guest\/start)$/.test(url.pathname), route => {
      starts.push('blocked'); return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.name));
    const fits = async label => {
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(`${font}px`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label).toBe(true);
      // A hidden horizontal overflow would conceal this regression, not repair it.
      expect(await page.evaluate(() => getComputedStyle(document.body).overflowX)).toBe('visible');
      for (const link of await page.locator('[data-store-footer] nav a').all()) {
        const box = await link.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      }
    };
    const visit = async path => {
      expect((await page.goto(origin + path)).status()).toBe(200);
      await fits(path); routes.push(path);
    };
    await visit('/products/switchback-bandana');
    const price = (await page.locator('[data-product-price]').innerText()).trim();
    originalPrice ??= price;
    expect(price).toBe(originalPrice);
    await page.getByRole('button', { name: 'Increase quantity', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-add-to-cart-qty]')).toHaveValue('2');
    await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
    await expect(page.locator('[data-add-to-cart-status]')).toHaveText('Added to cart.');
    if (capture) await page.locator('.guest-cart-add').screenshot({ path: new URL(`product-${font}-${width}.png`, output).pathname });
    await visit('/cart');
    const quantity = page.locator('[data-guest-cart-qty]');
    await expect(quantity).toHaveValue('2');
    await quantity.fill('0');
    await expect(page.locator('[data-guest-cart-checkout]')).toBeDisabled();
    await fits('invalid cart quantity');
    await quantity.fill('2');
    await expect(page.locator('[data-guest-cart-checkout]')).toBeEnabled();
    const intent = await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'));
    await visit('/checkout');
    await expect(page.locator('[data-guest-cart-checkout]')).toBeEnabled();
    await page.locator('[data-guest-cart-checkout]').click();
    const feedback = page.locator('[data-guest-cart-contact-error]');
    await expect(feedback).toHaveText('Enter your email address to continue.');
    await expect(feedback).toBeFocused();
    await expect(feedback).toBeInViewport();
    await fits('checkout contact correction');
    if (capture) await page.screenshot({ path: new URL(`checkout-${font}-${width}.png`, output).pathname });
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
    await page.getByLabel('Email', { exact: true }).fill('reflow-proof@example.test');
    await expect(feedback).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'))).toBe(intent);
    for (const path of ['/shop', '/field-note-lunch-stop', '/', '/dashboard/']) {
      await visit(path);
      if (capture && font === 32 && width === 320) {
        if (path === '/') await page.locator('.brb-field-promo').screenshot({ path: new URL('home-promo-32-320.png', output).pathname });
        if (path === '/shop') await page.locator('.shop-intro').screenshot({ path: new URL('shop-heading-32-320.png', output).pathname });
        if (path === '/field-note-lunch-stop') await page.locator('[data-store-footer]').screenshot({ path: new URL('footer-32-320.png', output).pathname });
      }
    }
    expect(starts).toEqual([]); expect(errors).toEqual([]);
    results.push({ defaultFontPixels: font, viewportWidth: width, routes, actualBrowserPreferenceVerified: true,
      noHorizontalOverflowOrConcealment: true, footerLinksFit: true, sameCommercePrice: true, keyboardQuantityAndContact: true,
      invalidCartRefusal: true, intentPreserved: true, checkoutStarts: starts.length, browserErrors: errors.length });
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
}
const evidence = { checkedAt: new Date().toISOString(), origin, scope: 'Chromium default-font preference and CSS reflow; not physical-device, OS text scaling or browser zoom coverage.', results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
