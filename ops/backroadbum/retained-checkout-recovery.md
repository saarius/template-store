# Original hosted checkout recovery

## Verified November 14, 2026

The three original November11 attempts ($79, $76, $73) now return `released-retry` through the public wrapper and signed Commerce0.8.0 native status route. Their durable Commerce records say `paymentReleaseReason: expired-unpaid`, retaining original totals and provider timestamps, with no orders. This supersedes the earlier pending observation; it does not establish when the hosted behavior changed.

The shopper action is **Cart → Check checkout status → Proceed to Checkout → Check checkout status**. The review then enables payment submission. Both page loads deliberately require a status check in the current merchant client; merely opening Cart is not an automatic unlock. Four real-store checks cover all three original browser states, desktop/phone and Light/Dark, without a replacement prepare/start, contact submission or payment.

Evidence: workspace `evidence/2026-11-14-hosted-recovery/`; public update [Payments118](https://github.com/dinkuskit/payments/issues/118#issuecomment-6870701600). The existing local receipt/print checks remain separate paid-order proof.

## Reusable check

From the primary `repos/template-store` checkout on Node24:

```sh
node scripts/verify-backroadbum-released-checkout.mjs
# No action without --check and an explicit private input.
node scripts/verify-backroadbum-released-checkout.mjs --check \
  --state-file=/etc/backroadbum/shipping-threshold-below-browser.json \
  --width=390 --scheme=light
```

The other retained inputs use `above` and `sizes` in the same filename. Never publish these files or their contents. The check restores only the original guest capability and a cart validated by the actual intent parser; it strips staff/shopper cookies, other origins, contact fields and preferences. It refuses every POST except the public status route, takes no payment/contact action, keeps the original capability/attempt/cart and asserts that the input file's bytes do not change. A real authoritative status read may reconcile Commerce; this is not a zero-side-effect database query or a scheduled probe.

A page-side observer reads a **clone of real status responses** before navigation and reports only booleans/state. It does not intercept/fulfill the status answer, invent terminal evidence or create a session. This avoids Chromium's intermittent loss of response bodies to out-of-page `response.json()` readers. The guard remains strict: every observed status must be200/ok/released with the original attempt/retry fence, no order and no redirect. Ignored `runs/backroadbum/released-checkout/<width>-<scheme>/` contains screenshots and a reduced report; a newly paid result fails before capture, not a public receipt export.

## What is not proved

Payments119 merged the deferred-PaymentIntent expiry exception and size descriptions. The exact hosted Worker revision and these originals' Session/PaymentIntent objects have not been independently inspected. The separate local Stripe sandbox key recognizes its own sandbox but receives404/resource_missing for the hosted connected-account Sessions; that is a scope limitation, not absent-session or explicit-null proof. No shared deployment, credential change or Registry replacement was made here, and issue118 stays open for that remaining explanation.

Server-cart adoption remains separate. Freshly observed Commerce272 is at `a966e82` and Template229 at `580a054`; the upstream owner accepted kernel-only compatibility evidence instead of an installed0.8.0 upgrade run. That upstream decision does not qualify these source heads on this merchant or remove this store's preservation requirements. See `ops/server-cart-upgrade.md`; legacy recovery mode remains serving.
