// Read-only native-published tee-fit proof. Never adds a cart or starts a payment.
import { chromium, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const source = JSON.parse(await readFile(new URL('../seed/backroadbum-tee-fit.json', import.meta.url), 'utf8'));
const base = process.env.BACKROADBUM_VERIFY_BASE ?? 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/tee-fit/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390, 320]) {
    for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, javaScriptEnabled, userAgent: 'BackroadBum-SelfCheck/1.0', reducedMotion: 'reduce' });
      const page = await context.newPage();
      const writes = [], errors = [], checkout = [];
      page.on('request', request => {
        if (!['GET', 'HEAD'].includes(request.method())) writes.push(new URL(request.url()).pathname);
        if (new URL(request.url()).pathname.startsWith('/api/checkout/')) checkout.push(new URL(request.url()).pathname);
      });
      page.on('pageerror', error => errors.push(error.message));
      expect((await page.goto(base + '/products/' + source.slug)).status()).toBe(200);
      await expect(page.locator('h1')).toHaveText('Wrong Turn Tee');
      const summary = page.locator('[data-product-summary]');
      await expect(summary.locator('p').first()).toHaveText(source.summary);
      const link = summary.getByRole('link', { name: source.link.text, exact: true });
      await expect(link).toHaveAttribute('href', source.link.href);
      const price = await page.locator('[data-product-price]').innerText();
      let member = null;
      if (javaScriptEnabled) {
        const option = page.getByRole('radio', { name: 'L', exact: true });
        await option.check();
        member = await option.inputValue();
        await expect(option).toBeChecked();
      }
      const storage = javaScriptEnabled ? await page.evaluate(() => JSON.stringify(localStorage)) : null;
      await page.keyboard.press('Tab');
      await link.focus();
      expect(await link.evaluate(element => getComputedStyle(element).textDecorationLine)).toContain('underline');
      expect(await link.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(source.link.href + '$'));
      const details = page.locator('#product-details');
      await expect(details).toBeFocused();
      await expect(details.locator('summary').first()).toHaveText(source.heading);
      await expect(details.locator('details').first()).toHaveAttribute('open', '');
      await expect(details).toContainText(source.instructions);
      await expect(details).toContainText(source.scope);
      const specs = details.getByRole('region', { name: source.tableHeading, exact: true });
      await expect(specs.locator('dt')).toHaveText(source.rows.map(row => row.label));
      await expect(specs.locator('dd')).toHaveText(source.rows.map(row => row.value));
      await expect(details.locator('summary').last()).toHaveText('Design & care');
      expect(await page.locator('[data-product-price]').innerText()).toBe(price);
      if (javaScriptEnabled) {
        await expect(page.getByRole('radio', { name: 'L', exact: true })).toBeChecked();
        expect(await page.getByRole('radio', { name: 'L', exact: true }).inputValue()).toBe(member);
        expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storage);
      } else {
        await expect(page.getByRole('button', { name: 'Add to cart', exact: true })).not.toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: new URL(`fit-${width}-${javaScriptEnabled ? 'js' : 'no-js'}.png`, output).pathname, fullPage: true });
      expect(writes).toEqual([]); expect(checkout).toEqual([]); expect(errors).toEqual([]);
      results.push({ width, javaScriptEnabled, sourceExact: true, keyboardAnchorFocus: true, selectedMemberRetained: javaScriptEnabled ? true : null, commercePriceUnchanged: true, cartUntouched: true, noOverflow: true, writes: 0, checkoutRequests: 0, pageErrors: 0 });
      await context.close();
    }
  }
} finally { await browser.close(); }
const evidence = { checkedAt: new Date().toISOString(), results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
