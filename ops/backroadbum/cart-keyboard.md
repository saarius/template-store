# Cart product-link continuity

## Product option stock feedback · November 16
Keyboard selection of fleece XL exposed a plain paragraph after changing its visible stock message to Available on backorder; Chromium reported no live-region properties. The merchant PDP now renders the existing variant-stock paragraph as `role=status` with `aria-atomic=true` before any option changes, retaining the same node and native radio focus. Static simple-product stock stays unchanged.

Run `node scripts/verify-backroadbum-stock-status.mjs` from `repos/template-store`. It checks fleece XL backorder and tee XL sold-out transitions, arrow-key recovery to L, actual Chromium polite/atomic accessibility properties, selected member/price/JSON-LD/cart intent and the simple mug at1440/390 Light/Dark, blocking all non-GET traffic. This supplies browser semantics without asserting NVDA/VoiceOver speech or physical-device qualification; evidence is in workspace `evidence/2026-11-16-variant-stock-feedback/`.

## Retained cart links

Deployed November 14, 2026: the merchant cart and checkout keep their native product-title link attached while Commerce facts refresh. The former whole-copy `innerHTML` assignment dropped keyboard focus on every tab-return refresh, even when facts were unchanged. Title/destination now update in place; adjacent price/availability markup still refreshes. A legitimately unavailable destination may remove the link; no forced refocus or checkout-authority change is introduced.

From `repos/template-store`, run `node scripts/verify-backroadbum-cart-link-focus.mjs`. It uses fresh disposable contexts, blocks **all** non-read traffic (including signed Commerce’s automatic prepare endpoint), and exercises both routes at390/1440 in Light/Dark with actual catalog baseline plus synthetic name/price changes. Assertions cover node identity, focus, next Tab to Quantity, invalid drafts and unchanged intent; optional `--freeze-for-audit` writes inert public-page HTML outside git for visual inspection, never storage or capabilities. This is Chromium callback/paint proof, not native BFCache, physical-phone, screen-reader or payment proof.

Evidence: `evidence/2026-11-14-cart-tabs/` has the live baseline failure, eight final staging/live passes, populated and empty DOM audits,73unit passes, typecheck, deployment and six-business-digest preservation. Cross-tab Add and invalid drafts passed the initial exploratory check. No new upstream PR was opened: this is an independently useful merchant repair; reassess the generic renderer after the ongoing server-cart work rather than stack an overlapping protocol change.
