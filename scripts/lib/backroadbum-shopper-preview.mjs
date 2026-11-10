// Browser-only access to the loopback preview, with the real store origin and
// normal guest endpoints. No operator dispatcher, auth cookies or fake paid state.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
export const shopperStatePath = '/etc/backroadbum/shopper-browser.json';
export async function openShopperPreview({ saved = false, width = 1440, statePath = shopperStatePath, publicStore = false } = {}) {
  if (publicStore) {
    const health = await fetch('https://backroadbum.com/api/checkout/health');
    assert.equal(health.status, 200, 'Public test checkout must be ready');
    assert.equal((await health.json()).mode, 'test');
  }
  const state = saved ? JSON.parse(readFileSync(statePath, 'utf8')) : null;
  const origins = state?.origins?.filter(entry => entry.origin === 'https://backroadbum.com') ?? [];
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, storageState: { cookies: [], origins } });
    if (!publicStore) await context.route('https://backroadbum.com/**', async route => {
      const url = new URL(route.request().url());
      url.protocol = 'http:'; url.host = '127.0.0.1:4322';
      const headers = { ...route.request().headers(), host: 'backroadbum.com', 'x-forwarded-proto': 'https', 'x-backroadbum-client-ip': '127.0.0.1' };
      delete headers.authorization; delete headers.cookie;
      const response = await route.fetch({ url: url.href, headers, maxRedirects: 0 });
      await route.fulfill({ response });
    });
    const page = await context.newPage();
    return { browser, context, page };
  } catch (error) { await browser.close(); throw error; }
}
