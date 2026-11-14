// Product quantity correction only: actual catalog, local intent, no checkout or admin writes.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const check = process.argv.includes('--check');
const observe = process.argv.includes('--observe');
if (!check && !observe) {
  console.log('Use --check to verify product quantity feedback, or --observe to record the current rejection.');
  process.exit(0);
}
const base = process.env.STORE_URL || 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/product-quantity/', import.meta.url);
await mkdir(output, { recursive: true });
const cartKey = 'dinkus.guest-cart.v1';
const checkoutKey = 'dinkus.guest-checkout.v1';
const browser = await chromium.launch({ headless: true });
const results = [];
const writes = [];
const recorded = page => page.evaluate(([cart, checkout]) => ({ cart: localStorage.getItem(cart), checkout: localStorage.getItem(checkout) }), [cartKey, checkoutKey]);
async function contextFor(width, colorScheme, javaScriptEnabled = true) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, javaScriptEnabled, userAgent: 'BackroadBum-SelfCheck/1.0' });
  await context.route('**/*', route => {
    if (route.request().method() === 'GET') return route.continue();
    writes.push(route.request().method());
    return route.abort();
  });
  return context;
}
try {
  for (const [width, colorScheme, slug] of (observe ? [[1440, 'light', 'creekside-camp-mug'], [390, 'dark', 'creekside-camp-mug']] : [
    [1440, 'light', 'creekside-camp-mug'], [390, 'light', 'creekside-camp-mug'],
    [1440, 'dark', 'creekside-camp-mug'], [390, 'dark', 'creekside-camp-mug'], [390, 'dark', 'last-light-fleece'],
  ])) {
    const context = await contextFor(width, colorScheme);
    try {
      const page = await context.newPage();
      expect((await page.goto(base + '/products/' + slug)).status()).toBe(200);
      const input = page.getByRole('textbox', { name: 'Quantity', exact: true });
      const add = page.getByRole('button', { name: 'Add to cart', exact: true });
      const feedback = page.locator('[data-add-to-cart-status]');
      const onward = page.locator('[data-add-to-cart-view]');
      await expect(add).toHaveAttribute('data-guest-cart-ready', '1');
      if (slug === 'last-light-fleece') await page.getByRole('radio', { name: 'XL', exact: true }).check();
      const selectedId = await add.getAttribute('data-add-to-cart');
      const before = await recorded(page);
      expect(before).toEqual({ cart: null, checkout: null });
      const rejected = [];
      for (const value of observe ? ['0'] : ['0', '', '1.5', '100', '-1', 'abc']) {
        await input.fill(value);
        await add.click();
        await expect(feedback).toHaveText('Quantity must be a whole number from 1 to 99.');
        expect(await recorded(page)).toEqual(before);
        await expect(onward).toBeHidden();
        rejected.push({ value, ...await input.evaluate(el => ({ invalid: el.getAttribute('aria-invalid'), describedBy: el.getAttribute('aria-describedby'), focused: document.activeElement === el, activeTag: document.activeElement?.tagName })) });
        if (check) {
          await expect(input).toHaveAttribute('aria-invalid', 'true');
          await expect(input).toHaveAttribute('aria-describedby', await feedback.getAttribute('id'));
          await expect(input).toBeFocused();
          await expect(input).toHaveValue(value);
        }
        if (value === '0') {
          if (check) {
            const contrast = await feedback.evaluate(el => {
              const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              const rgba = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
              const backdrop = node => { for (let p = node; p; p = p.parentElement) { const rgb = rgba(getComputedStyle(p).backgroundColor); if (rgb[3] === 255) return rgb; } throw new Error('No opaque painted background'); };
              const luminance = rgb => rgb.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
              const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
              const stepper = el.closest('.guest-cart-add').querySelector('.guest-cart-add__stepper');
              return { errorText: ratio(rgba(getComputedStyle(el).color), backdrop(el)), invalidBorder: ratio(rgba(getComputedStyle(stepper).borderTopColor), backdrop(stepper)) };
            });
            expect(contrast.errorText).toBeGreaterThanOrEqual(4.5);
            expect(contrast.invalidBorder).toBeGreaterThanOrEqual(3);
            rejected.at(-1).paintedContrast = contrast;
          }
          await page.screenshot({ path: new URL(`${observe ? 'before' : 'after'}-${slug}-${width}-${colorScheme}.png`, output).pathname });
        }
        if (check) {
          await input.fill('2');
          await expect(input).not.toHaveAttribute('aria-invalid');
          await expect(input).not.toHaveAttribute('aria-describedby');
          await expect(input).toBeFocused();
          await expect(feedback).toBeHidden();
        }
      }
      if (check) {
        // Keyboard Add follows the same rejected-action focus contract.
        await input.fill('0'); await add.focus(); await page.keyboard.press('Enter');
        await expect(input).toBeFocused();
        await expect(input).toHaveAttribute('aria-invalid', 'true');
        // Programmatic stepper edits clear the correction too, without taking its focus.
        const increase = page.getByRole('button', { name: 'Increase quantity', exact: true });
        await increase.click();
        await expect(input).toHaveValue('1');
        await expect(input).not.toHaveAttribute('aria-invalid');
        await expect(increase).toBeFocused();
        await expect(feedback).toBeHidden();
        await input.fill('2'); await add.click();
        await expect(add).toBeFocused();
        await expect(feedback).toHaveText('Added to cart.');
        await expect(feedback).toHaveAttribute('role', 'status');
        await expect(onward).toBeVisible();
        const added = await recorded(page);
        expect(JSON.parse(added.cart).lines).toEqual([{ id: selectedId, quantity: 2 }]);
        expect(added.checkout).toBeNull();
        await input.fill('3');
        await expect(feedback).toHaveText('Added to cart.');
        // A combined-line limit refusal is not a malformed field value.
        await input.fill('98'); await add.click();
        await expect(add).toBeFocused();
        await expect(feedback).toHaveAttribute('role', 'alert');
        await expect(feedback).not.toHaveText('Added to cart.');
        await expect(input).not.toHaveAttribute('aria-invalid');
        await expect(onward).toBeHidden();
        expect(await recorded(page)).toEqual(added);
        await page.reload();
        expect(await recorded(page)).toEqual(added);
        await expect(page.locator('[data-guest-cart-count]')).toHaveText('2');
      }
      results.push({ width, colorScheme, slug, mode: observe ? 'observe' : 'check', rejected, final: await recorded(page) });
    } finally { await context.close(); }
  }
  if (check) {
    const native = await contextFor(390, 'dark', false);
    try {
      const page = await native.newPage(); await page.goto(base + '/products/creekside-camp-mug');
      await expect(page.locator('[data-add-to-cart-single]')).toBeHidden();
      await expect(page.locator('[data-add-to-cart-requirement]')).toBeVisible();
      await expect(page.locator('[data-add-to-cart-status]')).toBeHidden();
      expect(await recorded(page)).toEqual({ cart: null, checkout: null });
      results.push({ width: 390, colorScheme: 'dark', mode: 'no-script-inspection-only', cartControlsHidden: true });
    } finally { await native.close(); }
    const context = await contextFor(390, 'light');
    try {
      // Deliberate browser-storage refusal, not an intercepted Commerce response.
      await context.addInitScript(key => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(k, value) { if (k === key) throw new DOMException('Storage refused', 'QuotaExceededError'); return set.call(this, k, value); }; }, cartKey);
      const page = await context.newPage(); await page.goto(base + '/products/creekside-camp-mug');
      const input = page.getByRole('textbox', { name: 'Quantity', exact: true });
      const feedback = page.locator('[data-add-to-cart-status]');
      await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
      await expect(feedback).toHaveAttribute('role', 'alert');
      const failure = await feedback.textContent(); expect(failure).not.toBe('Added to cart.');
      await expect(input).not.toHaveAttribute('aria-invalid');
      await input.fill('2'); await expect(feedback).toHaveText(failure);
      await expect(page.locator('[data-add-to-cart-view]')).toBeHidden();
      expect(await recorded(page)).toEqual({ cart: null, checkout: null });
      results.push({ width: 390, colorScheme: 'light', mode: 'synthetic-storage-refusal', failureRetainedOnEdit: true });
    } finally { await context.close(); }
  }
  expect(writes).toEqual([]);
  const report = { results, nonGetRequests: writes, checkoutStarts: 0 };
  await writeFile(new URL('verification.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
