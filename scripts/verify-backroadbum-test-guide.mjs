// Public, read-only guide checks. Fresh browser state; never start a checkout or use a receipt capability.
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const base = 'https://backroadbum.com';
const source = JSON.parse(await readFile(new URL('../seed/backroadbum-pages.json', import.meta.url), 'utf8'));
const output = new URL('../runs/backroadbum/test-guide/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const contextOptions = { reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' };
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ ...contextOptions, viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = [], writes = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(new URL(request.url()).pathname); });
    const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const slug of ['test-store', 'shipping']) {
      expect((await page.goto(base + '/' + slug)).status()).toBe(200);
      const guide = source.find(item => item.slug === slug);
      await expect(page.locator('h1')).toHaveText(guide.title);
      const body = page.locator(slug === 'test-store' ? '[data-cms-page-body]' : '[data-policy-body]');
      const rendered = await body.locator(':scope > p, :scope > h2').evaluateAll(elements => elements
        .filter(element => element.textContent.trim()).map(element => [element.tagName === 'H2' ? 'h2' : 'normal', element.textContent]));
      expect(rendered).toEqual(guide.sections);
      await expect(body).not.toContainText(/five products|automation is not connected|receipt then shows Demo fulfillment complete/);
      await fits();
      if (slug === 'test-store') {
        await expect(body).toContainText('4242 4242 4242 4242');
        const actions = page.getByRole('navigation', { name: 'Ready to try it?', exact: true });
        const shop = actions.getByRole('link', { name: 'Browse the gear', exact: true });
        const receipt = actions.getByRole('link', { name: 'Open your last checkout', exact: true });
        await expect(shop).toHaveAttribute('href', '/shop');
        await expect(receipt).toHaveAttribute('href', '/checkout/success');
        for (const link of [shop, receipt]) expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(48);
        await shop.focus(); await page.keyboard.press('Tab'); await expect(receipt).toBeFocused();
        const focusStyle = await receipt.evaluate(link => getComputedStyle(link).outlineStyle);
        expect(focusStyle).not.toBe('none');
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: new URL(`guide-${width}.png`, output).pathname, fullPage: true });
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(base + '/checkout/success');
        await expect(page.locator('main')).toContainText('No saved checkout in this browser');
        await page.goto(base + '/test-store');
        await page.getByRole('navigation', { name: 'Ready to try it?', exact: true }).getByRole('link', { name: 'Browse the gear', exact: true }).click();
        await expect(page).toHaveURL(base + '/shop');
        await expect(page.locator('[data-commerce-product]')).toHaveCount(6);
      } else {
        await expect(page.locator('[data-policy-recovery] a')).toHaveAttribute('href', '/checkout/success');
        await expect(page.locator('.test-store-actions')).toHaveCount(0);
      }
    }
    for (const slug of ['returns', 'field-note-wet-gear-reset', 'field-note-not-published']) {
      const response = await page.goto(base + '/' + slug);
      expect(response.status()).toBe(slug === 'field-note-not-published' ? 404 : 200);
      await expect(page.locator('.test-store-actions')).toHaveCount(0);
      await fits();
    }
    expect(errors).toEqual([]); expect(writes).toEqual([]);
    results.push({ width, guideAndShippingMatchCMS: true, keyboardRecovery: true, emptyBrowserRecovery: true, shopPath: true, noOverflow: true, browserErrors: 0, writes: 0 });
    await context.close();
  }
  const context = await browser.newContext({ ...contextOptions, javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const writes = [], checkoutRequests = [];
  page.on('request', request => {
    if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.method());
    if (new URL(request.url()).pathname.startsWith('/api/checkout/')) checkoutRequests.push(request.method());
  });
  for (const slug of ['shipping', 'test-store']) {
    expect((await page.goto(base + '/' + slug)).status()).toBe(200);
    const body = page.locator(slug === 'test-store' ? '[data-cms-page-body]' : '[data-policy-body]');
    expect(await body.locator(':scope > p, :scope > h2').evaluateAll(elements => elements
      .filter(element => element.textContent.trim()).map(element => [element.tagName === 'H2' ? 'h2' : 'normal', element.textContent])))
      .toEqual(source.find(item => item.slug === slug).sections);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const actions = page.getByRole('navigation', { name: 'Ready to try it?', exact: true });
  await expect(actions.getByRole('link', { name: 'Open your last checkout', exact: true })).toHaveAttribute('href', '/checkout/success');
  await actions.getByRole('link', { name: 'Browse the gear', exact: true }).click();
  await expect(page).toHaveURL(base + '/shop');
  expect(writes).toEqual([]); expect(checkoutRequests).toEqual([]);
  results.push({ javaScript: false, guideAndShippingMatchCMS: true, noOverflow: true, shopLinkWorks: true, receiptLinkPresent: true, writes: 0, checkoutRequests: 0 });
  await context.close();
} finally { await browser.close(); }
const evidence = { verifiedAt: new Date().toISOString(), base, results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
