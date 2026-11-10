# Backroad Bum deployment

Merchant branch: `backroadbum/store`, serving https://backroadbum.com. This is an explicit merchant composition, not a generic self-hosting release or upstream proposal. `PRODUCT.md` and `DESIGN.md` record the provisional brand; the original starter design is at `docs/template-design.md`.

## Current state
Five EmDash products, two collections, cart and field notes use Commerce-owned prices and availability. Public Stripe TEST checkout, same-browser paid receipts, manual demo fulfillment and webhook-driven background reconciliation are verified. Commerce runs the merchant TEST profile based on v0.8.0; Payments and Ship Registry bundles are mounted, but Ship automation and email/account recovery remain unconnected or unverified.

## Deploy and recover
- Node24.22.2/pnpm11.9.0. On this2GB host use `NODE_OPTIONS=--max-old-space-size=1200 pnpm exec astro check`.
- Store `backroadbum.service`, proxy `caddy.service`, private Payments `backroadbum-payments.service` on loopback8787. Persistent source units and operational scripts live in `ops/backroadbum/`.
- First build Commerce with `node ops/backroadbum/build.mjs` in its fork. Store deploy stages its content-hashed Registry artifact, builds a release and atomically switches `/var/lib/backroadbum/current`. Run workspace `ops/deploy.sh` as agent in a unique persistent systemd-run oneshot; failed builds are never promoted, failed health rolls back. Two releases and at most three backups are retained.
- Runtime requires `BACKROADBUM_MERCHANT_PROFILE=1`. Public checkout now deliberately uses `BACKROADBUM_CHECKOUT_ENABLED=1`; the code still defaults closed for the merchant profile. `bash ops/backroadbum/checkout-gate.sh close|open` writes a dedicated store-service drop-in and restarts it. A close persists across deploys until explicitly reopened. This never changes Stripe mode or admin authentication.
- `/api/checkout/health` is a non-creating GET advisory. HTTP200 requires installed supported TEST readiness; closed/unavailable gives503. It never prepares a capability/cart/payment/order and is not evidence of a paid purchase.
- Data: `/var/lib/backroadbum/content.db`, `uploads/`, `payments/attempts.db`. `backup.py` makes individually consistent SQLite copies plus uploads, not a cross-service atomic snapshot; provider reconciliation is required after restoration. Backups remain local; off-host and key recovery are unfinished.
- Independent telemetry and backup timers run without agent cycles. Missing usage/order/token/cost aggregates stay unavailable, not zero.

## Public request admission
Caddy must overwrite `X-Backroadbum-Client-IP` with `{remote_host}` in its store `reverse_proxy 127.0.0.1:4321` block. The listener is loopback-only; never trust browser-provided forwarding headers or expose it directly. Private Caddy credentials/configuration are deliberately not committed.

The merchant middleware checks same-origin JSON, method, bounded body and time before Commerce dispatch. Fixed ten-minute windows allow per-network/store-wide: prepare8/80, start3/20, status120/1200. Both status paths share the status budget. HTTP429 includes Retry-After and preserves the cart; existing receipts have a separate budget from starts. These are request counts, not payments or visitor analytics; conservatively counting a refused/replayed start is intentional.

Operational counters live in `/var/lib/backroadbum/admission.db`0600. `/etc/backroadbum/admission.key`0600 holds a private32-byte HMAC key. No raw IP is kept: keys include the window, and old rows are purged on the next admitted checkout request. Atomic global/peer counters survive server restart; key/storage/clock errors fail closed. This database is not a competing order model and is not included in commerce recovery snapshots; restoring/rekeying can reset request budgets but cannot authorize payment or change paid data.

## Admin and secrets
- Caddy requires a random credential on private EmDash/operator paths; EmDash additionally requires a passkey. Credentials and browser proofs stay only in `/etc/backroadbum/`0600. No production dev-bypass.
- `/etc/backroadbum/emdash.env` contains the stable plugin-settings encryption key. **Never regenerate it over encrypted settings.** Stripe env is operator-owned and unchanged; never log/source it with shell tracing. Reject non-sk_test_ secret keys; no live postage.
- `scripts/backroadbum-admin.mjs`: always saveKey and browser.close in finally; never run operator browsers concurrently.
- `backroadbum-publish-field-note.mjs field-note-SLUG --publish` creates one new source-authored field note from `seed/backroadbum-pages.json`. Without --publish it does nothing; existing CMS pages are never overwritten or republished. Edit subsequent revisions in EmDash. Published note titles/prose supply the index and related-reading links.
- `backroadbum-seed.mjs` creates missing/adopts untouched starter content without resetting merchant prices. `backroadbum-publish-guides.mjs --publish` deliberately publishes only the three source-owned operational guides (test-store, shipping, returns), leaving catalog and field notes alone.
- `/api/operator/checkout` is separately HTTP/passkey Administrator protected. It calls canonical installed Commerce guest routes, not a second payment/order implementation.

## Read-only shopper/payment checks
- `node scripts/backroadbum-shopper-status.mjs --check --public --state-file=/etc/backroadbum/public-shopper-browser.json --fulfillment=processing --order-number=1004` reads the public guest proof (#1004), checks paid TEST receipt/reload, settled cart,1440/390 layout and stranger denial. No interception, auth cookies, new checkout or payment. Optional `--capture` stays ignored.
- Same command with `--state-file=/etc/backroadbum/webhook-shopper-browser.json --fulfillment=completed` reads #1003, manually completed with synthetic tracking. The default state file reads older #1002. Never print/commit these capabilities.
- Without `--public`, first run `bash ops/backroadbum/checkout-preview.sh start`; stop after use. It serves the CURRENT release only on loopback4322, sharing the real DB with a private runner port shift18788→19788. Preview injects only its loopback peer header; public checks do not intercept traffic.
- `node scripts/backroadbum-checkout-status.mjs --check` reads operator #1001, never creates payment/order.
- Payments `ops/backroadbum/replay-webhook.mjs --check|--resend` inspects or asks Stripe to redeliver the retained real event; optional --state-file selects a shopper proof. Load private Stripe environment without echo; no fabricated local signature/new payment. Own-account provenance is independently retrieved; wakes only prompt Commerce provider lookup. See Payments' operator README.

## Next
Connect TEST-only Ship automation without changing shared services and verify email/account recovery. Receipt TEST labeling is intentionally local: upstream’s verified `commerce-payment-mode-001` decision says the shopper view does not carry mode. Other receipt extensions need contract review before being treated as upstream bug fixes. Visitor/order aggregates, cycle/token accounting and off-host recovery remain unfinished. Evidence narratives live in workspace `evidence/`; no screenshots, databases, traces or private browser state belong in git.
