// Browser-only access to the loopback preview, with the real store origin and
// normal guest endpoints. No operator dispatcher, auth cookies or fake paid state.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
export const shopperStatePath = '/etc/backroadbum/shopper-browser.json';
export async function openShopperPreview({ saved = false, width = 1440 } = {}) {
  const publicGate = await fetch('https://backroadbum.com/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/prepare', { method: 'POST' });
  assert.equal(publicGate.status, 503, 'Public checkout must stay closed during preview');
  const state = saved ? JSON.parse(readFileSync(shopperStatePath, 'utf8')) : null;
  const origins = state?.origins?.filter(entry => entry.origin === 'https://backroadbum.com') ?? [];
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, storageState: { cookies: [], origins } });
    await context.route('https://backroadbum.com/**', async route => {
      const url = new URL(route.request().url());
      url.protocol = 'http:'; url.host = '127.0.0.1:4322';
      const headers = { ...route.request().headers(), host: 'backroadbum.com', 'x-forwarded-proto': 'https' };
      delete headers.authorization; delete headers.cookie;
      const response = await route.fetch({ url: url.href, headers, maxRedirects: 0 });
      await route.fulfill({ response });
    });
    const page = await context.newPage();
    return { browser, context, page };
  } catch (error) { await browser.close(); throw error; }
}
