# Field Journal server-cart preparation (off live)

November 15, 2026. `backroadbum/server-cart-prep` merges upstream/main167d736 downstream into merchant7df906f, pins Commerce beta2 b460433, and carries proposed Template240's four source changes without merging that unaccepted PR. It is not eligible for production, an upstream PR, or a signed-plugin upgrade.

## Prepared
- Real server-rendered Add, Cart, Checkout and thank-you components use the existing Field Journal fonts, dual theme, proportional fields and merchant print CSS. Native variant forms submit selected options without JavaScript; retained `?item` links still work beside upstream `?variant` links.
- Checkout calls the existing session-safe prefill helper (PR237). Account client/feedback safeguards from235/239 are unchanged. The merchant parser preserves billing and accepts native `status`/`completed.at` alongside retained wrapper fulfillment, without trusting malformed completion metadata.
- Outer merchant POST admission covers plain and enhanced cart/checkout forms, since those dispatch Commerce internally. Same-origin checks, trusted proxy peer, bounded bodies, durable rate budget and the independent pause gate remain required; native cart API is not added to Caddy's public allowlist.
- Legacy browser client/storage exports remain only for retained-recovery qualification. No new cart/checkout/return component hydrates the legacy browser client; this is not an automatic protocol fallback.

## Verified scope
Node24.22.2 full Astro check:518files, zero errors/warnings. Focused cart/variant/WebMCP/projection/admission/prefill/feedback units:75pass; a separate overlapping shopper safeguard selection:46pass. Source-built beta2 Registry bundle passes its owning cap. Built playground Worker passes the owning41-case HTTP proof with synthetic Payments, including private paid contact/billing and restart recovery. Four browser contexts cover1440/390 Light/plain and Dark/enhanced add/change/reload; four-view official audits of cart/checkout/paid receipt report zero findings after excluding playground-only tour/EmDash toolbar.

Workspace evidence: `evidence/2026-11-15-field-journal-cart-prep/`. The unfiltered native toolbar has22/20px buttons; that observation remains in the unfiltered reports, not a merchant CSS repair. Fixture screenshots contain generic Dinkus products, not the real seven-family catalog. No hosted purchase, signed artifact or full browser/unit/workflow matrix is claimed. Initial low-heap checks, merge assertion/billing omissions, browser style-injection hangs and a blocked synchronous audit proxy are retained as failed attempts, not serving incidents.

## Required before live adoption
1. Qualify original retained browser capabilities through an explicit receipt handoff. The new cookie-based success route cannot yet recover an old localStorage capability; retaining the API adapter alone does not solve that UX. Never replace an unresolved attempt or replay a start.
2. Qualify actual signed0.9 stable under the existing stable Registry identity, the real merchant catalog/hosted consents, pause/rate guards through HTTPS, and old-order numbering/TEST badges, media, print receipts and shipping metadata. Beta synthetic receipts currently show opaque order IDs and missing media, not qualified TEST1001–1010 projections.
3. Update or explicitly retire legacy browser/source-shape tests; the complete unit/workflow/browser matrix was not run for this preparatory branch. Recheck proposed240 on merge and upstream235/237/239 before syncing accepted code.
4. Follow `ops/backroadbum/server-cart-upgrade.md`: snapshot with rollback, in-place stable namespace upgrade and paired merchant deploy, then one guarded TEST1011. Never deploy these forms against signed0.8 or replace the live stable identity with beta.
