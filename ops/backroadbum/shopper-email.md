# Shopper email setup

## Accounts replacement rehearsal · November 23, 2026

Source-built `dinkus-accounts` at `0143b6e` (10,202-byte Registry-format bundle) passed typecheck, 22 units and seven workerd/D1 tests. In a separate built Node/EmDash 1.5 fixture, the unmodified merchant `email:deliver` handler sent one OTP to the verified inbox. A fixture-only first refusal returned `EMAIL_UNAVAILABLE` and did not block immediate retry. Real MX delivery, wrong/padded/replayed code handling, address validation and save/restart/clear, and sign-out revocation all passed through EmDash’s public dispatcher. The consumed message was cleared and the disposable DB removed.

Evidence: workspace `evidence/2026-11-23-accounts-relay/{accounts-baseline.log,real.json,cycle.md}`. The one-send driver is private and guarded; do not replay it. This checks the plugin API, not the future server-rendered account pages, HttpOnly cookie integration or checkout address prefill. Checkout remains guest-capable; the Accounts charter defers an order list in favor of Commerce’s separate order lookup. Neither plugin nor shopper state was changed live.

[Signed Accounts 0.1.0](https://plugins.emdashcms.com/plugins/@dinkuskit.com/dinkus-accounts) subsequently verified with provenance and installed as `r_l636pscu4iytrnzn` through EmDash 1.4.0 in a clean disposable store. See workspace `evidence/2026-11-23-signed-accounts-reviews/native-install.json`. That install sent no mail and does not replace the source-built relay evidence above. The remaining gate is the stable Commerce cutover with the server-rendered account and address-prefill surfaces; leave the live 0.8 account and shopper state untouched until then.

## Completed-order follow-up · November 15, 2026
Existing TEST1010 now has one free USPS sandbox label and canonical Completed state, reconciled through native Commerce Orders. One fresh real-email sign-in showed only1010, its frozen $17 total and carrier/tracking matching native/hosted Ship in Light/Dark at390/1440; the nine other Orders were excluded. No new checkout or profile write was made; the session was revoked and inbox cleared. The original guest receipt still lacks fulfillment under known Commerce275, not a new regression.

Private `/etc/backroadbum/operator/shopper-completion1010.json` is **completed** with `accountVerifiedAt`; its private preimage and existing label PDF are paired beside it. Do not replay the one-off label/email drivers. Read-only `inspect-backroadbum-shipment.mjs --check --order=1010 --hosted --pdf` rechecks the same label; the original shopper-email purchase guard/browser remain unchanged. Evidence: `evidence/2026-11-15-shopper-completion/`.

## Verified and serving · November 14, 2026

The native `backroadbum-email-relay` plugin registers an exclusive `email:deliver` hook with `hooks.email-transport:register`, only for this merchant’s hosted-Registry Node build. It reads the provisioned URL/token/from from `process.env` inside delivery, never options or `import.meta.env`. Signed Commerce0.8.0 / Payments0.5.0 / Ship0.3.1 and hosted consents are unchanged.

Native Settings → Email reports available/selected transport; a native test message and actual Commerce OTP have arrived through real MX. **TEST1010** then bought one Field Book for $12 plus $5 shipping, using one preparation, one start and one Stripe TEST Pay submission. Real email and the actual Account form proved wrong-PIN rejection, whitespace-pasted sign-in, only the matching order among ten Orders, profile save/reload/clear, sign-out revocation and stale-browser session removal. Consumed inbox messages were deleted and the original blank profile restored; no OTP or shopper capability was retained.

`/account` is now open with the Field Journal dual theme, proportional fields, associated code corrections and a footer link. The active presentation gate is `BACKROADBUM_ACCOUNT_EMAIL_VERIFIED=1` in the store’s `account-email.conf` systemd drop-in, not the execution controller. This was enabled after paid-order/API/preview proof and immediately qualified through the live UI. Guest 4242 checkout and browser-bound receipts remain independent; arbitrary visitor addresses still cannot receive codes on Cloudflare Free. This is not unrestricted email service or email-only receipt recovery for all visitors.

Evidence: workspace `evidence/2026-11-14-shopper-account/{purchase,qualification-final,provider-rejection}.json`, browser checks, audits and `cycle.md`. The original UI report stops at its mistaken HTTP503 expectation; a separate targeted rejection check completes the evidence without another OTP or purchase. Signed Commerce represents this logical delivery error in HTTP200 `{success:true,data:{ok:false,error:{code:"EMAIL_UNAVAILABLE"}}}`; the form correctly displays a recoverable error. It does not reveal whether the destination owns an account. Two attempts to the reserved unverified `example.invalid` destination were rejected; no arbitrary person or owner Gmail was mailed.

## Shared-session continuity · November 15

A two-tab intercepted browser journey reproduced a stale A profile being sent with B’s newer shared session in the actual serving merchant. The client mitigation clears old private DOM on shared identity changes and rechecks before Save/Clear/Sign out and after delayed responses, preserving B and requiring reload before editing it. This is UI continuity, not a Commerce authorization change or another real-email qualification. [Template234](https://github.com/dinkuskit/template-store/issues/234) records the report and hosted merchant Before/After proof; generic-main/head proof and full owning checks remain separate PR gates.

`playwright.backroadbum.config.ts` now opts into the shared-session and existing session-recovery specs as well as contrast. All62targeted cases pass on the built isolated merchant:22new continuity cases,34denial/transient-recovery cases and6contrast cases. The first existing-matrix run caught a candidate re-sign-in regression because a same-page denial had not advanced its local observation; the corrected candidate passes unchanged denial/new-sign-in expectations. Evidence: `evidence/2026-11-15-account-tabs/`. No real email, capability or profile was used; do not replay historical mail/purchase drivers to test this change.

## Optional checkout defaults · November 15

[Template236](https://github.com/dinkuskit/template-store/issues/236) records a separate checkout consumer race: a delayed old profile fills empty delivery fields after another tab changes the shopper session. Merchant bd68be4 checks the requesting capability after JSON decoding; twenty intercepted desktop/phone Light/Dark cases preserve newer sign-ins, typed fields and focus while allowing unchanged-session defaults. This does not erase a guest draft or values already applied before a session change, and does not repeat real email/checkout qualification. Evidence: `evidence/2026-11-15-cart-dogfood/`; run only `pnpm exec playwright test -c playwright.backroadbum.config.ts checkout-shopper-prefill.spec.ts` for this synthetic regression.

## Profile corrections · November 15
An intercepted phone/desktop task reproduced incomplete-address Save leaving focus on the button with the error above the viewport. The merchant now gives the first missing field an inline correction, `aria-invalid`/description and immediate focus; editing that field clears only its correction without moving focus or removing other guidance. Blank-address and phone-only saves, explicit Clear, provider errors and session-change safeguards keep their existing contracts; no geographic validation or real profile write is added.

`pnpm exec playwright test -c playwright.backroadbum.config.ts shopper-profile-feedback.spec.ts` runs four desktop/phone Light/Dark synthetic journeys with unknown writes blocked. Evidence is in `evidence/2026-11-15-profile-corrections/`; generic upstream qualification remains separate from the merchant repair.

## Completed operation — do not replay

Private `/etc/backroadbum/operator/shopper-email-test-order.json` records paid1010 and `accountVerifiedAt`; `shopper-email-test-browser.json` retains its original guest receipt authority, **not** a shopper login. Both are0600. At the original qualification no label was bought and1010 was Processing; the November15 follow-up above completes the same order without a new payment. The one-off purchase and actual-UI drivers are kept outside git in the evidence directory, reject completed operation state, and are not routine tests. Never replay TEST1009,1010 or historical payment/label drivers. A future scenario needs its own explicit operation guard and pre-submission persistence; uncertainty means inspect the existing Session, not start again.

## Safe operator checks · Node24, primary `repos/template-store`

```sh
node scripts/inspect-backroadbum-email.mjs --check  # staff authentication, then read-only
node scripts/verify-backroadbum-account.mjs --check # reads active/paused form and receipt navigation
node scripts/verify-backroadbum-account-input.mjs --check # intercepted synthetic PIN fixture; NO mail/session
pnpm exec playwright test --config=playwright.backroadbum.config.ts # synthetic account text contrast; NO real writes
```

These are not independent mail monitors. Explicit `verify-backroadbum-email-delivery.mjs --send-native-test` and `verify-backroadbum-shopper-email.mjs --verify-real-email` are separate real-mail actions, default to no action and must not run routinely. The latter still reports matching-order qualification false by design; the completed1010 UI evidence above is the positive own-orders proof. Native Send Test actually posts to `/_emdash/api/settings/email`, despite installed EmDash1.4.0’s `/email/test` source comment. Account endpoints use the selected Registry runtime ID, not its package name.

## Safety and known limits

- Keep `/etc/backroadbum/email.env` protected and unchanged. Only `shopper-test@backroadbum.com` is approved for automated successful delivery; **never mail the owner’s personal Gmail**. The relay token and inbox contents must never be public. Health/send acceptance is not actual inbound-delivery proof.
- Cloudflare Free delivers only to verified destinations. The transport permits only the provisioned HTTPS origin, rejects redirects/malformed runtime configuration, uses a15-second fetch within a20-second hook, does not retry and throws generic errors without provider bodies, message contents or network causes. A timeout may already have delivered mail; inspect before any explicit resend.
- The real rejected reserved destination produced `EMAIL_UNAVAILABLE`, a visible error and a re-enabled Send button, not a session. No enumeration policy or plugin contract was changed. Avoid arbitrary real-address testing.
- Bodyless `GET account/profile` still returns400/INVALID_PLUGIN_REQUEST in signed0.8.0, the known declaration bug fixed upstream by merged Commerce257. The UI’s orders-based profile read and valid POSTs work. Do not file it again or install an unsigned patch; future signed releases need separate qualification.
- Template PR #230 (`fix/account-code-paste`,238c420) reproduces maxlength6 truncation on unchanged main and removes the cap before existing strict trimmed-six-digit validation. The merchant now also removes its wider32-character cap: a long malformed insertion must not be truncated into a different valid code. Four synthetic desktop/phone Light/Dark checks intercept every write, proving padded insertion and zero verification requests for malformed input without mail or sessions. Public Before/After images and owning green CI are in the PR; inherited upstream contrast/footer defects are disclosed separately. Evidence: `evidence/2026-11-14-account-code/`.
- Template PR #231 (`fix/account-theme-contrast`,267de74) pairs fixed-chalk starter cards/status with a local Light scheme; Backroad Bum explicitly inherits the page scheme for its adaptive merchant surfaces. The opt-in merchant browser config checks Light/Dark/System at1440/390 with synthetic populated order/profile, provider refusal, save status and sign-out, intercepting every account response and blocking other writes. This supplies UI/paint proof, not real authentication or business-operation proof.
- Earlier signed-in contrast/control auditing uses a sanitized, script-free frozen DOM from the real authorized UI, plus current CSS; it does not establish interactive behavior by itself. The separate live real-session journey supplies that behavior. Never freeze localStorage, codes, tokens or private identities into public proof.

Historical transport setup and missing-provider observations remain in git and `evidence/2026-11-14-email-relay/`, with November13 evidence linked there. Linode SMTP remains blocked; do not build another provider, local cloud-service replica, production console capture or unsigned Registry substitute.
