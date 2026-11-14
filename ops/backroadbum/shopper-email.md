# Shopper email setup

## Current direction · Owner Steer 5, November 14

The owner provisioned a Cloudflare HTTPS email relay, sender and verified test inbox in `/etc/backroadbum/email.env`; its unauthenticated health check returns `ok: true`. Linode SMTP is blocked, so use this relay rather than provisioning another SMTP provider. Native `email:deliver` registration, real inbound delivery, shopper OTP, own-order isolation and profile/revocation verification are **not implemented or qualified yet**. The existing account pause remains honest until that work is complete; missing sender credentials is no longer the next blocker.

## Historical native inspection · November 13, 2026

The deployed EmDash 1.4.0 **Settings → Email** page says **No email provider configured** and offers no Send Test action. Its native `GET /_emdash/api/settings/email` returns `available: false`, no providers, a null selected provider and no middleware. This establishes missing configuration, not a provider outage or a DinkusKit hosted-connection failure. Commerce 0.8.0 previously returned `EMAIL_UNAVAILABLE` on a single shopper sign-in attempt; do not send another code just to rediscover the missing provider.

Run from the primary `repos/template-store` checkout on Node 24:

```sh
node scripts/inspect-backroadbum-email.mjs --check
node scripts/verify-backroadbum-account.mjs --check
```

The first command signs in as staff using the private operator helper, then allows only GET/HEAD while reading the native settings page. It emits counts and state, never provider identities, email addresses, credentials or response bodies. Exit 0 means the inspection completed, **not** that email works: both `not-configured` and `provider-selected` retain `delivery: unverified`. Unknown/malformed settings and native-page mismatches fail closed. It has no action without `--check`; it sends no email, starts no shopper session and does not change either admission gate. Staff authentication necessarily creates its own session and preserves the passkey counter.

Evidence: workspace `evidence/2026-11-13-email-setup-{native,inspection}.json`; private ignored native screenshot `runs/backroadbum/email-setup/native-settings.png`. These are dated observations, not an independent mail monitor.

## Supported Node path, not implemented yet

1. Read Owner Steer5 in `/etc/trialrun/AGENT.md` and the native EmDash email-hook contract. Use the existing HTTPS relay and its private environment file; never print that file or its token, pass secrets through plugin build options, serialize them to clients, or reuse Stripe/DinkusKit credentials as mail credentials.
2. Register a native plugin with `hooks.email-transport:register` and an exclusive `email:deliver` handler in `astro.config.mjs`. Read relay URL/token/from from `process.env` **inside the runtime handler**, then deliver over authenticated HTTPS. Review [EmDash Email Setup](https://docs.emdashcms.com/guides/email/) and installed hook types before implementation; the remote Worker's `send_email` binding is not itself a Node transport.
3. Keep signed Commerce/Payments/Ship unchanged. Use the already-provisioned sender and verified test destination rather than changing DNS or signing up another provider; keep credentials private and preserve their matching recovery material. Never log message contents or codes. Do not enable production console capture or publish an inbox: development's console provider is not delivery.
4. Inspect Settings → Email again and confirm its API reports `available: true`. Use native Send Test **only to the owner-provisioned verified test inbox** named by `BACKROADBUM_TEST_SHOPPER_EMAIL`; poll the authenticated relay inbox for actual MX receipt, then delete consumed messages. Never send automated mail to the owner's personal address. Cloudflare Free rejects arbitrary unverified recipients; a successful send response is not inbound-delivery proof.
5. Complete the owner-requested live verified-inbox journey: establish one new Stripe test order under that mailbox, then actual wrong-PIN/paste/valid-PIN sign-in, own-order isolation, profile update/reload/clear and sign-out/revocation. Guard the new order/payment explicitly and do not replay TEST1009 or historical payment drivers. Do not read an OTP from the database, fabricate a shopper capability, use the staff login as a customer, or reuse a guest receipt capability as a shopper session. Retain only redacted results. Investigate any new framework failure separately before reopening the form.
6. Only after delivery and the actual shopper flow work, explicitly set the merchant's `BACKROADBUM_ACCOUNT_EMAIL_VERIFIED=1` and verify the normal public Account page on desktop/phone. This switch controls presentation, not an account API security boundary; Commerce still owns origin, OTP and session authorization. New-checkout admission remains independent. State the verified-destination limitation clearly on Account and Test store while preserving public guest checkout/receipt recovery. Check provider-rejection behavior without weakening Commerce's enumeration safeguards. Reconsider the pause when this evidence is available, not merely because the remote relay is healthy or a provider is installed.

## Separate known limitation

Signed Commerce 0.8.0's bodyless `GET account/profile` has the declaration bug already fixed upstream by [Commerce PR #257](https://github.com/dinkuskit/commerce/pull/257) (merged). The starter Account UI reads its initial profile through `account/orders` and sends well-formed profile POSTs, so that GET bug alone does not establish an Account UI blocker. Do not file it again or replace the signed Registry plugin with an unsigned patch; qualify a future signed release separately.
