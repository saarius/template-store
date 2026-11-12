// Real storefront contact correction; fresh browser-local cart, all payment starts blocked.
import { chromium, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const origin = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com';
const capture = process.argv.includes('--capture');
const dir = 'runs/backroadbum/contact-feedback';
if (capture) mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, userAgent: 'BackroadBum-SelfCheck/1.0', reducedMotion: 'reduce' });
    const starts = [], errors = [];
    await context.route(url => /\/(?:checkout\/start|checkout\/guest\/start)$/.test(url.pathname), route => {
      starts.push('blocked'); return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.name));
    await page.goto(origin + '/products/switchback-bandana');
    await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
    await expect(page.locator('[data-add-to-cart-status]')).toHaveText('Added to cart.');
    await page.goto(origin + '/checkout');
    const button = page.locator('[data-guest-cart-checkout]');
    const feedback = page.locator('[data-guest-cart-contact-error]');
    const email = page.getByLabel('Email', { exact: true });
    await expect(button).toBeEnabled();
    const intent = await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'));
    const correction = async text => {
      await button.click();
      await expect(feedback).toHaveText(text);
      await expect(feedback).toBeFocused();
      await expect(feedback).toBeInViewport();
      await expect(feedback).toHaveAttribute('role', 'alert');
    };
    await correction('Enter your email address to continue.');
    if (capture) await page.screenshot({ path: `${dir}/email-${width}.png` });
    await page.keyboard.press('Tab'); await expect(email).toBeFocused();
    await email.fill('not-an-email');
    await expect(feedback).toBeHidden(); await expect(email).toBeFocused();
    await correction('Enter a valid email address to continue.');
    await email.fill('contact-proof@example.test');
    await page.getByLabel('Recipient', { exact: true }).fill('Test shopper');
    await correction('Enter the delivery address line 1 to continue.');
    await page.getByLabel('Address line 1', { exact: true }).fill('510 Townsend St');
    await page.getByLabel('City', { exact: true }).fill('San Francisco');
    await page.getByLabel('Country', { exact: true }).selectOption('US');
    await correction('Enter the delivery postal code to continue.');
    if (capture) await page.screenshot({ path: `${dir}/postal-${width}.png` });
    await page.getByLabel('Postal code', { exact: true }).fill('94103');
    await correction('Enter a state for United States delivery.');
    if (capture) await page.screenshot({ path: `${dir}/delivery-${width}.png` });
    await page.getByLabel('State or region (required for United States delivery)', { exact: true }).fill('CA');
    await page.getByLabel('Billing address same as delivery address').uncheck();
    await correction('Enter the billing name to continue.');
    await page.getByLabel('Billing name', { exact: true }).fill('Test payer');
    await page.getByLabel('Billing address line 1', { exact: true }).fill('510 Townsend St');
    await page.getByLabel('Billing city', { exact: true }).fill('San Francisco');
    await page.getByLabel('Billing country', { exact: true }).selectOption('US');
    await correction('Enter the billing postal code to continue.');
    if (capture) await page.screenshot({ path: `${dir}/billing-${width}.png` });
    await page.getByLabel('Billing postal code', { exact: true }).fill('94103');
    await page.getByLabel('Billing city', { exact: true }).fill('');
    await correction('Enter the billing city to continue.');
    const country = page.getByLabel('Billing country', { exact: true });
    await country.focus(); await country.selectOption('CA');
    await expect(feedback).toBeHidden(); await expect(country).toBeFocused();
    await expect(email).toHaveValue('contact-proof@example.test');
    await expect(page.getByLabel('Recipient', { exact: true })).toHaveValue('Test shopper');
    expect(await page.evaluate(() => localStorage.getItem('dinkus.guest-cart.v1'))).toBe(intent);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(starts).toEqual([]); expect(errors).toEqual([]);
    results.push({ width, invalidCases: 8, fieldSpecificAddressCorrections: true, errorFocusedAndVisible: true, tabToEmail: true,
      clearsOnInputAndSelectWithoutFocusChange: true, contactAndIntentPreserved: true, noOverflow: true, checkoutStarts: 0, browserErrors: 0 });
    await context.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), scope: 'Live Commerce catalog and normal capability preparation; local contact validation only. No start or contact submission.', results }, null, 2));
