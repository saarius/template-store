// Read-only product identity proof. Synthetic cases change only a local HTML response's picker data.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/visible-identifiers/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    for (const mode of ['enhanced', 'no-javascript', 'synthetic-picker']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, javaScriptEnabled: mode !== 'no-javascript',
        userAgent: 'BackroadBum-SelfCheck/1.0', reducedMotion: 'reduce' });
      try {
        const mutations = [], errors = [];
        await context.route('**/*', route => {
          if (!['GET', 'HEAD'].includes(route.request().method())) {
            mutations.push(new URL(route.request().url()).pathname); return route.abort();
          }
          return route.fallback();
        });
        if (mode === 'synthetic-picker') await context.route('**/products/wrong-turn-tee*', async route => {
          const response = await route.fetch();
          let html = await response.text();
          // This is a browser-only consumer fixture, NOT evidence of a new signed public projection or SSR.
          html = html.replace(/(<script\b[^>]*data-variant-members[^>]*>)([\s\S]*?)(<\/script>)/, (_, open, raw, close) => {
            const members = JSON.parse(raw).map(member => member.values.Size === 'XL'
              ? { ...member, sku: undefined } : { ...member, sku: `FIXTURE-${member.values.Size}` });
            return open + JSON.stringify(members) + close;
          });
          return route.fulfill({ response, body: html });
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.name));
        const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect((await page.goto(origin + '/products/wrong-turn-tee')).status()).toBe(200);
        const members = JSON.parse(await page.locator('[data-variant-members]').textContent());
        const row = page.locator('[data-product-sku]');
        const checkSku = async member => {
          if (member.sku) {
            await expect(row).toBeVisible(); await expect(row).toHaveText(`SKU ${member.sku}`);
            await expect(row).toHaveAttribute('data-product-sku', member.sku);
          } else {
            await expect(row).toBeHidden(); await expect(row).toHaveAttribute('data-product-sku', '');
            expect(await row.textContent()).not.toContain('BRB-TEE-M');
          }
          await expect(page.locator('[data-product-gtin], [data-product-mpn]')).toHaveCount(0);
          await expect(page.locator('[data-product-price]')).toHaveText(member.price);
          await expect(page.locator('[data-product-status]')).toHaveText(member.status);
        };
        if (mode !== 'synthetic-picker') await checkSku(members.find(member => member.values.Size === 'M'));
        for (const size of ['L', 'XL', 'M']) {
          const member = members.find(member => member.values.Size === size);
          if (mode === 'no-javascript') {
            await page.getByLabel('View a product option', { exact: true }).selectOption(member.id);
            await page.getByRole('button', { name: 'View option', exact: true }).click();
          } else {
            const input = page.locator(`[data-variant-choice][value="${size}"]`);
            await input.focus(); await input.press('Space');
            await expect(input).toBeChecked(); await expect(input).toBeFocused();
            expect(await input.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none');
            await expect(page.locator('[data-add-to-cart]')).toHaveAttribute('data-add-to-cart', member.id);
            await expect(page.locator('[data-add-to-cart]')).toBeEnabled({ enabled: member.sellable });
          }
          expect(new URL(page.url()).searchParams.get('item')).toBe(member.id);
          await checkSku(member); await fits();
          if (size === 'L') await page.locator('.product-detail__body').screenshot({ path: new URL(`${mode}-${width}.png`, output).pathname });
        }
        // A new GET also proves the server never substitutes a default identity for a stale selection.
        await page.goto(origin + '/products/wrong-turn-tee?item=removed-option');
        await expect(row).toBeHidden(); await expect(row).toHaveAttribute('data-product-sku', '');
        await expect(page.locator('[data-product-price]')).toBeHidden();
        await expect(page.locator('[data-product-selection-notice]')).toBeVisible();
        if (mode !== 'no-javascript') {
          await page.locator('[data-variant-choice][value="L"]').check();
          await checkSku(members.find(member => member.values.Size === 'L'));
        }
        await page.goto(origin + '/products/switchback-bandana');
        const simpleSku = await row.getAttribute('data-product-sku');
        expect(simpleSku?.length).toBeGreaterThan(0);
        await expect(row).toBeVisible(); await expect(row).toHaveText(`SKU ${simpleSku}`);
        await fits(); expect(errors).toEqual([]); expect(mutations).toEqual([]);
        results.push({ width, mode, exactMemberSkuOrOmission: true, noInheritedGtinMpn: true,
          pricesAndAvailabilityUnchanged: true, staleSelectionOmitsIdentifiers: true, simpleProductSkuRetained: true,
          keyboardFocusRetained: mode !== 'no-javascript', noOverflow: true, pageErrors: 0, mutativeRequests: 0 });
      } finally { await context.close(); }
    }
  }
} finally { await browser.close(); }
const evidence = { checkedAt: new Date().toISOString(), origin,
  scope: 'Live signed legacy SSR/GET and enhanced selections; synthetic optional-SKU client transitions only. No cart, payment, merchant or provider writes.', results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
