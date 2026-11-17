// Real storefront contact corrections and catalog reads; synthetic capability
// transport intercepts every POST so validation checks cannot start a payment.
import { chromium, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const origin = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
const capture = process.argv.includes('--capture');
const dir = 'runs/backroadbum/contact-feedback';
if (capture) mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) for (const mode of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: mode, userAgent: 'BackroadBum-SelfCheck/1.0', reducedMotion: 'reduce' });
    const starts = [], errors = [];
    const prepared = { ok: true, capabilityId: 'synthetic-contact-cap', capability: { capabilityId: 'synthetic-contact-cap', capability: 'synthetic-contact-cap.secret', retention: 'json-body', header: 'x-commerce-guest-capability' },
      checkout: { schema: 'dinkuskit.commerce.guest-checkout-projection/v1', state: 'pending', attemptId: null, lines: [], total: null, redirectUrl: null, order: null, retryAfter: null, unavailable: null } };
    await context.route('**/*', route => {
      const request = route.request();
      if (['GET', 'HEAD'].includes(request.method())) return route.continue();
      const path = new URL(request.url()).pathname;
      if (/\/checkout\/guest\/(?:prepare|status)$/.test(path)) return route.fulfill({ json: prepared });
      starts.push(path); return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.name));
    await page.goto(origin + '/products/switchback-bandana');
    await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
    await expect(page.locator('[data-add-to-cart-status]')).toHaveText('Added to cart.');
    await page.goto(origin + '/checkout');
    const button = page.locator('[data-guest-cart-checkout]');
    const feedback = page.locator('[data-guest-cart-contact-error="email"]');
    const email = page.getByLabel('Email', { exact: true });
    await expect(button).toBeEnabled();
    const intent = await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'));
    const correction = async (text, name) => {
      const error = page.locator(`[data-guest-cart-contact-error="${name}"]`);
      const field = page.locator(`[data-guest-cart-${name}]`);
      await button.click();
      await expect(error).toHaveText(text);
      await expect(field).toBeFocused();
      await expect(field).toHaveAttribute('aria-invalid', 'true');
      // Focus scrolling can place a field under the pointer; inspect its
      // invalid border outside the separate accent-colored hover state.
      await page.mouse.move(0, 0);
      const danger = await field.evaluate(element => {
        const probe = document.createElement('span'); probe.style.borderTopColor = 'var(--color-danger)';
        element.parentElement.append(probe); const color = getComputedStyle(probe).borderTopColor; probe.remove(); return color;
      });
      await expect(field).toHaveCSS('border-top-color', danger);
      await expect(field).toHaveCSS('border-top-width', '2px');
      await expect(field).toHaveAttribute('aria-describedby', `guest-cart-${name}-error`);
      await expect(error).toBeInViewport();
      await expect(error).toHaveAttribute('role', 'alert');
    };
    await correction('Enter your email address to continue.', 'email');
    if (capture) await page.screenshot({ path: `${dir}/email-${width}-${mode}.png` });
    await expect(email).toBeFocused();
    await email.fill('not-an-email');
    await expect(feedback).toBeHidden(); await expect(email).toBeFocused();
    await correction('Enter a valid email address to continue.', 'email');
    await email.fill('contact-proof@example.test');
    await correction('Enter the delivery recipient name to continue.', 'delivery-name');
    if (capture) await page.screenshot({ path: `${dir}/untouched-${width}-${mode}.png` });
    await page.getByLabel('Billing address same as delivery address').uncheck();
    await correction('Enter the delivery recipient name to continue.', 'delivery-name');
    await page.getByLabel('Billing address same as delivery address').check();
    await page.getByLabel('Recipient', { exact: true }).fill('Test shopper');
    await expect(page.locator('[data-guest-cart-contact-error="delivery-name"]')).toBeHidden();
    await correction('Enter the delivery address line 1 to continue.', 'delivery-line1');
    await page.getByLabel('Address line 1', { exact: true }).fill('510 Townsend St');
    await page.getByLabel('City', { exact: true }).fill('San Francisco');
    await page.getByLabel('Country', { exact: true }).selectOption('US');
    await correction('Enter the delivery postal code to continue.', 'delivery-postal-code');
    if (capture) await page.screenshot({ path: `${dir}/postal-${width}-${mode}.png` });
    await page.getByLabel('Postal code', { exact: true }).fill('94103');
    await correction('Enter a state for United States delivery.', 'delivery-region');
    if (capture) await page.screenshot({ path: `${dir}/delivery-${width}-${mode}.png` });
    await page.getByLabel('State or region (required for United States delivery)', { exact: true }).fill('CA');
    await page.getByLabel('Billing address same as delivery address').uncheck();
    await correction('Enter the billing name to continue.', 'billing-name');
    await page.getByLabel('Billing name', { exact: true }).fill('Test payer');
    await page.getByLabel('Billing address line 1', { exact: true }).fill('510 Townsend St');
    await page.getByLabel('Billing city', { exact: true }).fill('San Francisco');
    await page.getByLabel('Billing country', { exact: true }).selectOption('US');
    await correction('Enter the billing postal code to continue.', 'billing-postal-code');
    if (capture) await page.screenshot({ path: `${dir}/billing-${width}-${mode}.png` });
    await page.getByLabel('Billing postal code', { exact: true }).fill('94103');
    await page.getByLabel('Billing city', { exact: true }).fill('');
    await correction('Enter the billing city to continue.', 'billing-city');
    const country = page.getByLabel('Billing country', { exact: true });
    await country.focus(); await country.selectOption('CA');
    const cityError = page.locator('[data-guest-cart-contact-error="billing-city"]');
    await expect(cityError).toBeVisible(); await expect(country).toBeFocused();
    const city = page.getByLabel('Billing city', { exact: true });
    await city.fill('San Francisco');
    await expect(cityError).toBeHidden(); await expect(city).toBeFocused();
    await expect(city).not.toHaveAttribute('aria-invalid');
    await expect(city).not.toHaveAttribute('aria-describedby');
    await country.selectOption('');
    await correction('Choose a billing country to continue.', 'billing-country');
    await country.selectOption('CA');
    await expect(page.locator('[data-guest-cart-contact-error="billing-country"]')).toBeHidden();
    await expect(country).toBeFocused();
    await expect(country).not.toHaveAttribute('aria-invalid');
    await expect(country).not.toHaveAttribute('aria-describedby');
    await expect(email).toHaveValue('contact-proof@example.test');
    await expect(page.getByLabel('Recipient', { exact: true })).toHaveValue('Test shopper');
    expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'))).toBe(intent);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(starts).toEqual([]); expect(errors).toEqual([]);
    results.push({ width, mode, invalidCases: 11, untouchedDeliveryCorrection: true, fieldSpecificAddressCorrections: true, firstInvalidFieldFocusedAndErrorVisible: true, editingUnrelatedFieldPreservesCorrection: true,
      clearsOnInputAndSelectWithoutFocusChange: true, contactAndIntentPreserved: true, noOverflow: true, checkoutStarts: 0, browserErrors: 0 });
    await context.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), scope: 'Live catalog/markup and synthetic capability transport; every non-read request intercepted. No server contact submission, capability preparation or payment start.', results }, null, 2));
