// Operator-only inspection. Authenticates staff, then permits reads only; never sends mail.
export function summarizeEmailSettings(payload) {
  const unavailable = { state: 'unavailable', delivery: 'unverified' };
  const data = payload?.success === true ? payload.data : null;
  const ids = Array.isArray(data?.providers) ? data.providers.map(provider => provider?.pluginId) : null;
  const validIds = values => Array.isArray(values) && values.every(id => typeof id === 'string' && id.length > 0);
  if (typeof data?.available !== 'boolean' || !validIds(ids) || new Set(ids).size !== ids.length ||
      !validIds(data?.middleware?.beforeSend) || !validIds(data?.middleware?.afterSend) ||
      !(data.selectedProviderId === null || typeof data.selectedProviderId === 'string')) return unavailable;
  const selected = typeof data.selectedProviderId === 'string' && ids.includes(data.selectedProviderId);
  if (data.available !== selected || (!data.available && data.selectedProviderId !== null)) return unavailable;
  return { state: selected ? 'provider-selected' : 'not-configured', providerCount: ids.length,
    selectedProvider: selected, middlewareCount: {
      beforeSend: data.middleware.beforeSend.length, afterSend: data.middleware.afterSend.length,
    }, delivery: 'unverified' };
}

export async function inspectEmail() {
  const { openAdmin } = await import('./backroadbum-admin.mjs');
  const admin = await openAdmin();
  let blockedWrites = 0;
  try {
    await admin.signIn();
    // Login/session/passkey activity is necessary staff authentication, not a mail test.
    await admin.context.route('**/*', route => {
      if (!['GET', 'HEAD'].includes(route.request().method())) {
        blockedWrites++;
        return route.abort();
      }
      return route.continue();
    });
    const responsePromise = admin.page.waitForResponse(response =>
      response.url() === 'https://backroadbum.com/_emdash/api/settings/email' && response.request().method() === 'GET');
    await admin.page.goto('https://backroadbum.com/_emdash/admin/settings/email', { waitUntil: 'domcontentloaded' });
    const response = await responsePromise;
    const summary = summarizeEmailSettings(response.status() === 200 ? await response.json() : null);
    if (summary.state === 'unavailable') throw Error('Unrecognized settings');
    await admin.page.getByRole('heading', { name: 'Email Settings', exact: true }).waitFor();
    const expectedStatus = summary.state === 'not-configured' ? 'No email provider configured' : 'Email provider active';
    await admin.page.getByText(expectedStatus, { exact: true }).waitFor();
    const testActionCount = await admin.page.getByRole('button', { name: 'Send Test', exact: true }).count();
    if (testActionCount !== (summary.selectedProvider ? 1 : 0) || blockedWrites) throw Error('Native settings mismatch');
    return { schema: 'backroadbum.email-inspection/v1', checkedAt: new Date().toISOString(),
      http: response.status(), ...summary, nativeStatusMatches: true, testActionCount, blockedWrites };
  } finally { await admin.browser.close(); }
}

if (import.meta.main) {
  if (process.argv.length === 2) {
    console.log('No action. --check reads native EmDash email settings after staff sign-in. It never sends email or verifies delivery.');
  } else if (process.argv.length !== 3 || process.argv[2] !== '--check') {
    console.error('Use --check or no arguments. No action taken.');
    process.exitCode = 1;
  } else {
    try { console.log(JSON.stringify(await inspectEmail(), null, 2)); }
    catch {
      console.error('Email inspection unavailable; private settings, responses and errors withheld. No email sent.');
      process.exitCode = 1;
    }
  }
}
