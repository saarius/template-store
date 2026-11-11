---
version: 1
slug: "src-pages-404-astro"
primary_target: "src/pages/404.astro"
related_targets: ["src/features/store-shell/MissingPageContent.astro","src/pages/[slug].astro","src/pages/products/[id].astro","src/pages/categories/[slug].astro"]
---

# Missing storefront pages
Mode: Operate. Help a shopper recover from an absent page without changing cart intent or inferring payment state.
Scope: generic nested 404, missing CMS prose page, missing product and missing collection. Preserve product-removal and service-failure semantics; do not replace API, admin or security responses.

## Direction contract
THESIS: A dead address should still lead to the current store, not to framework branding or an automatic redirect.
OWN-WORLD: Inherit daylight ground, enamel-blue ink, Barlow heading and yellow search action. One reading-width column with ordinary underlined browse links; no illustration, cards or oversized 404 numerals.
STORY: State that the requested page is absent. Let shoppers search published content or browse current gear and notes. Separately offer browser-bound last-checkout recovery with its limits, never a payment claim.
FIRST VIEWPORT: Normal store header, left-aligned title and short explanation, then a labeled GET search form. A wrapping browse row follows. A ruled checkout-recovery paragraph closes the content; mobile stacks search and action without horizontal scrolling. Native keyboard search is the defining interaction; no animation or auto-focus.
FORM: Narrow hardening of the established store's missing-page states; no identity or open composition round.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Verification
Keep HTTP404, noindex and no false canonical/product metadata. Do not reflect the missing address or its query. Verify nested and CMS routes, product/collection misses, native GET search without JavaScript, keyboard links, narrow widths, and absence of checkout/write requests. No new shipping, payment, CMS mutation or upstream report is needed.
