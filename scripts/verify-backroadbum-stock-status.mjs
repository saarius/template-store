// Read-only public option-feedback proof. No merchant session or checkout start.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/stock-status/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];

async function liveProperties(context, page) {
  const session = await context.newCDPSession(page);
  try {
    await session.send('DOM.enable');
    await session.send('Accessibility.enable');
    const { root } = await session.send('DOM.getDocument');
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-product-status]' });
    const { nodes } = await session.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
    const node = nodes.find(node => node.role?.value === 'status');
    expect(node).toBeDefined();
    const properties = Object.fromEntries(node.properties.map(property => [property.name, property.value.value]));
    expect(properties.live).toBe('polite');
    expect(properties.atomic).toBe(true);
    return { role: node.role.value, live: properties.live, atomic: properties.atomic };
  } finally { await session.detach(); }
}

try {
  for (const width of [1440, 390]) for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme,
      reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    try {
      const page = await context.newPage(), writes = [], errors = [], checkoutRequests = [];
      page.on('pageerror', error => errors.push(error.name));
      page.on('request', request => { if (/\/checkout\//.test(new URL(request.url()).pathname)) checkoutRequests.push(request.method()); });
      await context.route('**/*', route => {
        if (['GET', 'HEAD'].includes(route.request().method())) return route.continue();
        writes.push(route.request().method()); return route.abort();
      });
      const observed = [];
      for (const [slug, xlStatus, xlAvailability, sellable] of [
        ['last-light-fleece', 'Available on backorder', 'available-on-backorder', true],
        ['wrong-turn-tee', 'Out of stock', 'out-of-stock', false],
      ]) {
        expect((await page.goto(`${base}/products/${slug}`)).status()).toBe(200);
        await expect(page.locator('[data-variant-picker-ready]')).toHaveCount(1);
        const status = page.locator('[data-product-status]'), originalStatus = await status.elementHandle();
        await expect(status).toHaveAttribute('role', 'status');
        await expect(status).toHaveAttribute('aria-atomic', 'true');
        await expect(status).toHaveText('In stock');
        const properties = await liveProperties(context, page);
        const members = JSON.parse(await page.locator('[data-variant-members]').textContent());
        const xlMember = members.find(member => member.values.Size === 'XL');
        expect(xlMember).toBeDefined();
        const originalPrice = await page.locator('[data-product-price]').innerText();
        const cart = JSON.stringify({ version: 1, lines: [{ id: members[0].id, quantity: 2 }] });
        await page.evaluate(value => localStorage.setItem('dinkus.guest-cart.v1', value), cart);
        const xl = page.getByRole('radio', { name: sellable ? 'XL' : 'XL (sold out)', exact: true });
        await xl.focus(); await page.keyboard.press('Space');
        await expect(xl).toBeChecked(); await expect(xl).toBeFocused();
        await expect(status).toHaveText(xlStatus);
        await expect(status).toHaveAttribute('data-availability-status', xlAvailability);
        expect(await status.evaluate((node, original) => node === original, originalStatus)).toBe(true);
        await liveProperties(context, page);
        const add = page.locator('[data-add-to-cart]');
        await expect(add).toHaveAttribute('data-add-to-cart', xlMember.id);
        if (sellable) await expect(add).toBeEnabled(); else await expect(add).toBeDisabled();
        expect(new URL(page.url()).searchParams.get('item')).toBe(xlMember.id);
        expect(await page.locator('[data-product-price]').innerText()).toBe(originalPrice);
        const selectedData = JSON.parse(await page.locator('[data-product-jsonld]').textContent());
        expect(selectedData.offers.availability).toBe(`https://schema.org/${sellable ? 'BackOrder' : 'OutOfStock'}`);
        // Arrow-key navigation updates the same live region and keeps native radio focus.
        await page.keyboard.press('ArrowLeft');
        await expect(page.getByRole('radio', { name: 'L', exact: true })).toBeChecked();
        await expect(page.getByRole('radio', { name: 'L', exact: true })).toBeFocused();
        await expect(status).toHaveText('In stock');
        expect(await status.evaluate((node, original) => node === original, originalStatus)).toBe(true);
        expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'))).toBe(cart);
        expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-checkout.v1'))).toBeNull();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        observed.push({ slug, xlStatus, properties, sameStatusNode: true, keyboardFocusRetained: true,
          selectedMemberAndAvailability: true, priceMetadataCartPreserved: true });
        if (slug === 'last-light-fleece') {
          // Capture the changed state without moving the shopper's keyboard focus.
          await xl.focus(); await page.keyboard.press('Space');
          await page.evaluate(() => document.fonts.ready);
          await page.locator('.product-detail__body').screenshot({ path: new URL(`fleece-${width}-${colorScheme}.png`, output).pathname });
        }
        await originalStatus.dispose();
      }
      await page.goto(`${base}/products/creekside-camp-mug`);
      await expect(page.locator('[data-product-status]')).not.toHaveAttribute('role');
      await expect(page.locator('[data-product-status]')).not.toHaveAttribute('aria-atomic');
      expect(writes).toEqual([]); expect(errors).toEqual([]); expect(checkoutRequests).toEqual([]);
      results.push({ width, colorScheme, observed, simpleProductUnchanged: true, writes: 0, errors: 0, checkoutRequests: 0 });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
const evidence = { verifiedAt: new Date().toISOString(), base,
  scope: 'Chromium DOM/accessibility-tree and keyboard proof, not a physical screen-reader announcement test.', results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
