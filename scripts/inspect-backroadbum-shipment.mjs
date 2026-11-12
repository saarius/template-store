// Read-only inspection of an existing TEST shipment. Never quotes, buys, cancels or completes it.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { openAdmin } from './backroadbum-admin.mjs';
import { shipmentInspectionRequestAllowed } from './lib/backroadbum-shipment-inspection.mjs';

if (!process.argv.includes('--check')) {
  console.log('No action. --check --order=NUMBER inspects an existing TEST shipment; --hosted checks its owner page; --pdf reads its existing label PDF. No purchases or cancellations.');
  process.exit(0);
}
const number = process.argv.find(arg => arg.startsWith('--order='))?.slice(8);
if (!number || !/^[1-9]\d{0,14}$/.test(number) || !Number.isSafeInteger(Number(number))) {
  console.error('Choose one existing TEST order with --order=NUMBER.');
  process.exit(1);
}
const hosted = process.argv.includes('--hosted');
let admin, db;
try {
  db = new DatabaseSync('/var/lib/backroadbum/content.db', { readOnly: true });
  const records = db.prepare("SELECT data FROM _plugin_storage WHERE collection='orders'").all().map(row => JSON.parse(row.data));
  const record = records.find(value => value.number === Number(number));
  assert.equal(record?.paidOrder?.mode, 'test', 'Existing TEST order required');
  admin = await openAdmin({ hostedState: hosted });
  let blocked = 0;
  // Native page reads use EmDash POST interactions. Admit page-load/open only,
  // never form submissions, connection changes or a label purchase/cancellation.
  await admin.context.route('**/*', async route => {
    const request = route.request();
    let data;
    try { data = request.postDataJSON(); } catch { /* admission refuses an unreadable interaction */ }
    if (!shipmentInspectionRequestAllowed(request.url(), request.method(), data)) {
      blocked++; return route.abort();
    }
    await route.continue();
  });
  await admin.signIn();
  const page = admin.page;
  await page.goto('https://backroadbum.com/_emdash/admin/plugins/r_ehdlg5cxkb3ffqvr/shipping');
  await page.getByRole('row').filter({ hasText: `#${number} (TEST)` }).getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByRole('heading', { name: `Order #${number} (TEST)`, exact: true }).waitFor();
  const text = await page.locator('main').innerText();
  const print = page.getByRole('link', { name: 'Print label', exact: true });
  const report = {
    checkedAt: new Date().toISOString(), order: Number(number), mode: 'test',
    canonicalCompletedAtInspection: Boolean(record.completed), revision: record.revision ?? 1,
    nativePrintReady: await print.count() === 1,
    nativeTrackingMatchesCompletion: record.completed?.tracking ? text.includes(record.completed.tracking) : null,
    nativeBuyActionVisible: await page.getByRole('button', { name: 'Buy label', exact: true }).count() > 0,
    nativeSandboxLabel: /sandbox price, nothing charged/.test(text),
  };
  if (process.argv.includes('--pdf') && report.nativePrintReady) {
    const url = new URL(await print.getAttribute('href'));
    assert.equal(url.origin, 'https://ship.dinkuskit.com');
    const response = await admin.context.request.get(url.href);
    assert.equal(response.status(), 200);
    assert.match(response.headers()['content-type'], /application\/pdf/);
    const bytes = await response.body();
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    report.pdf = { http: response.status(), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  if (hosted) {
    const url = new URL(await page.getByRole('link', { name: 'Open in Ship', exact: true }).getAttribute('href'));
    assert.equal(url.origin, 'https://ship.dinkuskit.com');
    assert.equal(decodeURIComponent(url.pathname.split('/').at(-1)), record.paidOrder.orderId);
    const ownerPage = await admin.context.newPage();
    await ownerPage.goto(url.href);
    await ownerPage.getByRole('heading', { name: `Order #${number} TEST`, exact: true }).waitFor();
    await ownerPage.getByRole('heading', { name: 'Labels', exact: true }).waitFor();
    const ownerText = await ownerPage.locator('main').innerText();
    report.hosted = {
      signedInOwnerPageReached: true,
      existingPrintLinks: await ownerPage.getByRole('link', { name: 'Open PDF to print', exact: true }).count(),
      trackingMatchesCompletion: record.completed?.tracking ? ownerText.includes(record.completed.tracking) : null,
    };
  }
  assert.equal(blocked, 0, 'Inspection attempted an unsupported action');
  report.blockedActions = blocked;
  console.log(JSON.stringify(report, null, 2));
} catch {
  console.error('Shipment inspection stopped; private responses, URLs, addresses and browser state withheld. Do not retry a purchase.');
  process.exitCode = 1;
} finally {
  if (admin) {
    try { await admin.saveKey(); } finally {
      try { await admin.saveHosted(); } finally { await admin.browser.close(); }
    }
  }
  db?.close();
}
