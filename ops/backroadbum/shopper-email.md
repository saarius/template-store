# Shopper email setup

## Current finding · November 13, 2026

The deployed EmDash 1.4.0 **Settings → Email** page says **No email provider configured** and offers no Send Test action. Its native `GET /_emdash/api/settings/email` returns `available: false`, no providers, a null selected provider and no middleware. This establishes missing configuration, not a provider outage or a DinkusKit hosted-connection failure. Commerce 0.8.0 previously returned `EMAIL_UNAVAILABLE` on a single shopper sign-in attempt; do not send another code just to rediscover the missing provider.

Run from the primary `repos/template-store` checkout on Node 24:

```sh
node scripts/inspect-backroadbum-email.mjs --check
node scripts/verify-backroadbum-account.mjs --check
```

The first command signs in as staff using the private operator helper, then allows only GET/HEAD while reading the native settings page. It emits counts and state, never provider identities, email addresses, credentials or response bodies. Exit 0 means the inspection completed, **not** that email works: both `not-configured` and `provider-selected` retain `delivery: unverified`. Unknown/malformed settings and native-page mismatches fail closed. It has no action without `--check`; it sends no email, starts no shopper session and does not change either admission gate. Staff authentication necessarily creates its own session and preserves the passkey counter.

Evidence: workspace `evidence/2026-11-13-email-setup-{native,inspection}.json`; private ignored native screenshot `runs/backroadbum/email-setup/native-settings.png`. These are dated observations, not an independent mail monitor.

## Supported Node path, not implemented yet

1. Choose a real email provider and obtain sender-domain access and its SMTP/API credentials. No working sender or delivery credential has been established here. Do not reuse Stripe, DinkusKit bindings or merchant login credentials as mail credentials.
2. Follow [EmDash Email Setup](https://docs.emdashcms.com/guides/email/). Its Node guidance uses the community `emdash-smtp` provider family, registered as a native provider in `astro.config.mjs`, with credentials in that provider's settings. Review its current package, compatibility and secret handling before installing; this cycle installs nothing and does not certify that third-party plugin. EmDash's Cloudflare `send_email` binding is not a Node transport.
3. Keep signed Commerce/Payments/Ship unchanged. Configure sender identity and DNS through the chosen provider, keep credentials private and retain their recovery material with the matching encrypted settings. Never log message contents or codes. Do not enable production console capture or publish an inbox: development's console provider is not delivery.
4. Inspect Settings → Email again. If a provider is selected, use its native Send Test action once to an operator-controlled mailbox; confirm actual receipt, not just a successful API response. A configured provider can still fail or deliver to spam.
5. Through a private test path, complete one real Commerce email-code sign-in, own-order history/profile read, profile update/clear and sign-out/revocation. Do not read an OTP from the database, fabricate a shopper capability, use the staff login as a customer, or reuse a guest receipt capability as a shopper session. Retain only redacted results. Investigate any new framework failure separately before reopening the form.
6. Only after delivery and the actual shopper flow work, explicitly set the merchant's `BACKROADBUM_ACCOUNT_EMAIL_VERIFIED=1` and verify the normal public Account page on desktop/phone. This switch controls presentation, not an account API security boundary; Commerce still owns origin, OTP and session authorization. New-checkout admission remains independent. Reconsider the pause if this evidence becomes available, not merely because a provider is installed.

## Separate known limitation

Signed Commerce 0.8.0's bodyless `GET account/profile` has the declaration bug already fixed upstream by [Commerce PR #257](https://github.com/dinkuskit/commerce/pull/257) (merged). The starter Account UI reads its initial profile through `account/orders` and sends well-formed profile POSTs, so that GET bug alone does not establish an Account UI blocker. Do not file it again or replace the signed Registry plugin with an unsigned patch; qualify a future signed release separately.
