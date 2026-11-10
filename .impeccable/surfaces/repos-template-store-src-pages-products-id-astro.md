---
version: 1
slug: "repos-template-store-src-pages-products-id-astro"
primary_target: "src/pages/products/[id].astro"
related_targets: ["src/features/store-shell/RelatedGear.astro"]
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

## Verification
Inspect desktop1440 and phone390. Check shared memberships, duplicate removal, self exclusion, bounds, no resurrection of unlinked/removed products, preserved sale/availability references, and unavailable/empty outcomes. Browser proof follows related gear to a product and back to its collection; an optional cart check adds/removes one item but never starts checkout. No new raster assets.
