// Merchant packing dogfood. Default reads only; --save-demo provisions only empty/exact demo state.
// --exercise checks invalid input and adds/removes one temporary box. Never admits an order or creates a label.
import { mkdirSync } from 'node:fs';
import { expect } from '@playwright/test';
import { openAdmin } from './backroadbum-admin.mjs';
const ORIGIN = 'https://backroadbum.com', ID = 'r_ehdlg5cxkb3ffqvr';
const saveDemo = process.argv.includes('--save-demo'), exercise = process.argv.includes('--exercise');
const demo = { Name: 'Backroad Bum demo', 'Address line 1': '1 Example Way', City: 'Testville', State: 'CA', 'ZIP code': '90000' };
const box = { 'Box name': 'Demo mug box', 'Length (inches)': '6', 'Width (inches)': '4', 'Height (inches)': '3', 'Empty box weight (ounces)': '1' };
const directory = 'runs/backroadbum/ship-packing'; mkdirSync(directory, { recursive: true });
let admin;
class CheckFailure extends Error {}
const check = (condition, code) => { if (!condition) throw new CheckFailure(code); };
try {
  admin = await openAdmin(); await admin.signIn(); const page = admin.page;
  await page.setViewportSize({ width: 1440, height: 900 });
  let browserErrors = 0; page.on('pageerror', () => browserErrors++);
  const open = async () => {
    await page.goto(ORIGIN + '/_emdash/admin/plugins/' + ID + '/shipping', { waitUntil: 'domcontentloaded' });
    await page.getByText('No orders admitted', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Packing setup', exact: true }).click();
    await page.getByText('Practice packing', { exact: true }).waitFor();
  };
  const group = label => page.getByRole('group', { name: label, exact: true });
  const fill = async (form, values) => { for (const [label, value] of Object.entries(values)) await form.getByLabel(label, { exact: true }).fill(value); };
  const save = async (form, label, expected) => {
    await form.getByRole('button', { name: label, exact: true }).click(); await page.getByText(expected, { exact: true }).waitFor();
  };
  await open();
  let originSaved = false, boxAdded = false;
  if (saveDemo) {
    const origin = group('Save origin address'), current = await origin.getByLabel('Name', { exact: true }).inputValue();
    if (!current) {
      for (const field of await origin.locator('input').all()) check(await field.inputValue() === '', 'nonempty_origin_preserved');
      await fill(origin, demo); await save(origin, 'Save origin address', 'Origin address saved'); originSaved = true;
    }
    for (const [label, value] of Object.entries(demo)) await expect(group('Save origin address').getByLabel(label, { exact: true })).toHaveValue(value);
    const rows = page.getByRole('row').filter({ hasText: 'Demo mug box' });
    if (await rows.count() === 0) {
      await expect(page.getByText('No box sizes saved yet.', { exact: true })).toBeVisible();
      await fill(group('Add box size'), box); await save(group('Add box size'), 'Add box size', 'Box size added'); boxAdded = true;
      await expect(group('Add box size').getByLabel('Box name', { exact: true })).toHaveValue('');
    }
    await expect(page.getByRole('row').filter({ hasText: 'Demo mug box' })).toContainText('6 × 4 × 3');
  }
  if (exercise) {
    await fill(group('Add box size'), { ...box, 'Box name': 'Temporary packing check', 'Length (inches)': '0' });
    await save(group('Add box size'), 'Add box size', 'Packing not saved');
    await expect(group('Add box size').getByLabel('Box name', { exact: true })).toHaveValue('Temporary packing check');
    await expect(group('Add box size').getByLabel('Length (inches)', { exact: true })).toHaveValue('0');
    await page.screenshot({ path: directory + '/invalid-1440.png', fullPage: true });
    await group('Add box size').getByLabel('Length (inches)', { exact: true }).fill('6');
    await save(group('Add box size'), 'Add box size', 'Box size added');
    const row = page.getByRole('row').filter({ hasText: 'Temporary packing check' });
    await row.getByRole('button', { name: 'Remove', exact: true }).click();
    await page.getByRole('button', { name: 'Remove box', exact: true }).click();
    await page.getByText('Box size removed', { exact: true }).waitFor(); await expect(row).toHaveCount(0);
  }
  await open(); // Reload from Ship, not form component state.
  const summary = { originPresent: Boolean(await group('Save origin address').getByLabel('Name', { exact: true }).inputValue()),
    boxCount: await page.getByRole('button', { name: 'Remove', exact: true }).count() };
  const viewports = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.keyboard.press('Tab'); await group('Save origin address').getByLabel('Name', { exact: true }).focus();
    const text = await page.locator('main').innerText();
    check(!/dk_store_|eyJ[A-Za-z0-9_-]{20}|PRIVATE KEY|Buy label|Connect Ship|DinkusKit\.com/.test(text), 'unexpected_private_or_unsupported_view');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'horizontal_overflow');
    await page.screenshot({ path: directory + '/packing-' + width + '.png', fullPage: true }); viewports.push({ width, noOverflow: true });
  }
  await page.getByRole('button', { name: 'Back to Shipments', exact: true }).click();
  await page.getByText('No orders admitted', { exact: true }).waitFor(); await expect(page.getByText('Closed', { exact: true })).toBeVisible();
  check(browserErrors === 0, 'browser_error');
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), browserErrors, merchantPacking: true, originSaved, boxAdded,
    invalidInputAndRemoveChecked: exercise, reloadVerified: true, ...summary, intake: 'closed', viewports, noOrderOrLabelAction: true }, null, 2));
} catch (error) {
  const reason = error instanceof CheckFailure ? ' (' + error.message + ')' : '';
  console.error('Merchant packing check failed' + reason + '; no private response, address, browser state or credential emitted.'); process.exitCode = 1;
} finally { await admin?.browser.close(); }
