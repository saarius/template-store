// Local operator helper. Secrets and WebAuthn state stay outside the repository.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, renameSync, existsSync, chmodSync } from 'node:fs';

export async function persistAdminKey(cdp, authenticatorId, keyPath) {
  const { credentials: keys } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
  if (!keys.length) throw Error('No operator authenticator state to preserve');
  writeFileSync(keyPath + '.next', JSON.stringify(keys), { mode: 0o600 });
  renameSync(keyPath + '.next', keyPath);
}

export async function openAdmin({ hostedState = false } = {}) {
  const credentials = JSON.parse(readFileSync('/etc/backroadbum/admin.json', 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    httpCredentials: { ...credentials, origin: 'https://backroadbum.com' },
    ...(hostedState ? { storageState: '/etc/backroadbum/dinkuskit-session.json' } : {}),
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true,
      hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  const keyPath = '/etc/backroadbum/operator/passkey.json';
  if (existsSync(keyPath)) {
    const keys = JSON.parse(readFileSync(keyPath, 'utf8'));
    for (const credential of keys) await cdp.send('WebAuthn.addCredential', { authenticatorId, credential });
  }
  return { browser, context, page, async signIn() {
    await page.goto('https://backroadbum.com/_emdash/admin', { waitUntil: 'domcontentloaded' });
    try {
      const current = new URL(page.url());
      if (current.pathname === '/_emdash/admin' && !current.search) return;
      await page.getByRole('button', { name: 'Sign in with Passkey', exact: true }).click();
      await page.waitForURL((url) => url.pathname === '/_emdash/admin' && !url.search);
      await page.waitForTimeout(2000);
      if (page.url().includes('/login')) throw new Error('Passkey sign-in failed');
    } finally {
      // Authentication increments the virtual key's counter, even if a later page check fails.
      // Every caller must retain it, not just scripts that remember an explicit saveKey().
      await persistAdminKey(cdp, authenticatorId, keyPath);
    }
  }, async saveKey() { await persistAdminKey(cdp, authenticatorId, keyPath); },
  async saveHosted() {
    if (!hostedState) return;
    const path = '/etc/backroadbum/dinkuskit-session.json';
    await context.storageState({ path }); chmodSync(path, 0o600);
  } };
}
