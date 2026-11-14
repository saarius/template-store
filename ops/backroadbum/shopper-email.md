# Shopper email setup

## Verified · November 14, 2026

The deployed native `backroadbum-email-relay` plugin registers one exclusive `email:deliver` hook with `hooks.email-transport:register`. It is mounted only for this merchant’s hosted-Registry Node build, alongside the unchanged signed Commerce 0.8.0, Payments 0.5.0 and Ship 0.3.1. Relay URL/token/from are read from `process.env` **inside the delivery handler**, never plugin options or `import.meta.env`.

Native **Settings → Email** reports `available: true`, one selected provider and Send Test. A test message sent through that UI arrived through real MX into the provisioned inbox. A separate real Commerce OTP arrived there too: a live same-origin browser API journey passed wrong-PIN rejection, whitespace-pasted valid sign-in, an empty own-orders read, profile update/reload/clear and sign-out with subsequent session denial. Inbox messages were deleted, the original blank profile restored, and no code or session capability retained.

Evidence: workspace `evidence/2026-11-14-email-relay/{native-settings,native-delivery,shopper-api,native-guide}.json`. The guide’s one outdated delivery-unavailable sentence was corrected through the native CMS API and republished; its other content was retained. Account/Test store disclose Cloudflare Free’s verified-destination restriction.

## Qualification still needed

**The public sign-in form remains paused.** The test mailbox has no paid order, so the empty read is not matching-paid-order isolation proof. One deliberately guarded Stripe TEST purchase under the provisioned mailbox, positive own-order matching versus other guest orders, the actual public form’s wrong/paste/valid lifecycle, and responsive active-form auditing remain next. The account API already works behind Commerce’s origin/session checks; the pause is presentation, not a security boundary. Guest 4242 checkout and original-browser receipts remain independent and open.

Do not replay TEST1009 or historical payment drivers. Use a new explicit purchase guard and preserve all existing paid records. Reopen with `BACKROADBUM_ACCOUNT_EMAIL_VERIFIED=1` only after that remaining journey is qualified; the current API success alone does not change the switch. A future cycle may reassess the presentation pause with fresh evidence, but must keep the verified-destination limitation honest.

## Operator commands · Node 24, primary `repos/template-store`

```sh
# Read-only after necessary staff authentication; no mail or shopper session.
node scripts/inspect-backroadbum-email.mjs --check
node scripts/verify-backroadbum-account.mjs --check

# Explicit mail actions; no action without these flags. Do not run as routine health probes.
node scripts/verify-backroadbum-email-delivery.mjs --send-native-test
node scripts/verify-backroadbum-shopper-email.mjs --verify-real-email
```

The first mail command uses the native UI, overrides the recipient, and blocks non-read requests other than one exact test POST to `/_emdash/api/settings/email` with the verified mailbox. Installed EmDash 1.4.0’s source comment mentions `/email/test`, but the actual native action is POST `/email`. The second uses actual Commerce routes from the selected Registry runtime ID, not the package name; it sends one OTP, polls real inbound delivery, handles credentials only in memory, restores profile state, revokes its session and deletes consumed inbox mail. Both emit redacted summaries only. Initial driver path mistakes were local verification retries, not serving/provider failures.

## Provider safety and limits

- `/etc/backroadbum/email.env` is owner-provisioned and protected; do not print or change it. Only `BACKROADBUM_TEST_SHOPPER_EMAIL` (`shopper-test@backroadbum.com`) is approved for automated mail. **Never send to the owner’s personal Gmail.** The private relay token is not a shopper inbox credential and must never be exposed.
- Cloudflare Free sends only to verified destinations. Arbitrary visitor addresses cannot receive OTPs; do not advertise unrestricted email login or publish an inbox. Provider health and HTTP send acceptance are not inbound-delivery proof.
- The transport permits only the provisioned HTTPS origin, rejects redirects and invalid runtime configuration, uses a 15-second fetch deadline within a 20-second hook, never retries automatically, and throws generic errors without provider bodies, message contents or network causes. A timeout might already have delivered mail; inspect before explicitly resending.
- Linode SMTP remains blocked. Do not build another provider or local service replica, enable console capture in production, change hosted consents or replace a signed plugin.
- Provider-rejection behavior through signed Commerce still needs focused qualification without sending to arbitrary real addresses or weakening intentional enumeration safeguards. Mocked transport failures pass unit tests; that is not live Commerce/provider rejection proof.

## Known signed-release limitation

Signed Commerce 0.8.0’s bodyless `GET account/profile` returns HTTP 400 `INVALID_PLUGIN_REQUEST`, independently confirmed after real sign-in. This is the declaration bug already fixed in merged [Commerce #257](https://github.com/dinkuskit/commerce/pull/257); do not file it again or install an unsigned patch. The starter UI reads its initial profile through `account/orders` and sends well-formed profile POSTs; both worked in the live API journey. A future signed release needs separate qualification.

Historical missing-provider observations from November 13 remain in git and `evidence/2026-11-13-email-setup-{native,inspection}.json`; they no longer describe the serving transport. The original account pause was a store-configuration gap, not a hosted DinkusKit connection outage.
