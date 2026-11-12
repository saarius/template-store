---
version: 1
slug: "repos-template-store-src-pages-products-id-astro"
primary_target: "src/pages/products/[id].astro"
related_targets: ["src/features/store-shell/RelatedGear.astro", "src/features/guest-cart/product-links.ts", "src/features/store-shell/product-selection.ts"]
---

# Product inspection & onward discovery

Mode: Operate. Help a shopper inspect one product, add it to the cart, and follow its published collections to other gear. Preserve the existing image, CMS copy, Commerce price/availability, quantity controls and primary action; do not invent bundles or recommendations from order history.

## Direction contract
THESIS: A product is a useful stop in the shopping journey, not a dead end. Related gear means shared published collection membership, never a claim of compatibility or a pre-priced kit.

OWN-WORLD: Inherit daylight, blue ink, upright Barlow headings and yellow buying actions. Reuse existing Commerce catalog cards without a new enclosing panel. Remove the redundant category eyebrow and animated price scribble.

STORY: Inspect the illustration and CMS details, buy if available, then browse the same collections. Commerce alone supplies the related products' sale facts; absent membership yields no invented related list, and lookup failure is explicit.

FIRST VIEWPORT: Preserve the two-column image and buying area on desktop and stacked phone layout. A Shop breadcrumb leads to the real shop. Below Design & care, ordinary collection links precede up to three familiar product cards. No carousel or extra buying controls.

FORM: Local extension of the established product page; no identity or composition tournament. Code-led; seed: none (not applicable to local extension). The useful moment is tote → either collection → another product, with no JavaScript dependency for navigation.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Cart selection continuity · November 10
Observed a saved L cart line reopening with M selected. Restore a current Commerce member through `?item=` in server HTML; preserve sold-out selections, keep the canonical parent URL and never mutate the cart on inspection. Picker changes replace the current URL rather than adding history entries. Stale/foreign/duplicate requests start with no choice or price/Offer and a short sentence before the native option controls; choosing a current option clears it without moving focus. No new visual world, claims or imagery.

## Product enhancement fallback · November 11
Observed enabled-looking inert Add and an XL radio that retained the default In stock facts without JavaScript. Keep cart/quantity controls hidden until their existing handler marker is ready; show a plain requirement/browse paragraph otherwise. Reveal native radios only after change handlers bind. Without JavaScript, offer one labeled GET select/View option form using the existing public member selection URL: exact price/stock, sold-out inspection and stale-choice recovery, never a cart or checkout mutation. No new visual world or server authority. Issue224 records the generic report; merchant repair remains separate.

## Visible member identity · November 12
Choosing L retained the visible M SKU. Keep the identifier row tied to the exact selected member’s public SKU; omit unknown/stale member identifiers and default GTIN/MPN without another notice. Simple-product identifiers and family brand stay unchanged. Verify native GET/no-JavaScript and enhanced selections against the signed older payload; optional member SKUs use a clearly synthetic client fixture plus the pure server selector’s tests, not an unqualified signed-projection claim.

## Verification
Check disabled JavaScript, blocked script assets and ordinary enhancement at1440/390; simple-product requirement, no inert radios, native L/XL price/stock and stale recovery, normal quantity/add/cart handoff and zero checkout starts. Check cart → L, reload, copied URLs, sold-out XL, empty/removed/duplicate selection recovery, canonical metadata, preserved cart state and no-JavaScript initial HTML. Inspect desktop1440 and phone390. Check shared memberships, duplicate removal, self exclusion, bounds, no resurrection of unlinked/removed products, preserved sale/availability references, and unavailable/empty outcomes. Browser proof follows related gear to a product and back to its collection; an optional cart check adds/removes one item but never starts checkout. No new raster assets.
