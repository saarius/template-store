// Read-only access to an existing shopper capability, independent of whether
// the merchant admits new checkouts. Never writes the private browser-state file.
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

export const receiptOrigin = 'https://backroadbum.com';
export const receiptStatusPath = '/api/checkout/status';
export const nativeReceiptStatusPath = '/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/status';
export const retainedCheckoutKey = 'dinkus.guest-checkout.v1';

export function receiptRequestAllowed(url, method, native = false) {
  try {
    const target = new URL(url);
    if (target.origin !== receiptOrigin || target.username || target.password) return false;
    if (method === 'GET' || method === 'HEAD') return true;
    return method === 'POST' && (target.pathname === receiptStatusPath || native && target.pathname === nativeReceiptStatusPath);
  } catch { return false; }
}

export function receiptBrowserState(state) {
  if (!Array.isArray(state?.origins)) throw new Error('Retained receipt state unavailable');
  // Restore only receipt retention: no merchant cookies, other origins, shopper
  // sessions or unrelated local storage belong in this anonymous receipt check.
  const origin = state.origins.find(entry => entry.origin === receiptOrigin);
  const raw = origin?.localStorage?.find(entry => entry.name === retainedCheckoutKey)?.value;
  if (typeof raw !== 'string' || raw.length === 0) throw new Error('Retained receipt state unavailable');
  return { cookies: [], origins: [{ origin: receiptOrigin, localStorage: [{ name: retainedCheckoutKey, value: raw }] }] };
}

export async function openRetainedReceipt({ statePath = '/etc/backroadbum/public-shopper-browser.json', width = 1440, native = false, saved = true } = {}) {
  const state = saved ? receiptBrowserState(JSON.parse(readFileSync(statePath, 'utf8'))) : { cookies: [], origins: [] };
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, storageState: state, serviceWorkers: 'block' });
    let blockedRequests = 0;
    await context.route('**/*', route => {
      if (receiptRequestAllowed(route.request().url(), route.request().method(), native)) return route.continue();
      blockedRequests++;
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    return { browser, context, page, retained: state.origins[0]?.localStorage.find(entry => entry.name === retainedCheckoutKey)?.value,
      blockedRequests: () => blockedRequests };
  } catch (error) { await browser.close(); throw error; }
}
