// Operator-only real-email API qualification. No purchase or public form admission.
import { chromium } from '@playwright/test';
import { commerceProfile } from '../src/features/commerce-profile/profiles.mjs';
import { emailTestConfig, inboxRequest, waitForInbox } from './lib/backroadbum-email-inbox.mjs';

export async function verifyShopperEmail() {
  const config = emailTestConfig();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  let token, originalProfile, profileTouched = false;
  let stage = 'initial-read';
  const report = { schema: 'backroadbum.shopper-email-api/v1', checkedAt: new Date().toISOString(),
    surface: 'live-browser-same-origin-api', publicFormOpened: false, purchases: 0 };
  const request = async (path, method = 'GET', body, session = token) => page.evaluate(async args => {
    const response = await fetch(`/_emdash/api/plugins/${args.runtimeId}/account/${args.path}`, {
      method: args.method, headers: { accept: 'application/json',
        ...(args.method === 'POST' ? { 'content-type': 'application/json' } : {}),
        ...(args.session ? { 'x-commerce-customer-session': args.session } : {}) },
      ...(args.body !== undefined ? { body: JSON.stringify(args.body) } : {}),
    });
    const raw = await response.json();
    const data = typeof raw.success === 'boolean' ? raw.success ? raw.data : { ok: false, error: raw.error } : raw;
    return { status: response.status, data };
  }, { path, method, body, session, runtimeId: commerceProfile().runtimeId });
  const requireOk = result => { if (result.status !== 200 || result.data?.ok !== true) throw Error('Expected successful response'); return result.data; };
  try {
    await page.goto('https://backroadbum.com/account', { waitUntil: 'networkidle' });
    report.unauthenticatedOrdersDenied = (await request('orders')).data?.error?.code === 'SESSION_DENIED';
    if (!report.unauthenticatedOrdersDenied) throw Error();
    await inboxRequest(config, 'DELETE');
    stage = 'start-delivery';
    const since = Date.now();
    requireOk(await request('sign-in/start', 'POST', { email: config.to }));
    stage = 'real-mx-inbound';
    const mail = await waitForInbox(config, message => String(message.subject).includes('sign-in code:') &&
      /verification code is [0-9]{6}/.test(String(message.decoded)), since);
    const code = /verification code is ([0-9]{6})/.exec(String(mail.decoded))?.[1];
    if (!code) throw Error();
    report.realMxInbound = true;
    stage = 'wrong-pin';
    const wrong = `${(Number(code[0]) + 1) % 10}${code.slice(1)}`;
    report.wrongPinDenied = (await request('sign-in/verify', 'POST', { email: config.to, code: wrong })).data?.error?.code === 'CODE_INVALID';
    if (!report.wrongPinDenied) throw Error();
    stage = 'valid-pasted-pin';
    const verified = requireOk(await request('sign-in/verify', 'POST', { email: config.to, code: ` \t${code}\n ` }));
    token = verified.capability?.session;
    if (!token) throw Error();
    report.trimmedPinAccepted = true;
    stage = 'own-orders';
    const orders = requireOk(await request('orders'));
    if (!Array.isArray(orders.orders) || orders.profile?.email !== config.to) throw Error();
    originalProfile = orders.profile;
    report.orderCount = orders.orders.length;
    // An empty account is useful isolation evidence, NOT proof of a matching paid order.
    report.matchingPaidOrderQualified = false;
    report.profileInitialRead = true;
    stage = 'profile-update';
    const delivery = { name: 'Sandbox Shopper', line1: '123 Test Road', city: 'Portland', region: 'OR', postalCode: '97205', country: 'US' };
    profileTouched = true;
    const updated = requireOk(await request('profile', 'POST', { phone: '+15035550100', delivery }));
    if (updated.profile?.delivery?.line1 !== delivery.line1) throw Error();
    await page.reload({ waitUntil: 'networkidle' });
    const reloaded = requireOk(await request('orders'));
    if (reloaded.profile?.delivery?.line1 !== delivery.line1 || reloaded.profile?.phone !== '+15035550100') throw Error();
    report.profileWriteAndReload = true;
    stage = 'profile-clear';
    const clear = requireOk(await request('profile', 'POST', { phone: null, delivery: null }));
    if (clear.profile?.phone !== null || clear.profile?.delivery !== null) throw Error();
    const reread = requireOk(await request('orders'));
    if (reread.profile?.phone !== null || reread.profile?.delivery !== null) throw Error();
    report.profileClearPersisted = true;
    stage = 'known-profile-get';
    const profileGet = await request('profile');
    report.bodylessProfileGet = { http: profileGet.status, ok: profileGet.data?.ok === true,
      code: typeof profileGet.data?.error?.code === 'string' ? profileGet.data.error.code : null };
    stage = 'restore-profile';
    requireOk(await request('profile', 'POST', { phone: originalProfile.phone, delivery: originalProfile.delivery }));
    profileTouched = false;
    stage = 'sign-out';
    requireOk(await request('sign-out', 'POST', {}));
    report.revokedSessionDenied = (await request('orders')).data?.error?.code === 'SESSION_DENIED';
    token = undefined;
    if (!report.revokedSessionDenied) throw Error();
    return { ...report, complete: true, messageContentsAndCapabilitiesRetained: false };
  } catch {
    return { ...report, complete: false, failedStage: stage, messageContentsAndCapabilitiesRetained: false };
  } finally {
    try {
      if (token) {
        try {
          if (profileTouched && originalProfile) requireOk(await request('profile', 'POST', { phone: originalProfile.phone, delivery: originalProfile.delivery }));
        } finally { requireOk(await request('sign-out', 'POST', {})); }
      }
    } finally { await inboxRequest(config, 'DELETE').finally(() => browser.close()); }
  }
}

if (import.meta.main) {
  if (process.argv.length === 2) console.log('No action. --verify-real-email sends one OTP to the verified test inbox and qualifies the signed Commerce API lifecycle. No purchase or account admission.');
  else if (process.argv.length !== 3 || process.argv[2] !== '--verify-real-email') {
    console.error('Use --verify-real-email or no arguments. No action taken.'); process.exitCode = 1;
  } else {
    try { const report = await verifyShopperEmail(); console.log(JSON.stringify(report, null, 2)); if (!report.complete) process.exitCode = 1; }
    catch { console.error('Shopper email verification incomplete; private response withheld. Confirm cleanup before retry.'); process.exitCode = 1; }
  }
}
