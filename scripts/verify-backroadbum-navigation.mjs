// Read-only shared navigation proof: actual link boxes, keyboard destinations and reflow.
// Full Chromium is required for the real default-font preference (not synthetic CSS zoom).
import { chromium, expect } from '@playwright/test';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/navigation/', import.meta.url);
const capture = process.argv.includes('--capture');
const mainLinks = [['Shop', '/shop'], ['Field notes', '/field-notes'], ['Search', '/search'], ['Test-store guide', '/test-store']];
const footerLinks = [['All gear', '/shop'], ['Field notes', '/field-notes'], ['Search the shop', '/search'], ['Your last checkout', '/checkout/success'], ['Test-store guide', '/test-store'], ['Shipping', '/shipping'], ['Returns', '/returns'], ['The experiment', '/dashboard/']];
const cases = [{ width: 1440, font: 16 }, { width: 390, font: 16 }, { width: 320, font: 16 }, { width: 320, font: 32 }, { width: 390, font: 16, noScript: true }];
await mkdir(output, { recursive: true });
const results = [];
for (const { width, font, noScript = false } of cases) {
  const profile = await mkdtemp(join(tmpdir(), 'backroadbum-navigation-'));
  let context;
  try {
    await mkdir(join(profile, 'Default'));
    await writeFile(join(profile, 'Default', 'Preferences'), JSON.stringify({ webkit: { webprefs: { default_font_size: font } } }));
    context = await chromium.launchPersistentContext(profile, { channel: 'chromium', viewport: { width, height: 1000 }, javaScriptEnabled: !noScript, reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    const page = await context.newPage();
    const errors = [], writes = [], checkout = [];
    page.on('pageerror', error => errors.push(error.name));
    await context.route('**/*', route => {
      const request = route.request();
      if (new URL(request.url()).origin === origin && !['GET', 'HEAD'].includes(request.method())) {
        writes.push(new URL(request.url()).pathname); return route.abort();
      }
      if (new URL(request.url()).origin === origin && /\/api\/checkout\//.test(new URL(request.url()).pathname)) checkout.push(new URL(request.url()).pathname);
      return route.continue();
    });
    const fits = async () => {
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(`${font}px`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.evaluate(() => getComputedStyle(document.body).overflowX)).toBe('visible');
    };
    expect((await page.goto(origin + '/shop')).status()).toBe(200);
    const main = page.locator('.brb-main-nav'), footer = page.locator('[data-store-footer]');
    const measurements = [];
    for (const [nav, links] of [[main, mainLinks], [footer, footerLinks]]) {
      for (const [name, href] of links) {
        const link = nav.getByRole('link', { name, exact: true });
        await expect(link).toHaveAttribute('href', href);
        await link.scrollIntoViewIfNeeded();
        const size = await link.evaluate(a => {
          const r = a.getBoundingClientRect(), style = getComputedStyle(a);
          return { name: a.textContent.trim(), width: r.width, height: r.height,
            lowerEdgeHitsLink: a.contains(document.elementFromPoint(r.x + r.width / 2, r.bottom - 3)),
            textSize: style.fontSize };
        });
        expect(size.height, name).toBeGreaterThanOrEqual(48);
        expect(size.width, name).toBeGreaterThanOrEqual(48);
        expect(size.lowerEdgeHitsLink, name).toBe(true);
        measurements.push(size);
      }
    }
    await fits();
    if (capture && !noScript) {
      await footer.screenshot({ path: new URL(`footer-${font}-${width}.png`, output).pathname });
      await page.locator('[data-store-header]').screenshot({ path: new URL(`header-${font}-${width}.png`, output).pathname });
    }
    // The padded lower edge is part of the actual anchor, not inert spacing.
    const shipping = footer.getByRole('link', { name: 'Shipping', exact: true });
    await shipping.scrollIntoViewIfNeeded();
    const box = await shipping.boundingBox();
    await shipping.click({ position: { x: box.width / 2, y: box.height - 3 } });
    await expect(page).toHaveURL(origin + '/shipping');
    await expect(page.locator('h1')).toHaveText('Shipping');
    await fits();
    // Navigate from the immediately preceding footer link by keyboard.
    await page.locator('[data-store-footer]').getByRole('link', { name: 'Shipping', exact: true }).focus();
    await page.keyboard.press('Tab');
    const returns = page.locator('[data-store-footer]').getByRole('link', { name: 'Returns', exact: true });
    await expect(returns).toBeFocused();
    const focus = await returns.evaluate(a => ({ style: getComputedStyle(a).outlineStyle, width: getComputedStyle(a).outlineWidth }));
    expect(focus.style).not.toBe('none'); expect(parseFloat(focus.width)).toBeGreaterThanOrEqual(3);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(origin + '/returns');
    await expect(page.locator('h1')).toHaveText('Returns');
    await fits();
    await page.locator('.brb-main-nav').getByRole('link', { name: 'Shop', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('.brb-main-nav').getByRole('link', { name: 'Field notes', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(origin + '/field-notes');
    await fits();
    expect(errors).toEqual([]); expect(writes).toEqual([]); expect(checkout).toEqual([]);
    results.push({ width, defaultFontPixels: font, noJavaScript: noScript, measurements, lowerEdgeNavigation: true, keyboardDestinationsAndFocus: true, noOverflowOrConcealment: true, browserErrors: errors.length, writeRequests: writes.length, checkoutRequests: checkout.length });
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
}
const evidence = { checkedAt: new Date().toISOString(), origin, scope: 'Chromium rendered target sizes, real default-font preference and keyboard navigation; not physical-device or OS text-scaling coverage.', results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
