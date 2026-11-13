#!/usr/bin/env node
/** Read-only theme/browser contract. No shopper or provider mutation requests. */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const base = process.env.BASE_URL || 'https://backroadbum.com';
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: 'dark', userAgent: 'BackroadBumSelfCheck/1.0 appearance' });
    const page = await context.newPage();
    const unexpected = [];
    page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method()) || /checkout\/guest|\/payments\//.test(r.url())) unexpected.push(`${r.method()} ${new URL(r.url()).pathname}`); });
    page.on('pageerror', error => unexpected.push(error.message));
    await page.goto(base, { waitUntil: 'networkidle' });
    const select = page.locator('[data-theme-select]');
    await select.waitFor({ state: 'visible' });
    assert.equal(await select.inputValue(), 'system');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'system');
    const dark = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
    await page.emulateMedia({ colorScheme: 'light' });
    const light = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
    assert.notEqual(dark, light, 'System must track the device');
    await select.selectOption('dark');
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), dark);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await select.inputValue(), 'dark');
    await page.goto(`${base}/shop`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.locator('[data-theme-select]').inputValue(), 'dark');
    await page.locator('[data-theme-select]').selectOption('light');
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), light);
    await page.locator('[data-theme-select]').selectOption('system');
    assert.equal(await page.evaluate(() => localStorage.getItem('backroadbum.theme')), null);
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), light);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('[data-theme-select]').focus();
    assert.equal(await page.locator('[data-theme-select]').evaluate(el => el.matches(':focus')), true);
    // A second tab receives changes without a reload or polling.
    const second = await context.newPage();
    await second.goto(base, { waitUntil: 'networkidle' });
    await page.locator('[data-theme-select]').selectOption('dark');
    await second.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await second.close();
    assert.deepEqual(unexpected, []);
    results.push({ width, default: 'system', deviceChange: true, explicitChoices: true, persistedAcrossRoutes: true, crossTab: true, unexpected });
    await context.close();
  }
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: scheme, viewport: { width: 390, height: 1000 }, userAgent: 'BackroadBumSelfCheck/1.0 appearance-nojs' });
    const page = await context.newPage();
    await page.goto(base);
    assert.equal(await page.locator('[data-theme-select]').isVisible(), false);
    assert.equal(await page.locator('footer .theme-note').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    results.push({ javaScript: false, scheme, nativeAppearance: true });
    await context.close();
  }
  // An explicit preference is applied by the inline head before footer hydration.
  const context = await browser.newContext({ colorScheme: 'light' });
  await context.addInitScript(() => {
    localStorage.setItem('backroadbum.theme', 'dark');
    requestAnimationFrame(() => { window.__appearanceFirstFrame = document.documentElement.dataset.theme; });
  });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => window.__appearanceFirstFrame), 'dark');
  await context.close();
  // Storage refusal does not break the preference or render a false persisted state.
  const blocked = await browser.newContext({ colorScheme: 'light' });
  await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  const blockedPage = await blocked.newPage();
  await blockedPage.goto(base, { waitUntil: 'networkidle' });
  await blockedPage.locator('[data-theme-select]').selectOption('dark');
  assert.equal(await blockedPage.locator('html').getAttribute('data-theme'), 'dark');
  assert.match(await blockedPage.locator('[data-theme-message]').innerText(), /couldn’t save/);
  await blocked.close();
  console.log(JSON.stringify({ results, firstFramePreference: true, blockedStorage: true }, null, 2));
} finally { await browser.close(); }
