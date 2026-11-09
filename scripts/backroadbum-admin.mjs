// Local operator helper. Secrets and WebAuthn state stay outside the repository.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export async function openAdmin() {
  const credentials = JSON.parse(readFileSync('/etc/backroadbum/admin.json', 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ httpCredentials: credentials });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true,
      hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  const keyPath = '/etc/backroadbum/passkey.json';
  if (existsSync(keyPath)) {
    const keys = JSON.parse(readFileSync(keyPath, 'utf8'));
    for (const credential of keys) await cdp.send('WebAuthn.addCredential', { authenticatorId, credential });
  }
  return { browser, context, page, async signIn() {
    await page.goto('https://backroadbum.com/_emdash/admin');
    await page.getByRole('button', { name: 'Sign in with Passkey', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/_emdash/admin' && !url.search);
    await page.waitForTimeout(2000);
    if (page.url().includes('/login')) throw new Error('Passkey sign-in failed');
  }, async saveKey() {
    const { credentials: keys } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
    writeFileSync(keyPath, JSON.stringify(keys), { mode: 0o600 });
  } };
}
