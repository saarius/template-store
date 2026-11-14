// Explicit operator action: sends ONE native test message to the provisioned sandbox inbox.
import { openAdmin } from './backroadbum-admin.mjs';
import { emailTestConfig, inboxRequest, waitForInbox } from './lib/backroadbum-email-inbox.mjs';

export async function verifyNativeDelivery() {
  const config = emailTestConfig();
  const admin = await openAdmin();
  let sent = 0;
  try {
    await admin.signIn();
    await inboxRequest(config, 'DELETE');
    // Defense against accidentally using the admin page's personal-address default.
    await admin.context.route('**/*', async route => {
      const request = route.request();
      if (['GET', 'HEAD'].includes(request.method())) return route.continue();
      if (new URL(request.url()).pathname !== '/_emdash/api/settings/email' ||
          request.method() !== 'POST' || request.postDataJSON()?.to !== config.to || ++sent !== 1) {
        return route.abort();
      }
      return route.continue();
    });
    await admin.page.goto('https://backroadbum.com/_emdash/admin/settings/email', { waitUntil: 'networkidle' });
    await admin.page.getByText('Email provider active', { exact: true }).waitFor();
    const recipient = admin.page.locator('input[type="email"]');
    if (await recipient.count() !== 1) throw Error('Unexpected native test form');
    await recipient.fill(config.to);
    const since = Date.now();
    const responsePromise = admin.page.waitForResponse(response => response.url().endsWith('/_emdash/api/settings/email') && response.request().method() === 'POST');
    await admin.page.getByRole('button', { name: 'Send Test', exact: true }).click();
    const response = await responsePromise;
    if (response.status() !== 200 || (await response.json()).success !== true || sent !== 1) throw Error('Native send rejected');
    const message = await waitForInbox(config, message => String(message.subject).startsWith('Test email from ') &&
      String(message.decoded).includes('your email provider is working correctly'), since);
    const delivered = Boolean(message);
    return { schema: 'backroadbum.email-delivery/v1', checkedAt: new Date().toISOString(),
      nativeUi: true, activeProvider: true, guardedSendCount: sent, sendHttp: response.status(),
      realMxInbound: delivered, messageContentRetained: false };
  } finally {
    await inboxRequest(config, 'DELETE').finally(() => admin.browser.close());
  }
}

if (import.meta.main) {
  if (process.argv.length === 2) console.log('No action. --send-native-test sends one native EmDash test to the verified sandbox inbox, polls real inbound delivery and clears the inbox.');
  else if (process.argv.length !== 3 || process.argv[2] !== '--send-native-test') {
    console.error('Use --send-native-test or no arguments. No action taken.'); process.exitCode = 1;
  } else {
    try { console.log(JSON.stringify(await verifyNativeDelivery(), null, 2)); }
    catch { console.error('Native delivery verification incomplete; private responses withheld. Inspect the provider before any resend.'); process.exitCode = 1; }
  }
}
