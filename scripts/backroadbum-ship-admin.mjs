// Operator dogfood check. Default is read-only; --provision saves only this plugin's encrypted key.
import { readFileSync, lstatSync, mkdirSync } from 'node:fs';
import { openAdmin } from './backroadbum-admin.mjs';
const ID = 'r_ehdlg5cxkb3ffqvr', ORIGIN = 'https://backroadbum.com';
let admin;
class CheckFailure extends Error {}
const require = (condition, code) => { if (!condition) throw new CheckFailure(code); };
try {
  admin = await openAdmin();
  await admin.signIn();
  let provisioned = false;
  if (process.argv.includes('--provision')) {
    const path = '/etc/backroadbum/ship-grant.json', stat = lstatSync(path);
    require(stat.isFile() && (stat.mode & 0o777) === 0o600 && stat.size < 4096, 'private_grant_required');
    const grant = JSON.parse(readFileSync(path, 'utf8'));
    require(grant.schema === 'backroadbum.ship-grant/v1' && grant.siteId === 'backroadbum' && /^dk_store_[A-Za-z0-9_-]{43}$/.test(grant.storeKey), 'invalid_private_grant');
    const endpoint = ORIGIN + '/_emdash/api/admin/plugins/' + ID + '/settings';
    const before = await admin.context.request.get(endpoint, { headers: { 'X-EmDash-Request': '1' } });
    require(before.ok(), 'settings_read_failed');
    const saved = await before.json(); const current = saved.data ?? saved;
    require(current.schema?.connection?.type === 'secret', 'encrypted_setting_required');
    if (!current.secretsSet?.connection) {
      const response = await admin.context.request.put(endpoint, { headers: { 'X-EmDash-Request': '1' },
        data: { values: { connection: JSON.stringify({ siteId: grant.siteId, storeKey: grant.storeKey }) } } });
      require(response.ok(), 'encrypted_setting_write_failed');
      const body = await response.json(); const result = body.data ?? body;
      require(result.secretsSet?.connection === true && !JSON.stringify(body).includes(grant.storeKey), 'secret_not_masked');
      provisioned = true;
    }
  }
  await admin.page.goto(ORIGIN + '/_emdash/admin/plugins/' + ID + '/shipping', { waitUntil: 'domcontentloaded' });
  const expected = process.argv.includes('--expect-unavailable') ? 'Ship connection unavailable' : 'No orders admitted';
  await admin.page.getByText(expected, { exact: true }).waitFor({ timeout: 20000 });
  let refreshes = 0;
  if (!process.argv.includes('--expect-unavailable')) {
    await admin.page.getByRole('button', { name: 'Refresh connection', exact: true }).click();
    await admin.page.getByText('Verified · admin', { exact: true }).waitFor(); refreshes++;
  }
  const facts = { provisioned, view: expected, refreshes, viewports: [] };
  const directory = 'runs/backroadbum/ship-admin'; mkdirSync(directory, { recursive: true });
  for (const width of [1440, 390]) {
    await admin.page.setViewportSize({ width, height: 900 }); await admin.page.waitForTimeout(150);
    const main = await admin.page.locator('main').innerText();
    require(!/dk_store_|eyJ[A-Za-z0-9_-]{20}|PRIVATE KEY/.test(main), 'credential_in_view');
    require(!/Buy label|Connect Ship|DinkusKit\.com/.test(main), 'unsupported_action_in_view');
    const overflow = await admin.page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    require(!overflow, 'horizontal_overflow');
    await admin.page.screenshot({ path: directory + '/' + (process.argv.includes('--expect-unavailable') ? 'unavailable-' : 'connected-') + width + '.png', fullPage: true });
    facts.viewports.push({ width, overflow });
  }
  console.log(JSON.stringify(facts));
} catch (error) {
  const reason = error instanceof CheckFailure ? ` (${error.message})` : '';
  console.error('Merchant Ship admin check failed' + reason + '; no private response, browser state or credentials emitted.'); process.exitCode = 1;
} finally { await admin?.browser.close(); }
