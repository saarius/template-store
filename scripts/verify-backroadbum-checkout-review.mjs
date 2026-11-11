// Public checkout presentation proof. Fresh browser-local carts only; never starts a payment.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.BACKROADBUM_VERIFY_URL ?? 'https://backroadbum.com';
const baseline = process.argv.includes('--expect-contact-first');
const capture = process.argv.includes('--capture');
const output = new URL('../runs/backroadbum/checkout-review/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const money = minor => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(minor) / 100);
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width === 390, userAgent: 'BackroadBum-SelfCheck/1.0' });
    const page = await context.newPage();
    const errors = [], starts = [];
    page.on('pageerror', error => errors.push(error.name));
    await context.route('**/checkout/guest/start', route => { starts.push('blocked unexpected checkout start'); return route.abort(); });
    let subtotalMinor = 0;
    for (const size of ['M', 'L']) {
      await page.goto(base + '/products/wrong-turn-tee');
      await page.locator(`[data-variant-choice][value="${size}"]`).check();
      const id = await page.locator('[data-commerce-item]').getAttribute('data-commerce-item');
      const response = await context.request.get(base + '/api/guest-cart/snapshot?ids=' + encodeURIComponent(id));
      expect(response.ok()).toBe(true);
      const product = (await response.json()).products[0];
      expect(product.found && product.availability.sellable).toBe(true);
      subtotalMinor += Number(product.price.unitMinor);
      await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
      await expect(page.locator('[data-add-to-cart-status]')).toHaveText('Added to cart.');
    }
    await page.goto(base + '/checkout');
    const manifest = page.locator('[data-checkout-manifest]');
    const vault = page.locator('[data-checkout-vault]');
    const subtotal = page.locator('[data-guest-cart-subtotal-amount]');
    const email = page.locator('[data-guest-cart-email]');
    const quantities = page.locator('[data-guest-cart-qty]');
    const button = page.locator('[data-guest-cart-checkout]');
    await expect(manifest).toBeVisible();
    await expect(subtotal).toHaveText(money(subtotalMinor));
    await expect(quantities).toHaveCount(2);
    await expect(manifest.getByRole('heading', { name: 'Wrong Turn Tee — M', exact: true })).toBeVisible();
    await expect(manifest.getByRole('heading', { name: 'Wrong Turn Tee — L', exact: true })).toBeVisible();
    const positions = await page.evaluate(() => {
      const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, bottom: r.bottom + scrollY }; };
      const manifest = document.querySelector('[data-checkout-manifest]');
      const vault = document.querySelector('[data-checkout-vault]');
      return { manifest: box('[data-checkout-manifest]'), vault: box('[data-checkout-vault]'), handoff: box('[data-checkout-payment-handoff]'), reviewFirstInDom: Boolean(manifest.compareDocumentPosition(vault) & Node.DOCUMENT_POSITION_FOLLOWING) };
    });
    expect(positions.reviewFirstInDom).toBe(!baseline);
    if (width <= 864) {
      if (baseline) expect(positions.manifest.y).toBeGreaterThan(positions.handoff.bottom);
      else expect(positions.manifest.bottom).toBeLessThanOrEqual(positions.vault.y);
    } else {
      expect(positions.manifest.x).toBeGreaterThan(positions.vault.x);
      expect(Math.abs(positions.manifest.y - positions.vault.y)).toBeLessThan(1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    if (capture) await page.screenshot({ path: new URL(`${baseline ? 'before' : 'after'}-${width}.png`, output).pathname, fullPage: true });
    if (!baseline) {
      for (const control of [quantities.first(), page.locator('[data-guest-cart-remove]').first(), page.getByRole('link', { name: 'Edit cart', exact: true })]) {
        expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
      }
      // A narrow phone still fits the real rows and long pre-quote labels.
      if (width === 390) {
        await page.setViewportSize({ width: 320, height: 800 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (capture) await page.screenshot({ path: new URL('after-320.png', output).pathname });
        await page.setViewportSize({ width, height: 1000 });
      }
      await page.getByRole('link', { name: 'Edit cart', exact: true }).focus();
      expect(await page.getByRole('link', { name: 'Edit cart', exact: true }).evaluate(e => getComputedStyle(e).outlineStyle)).not.toBe('none');
      await email.fill('review-check@example.com');
      // The summary is editable before contact entry, but never owns price or admission.
      await quantities.first().fill('0');
      await expect(page.locator('[data-checkout-breakdown]')).toBeHidden();
      await expect(button).toBeDisabled();
      await expect(quantities.first()).toHaveAttribute('aria-invalid', 'true');
      await expect(email).toHaveValue('review-check@example.com');
      await quantities.first().fill('1');
      await expect(subtotal).toHaveText(money(subtotalMinor));
      await expect(button).toBeEnabled();
      // Follow source order with the keyboard: last summary action, then form guidance/contact.
      const lastRemove = page.locator('[data-guest-cart-remove]').last();
      await lastRemove.focus(); await page.keyboard.press('Tab');
      await expect(vault.getByRole('link', { name: 'Test-store guide', exact: true })).toBeFocused();
      await page.keyboard.press('Tab'); await expect(email).toBeFocused();
      // Removal and empty recovery stay with the existing client.
      if (width === 390) await page.locator('[data-guest-cart-remove]').first().tap();
      else await page.locator('[data-guest-cart-remove]').first().click();
      await expect(quantities).toHaveCount(1);
      await expect(quantities.first()).toBeFocused();
      await page.locator('[data-guest-cart-remove]').first().click();
      await expect(page.locator('[data-guest-cart-empty]')).toBeVisible();
      await expect(manifest).toBeHidden(); await expect(button).toBeDisabled();
    }
    expect(starts).toEqual([]); expect(errors).toEqual([]);
    results.push({ width, positions, commerceSubtotal: money(subtotalMinor), distinctSizeLines: true, noOverflow: true,
      editsKeyboardAndEmptyChecked: !baseline, touchRemovalChecked: !baseline && width === 390,
      checkoutStarts: starts.length, browserErrors: errors.length });
    await context.close();
  }
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 }, userAgent: 'BackroadBum-SelfCheck/1.0' });
  const page = await context.newPage(); await page.goto(base + '/checkout');
  const notice = page.locator('[data-checkout-no-script]');
  if (baseline) await expect(notice).toHaveCount(0);
  else {
    await expect(notice).toContainText('Checkout needs JavaScript');
    await expect(notice.getByRole('link', { name: 'browse the gear', exact: true })).toHaveAttribute('href', '/shop');
    await expect(page.locator('.guest-checkout-grid')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (capture) await page.screenshot({ path: new URL('no-script-390.png', output).pathname });
  }
  await context.close();
} finally { await browser.close(); }
const report = { checkedAt: new Date().toISOString(), baseline, scope: 'Chromium viewports, real published Commerce facts; browser-local cart edits and normal capability preparation only. No payment start, contact submission or merchant write.', results, noJavaScriptFallbackChecked: !baseline };
await writeFile(new URL(baseline ? 'baseline.json' : 'verification.json', output), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
