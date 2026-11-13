---
version: 1
slug: "src-features-commerce-catalog-productgallery-astro"
primary_target: "src/features/commerce-catalog/ProductGallery.astro"
related_targets: ["scripts/render-backroadbum-artwork.mjs"]
---

# Product pictures
Mode: Operate. Inspect real Commerce-backed product media, without altering price, product identity, saved cart or payment state.

## Direction contract
THESIS: A product detail should help shoppers inspect the existing design, not introduce an unrelated lifestyle claim or a modal obstacle.
OWN-WORLD: Preserve the daylight illustration stage, blue ink and ordinary focus outline. Follow the November13 owner decision: remove thumbnail controls and gallery scripting; keep the product summary and yellow cart action unchanged.
STORY: Main illustration first; an authored detail crop explains the corner and contour pattern. Commerce supplies gallery membership/order and EmDash supplies media/alt text. The extra view is an illustration, not product photography or a material-quality claim.
FIRST VIEWPORT: Existing desktop image/buying columns and stacked phone layout remain. Render the eager/high-priority lead in its pigment frame, with lazy responsive extras below in a desktop grid or one CSS phone snap strip with an88% picture/next-picture peek. Every picture keeps its alt text/dimensions and remains present without JavaScript. Scrolling changes no price, metadata or cart intent.
FORM: Narrow extension of existing product inspection and actual native Media Library → signed Product image & gallery workflow. Code-led; seed: none (local extension). No new visual identity or animation.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constraints and proof
The existing raster crop, native Media and Commerce attachment are already complete; do not reupload or attach again. The November13 direction is recorded in template-store222 comment6857894059, implemented at9123f4d with the retained native fixture/browser test. Verify desktop1280/phone412 with JavaScript on/off, image order/alt/dimensions/responsive decoding, unchanged facts/cart and confined phone touch scrolling; synthetic Chromium touch is not physical-device/Safari or qualified native arrow-key scrolling. Native lazy loading is a browser hint, not a zero-offscreen-request guarantee. No media, price, publication, order, payment or postage changes.

## Finish review · November 11
Native upload/alt save/gallery attachment persisted, with one new media record and the original primary unchanged. The original renderer exposed inert thumbnail buttons without JavaScript at desktop and phone widths; template-store issue221 records it after review of163/164 and duplicate searches. The merchant fallback keeps buttons hidden until enhancement and provides plain image links in noscript, with the same small squared thumbnail language.
Reviewed actual1440/390 JS/no-JS renders and the detail raster; the useful moment is now keyboard selection or a native link to the public detail image with browser Back. JS checks also fit320px and preserve focus, main-image alt/dimensions, current price, metadata and synthetic saved cart; a single-image mug has no invented gallery. Eleven focused tests and Astro checks pass. No full generic verification, physical-device or screen-reader claim; no new image asset is committed, and the ignored raster sidecar records source hash, crop and uploaded-byte hash. Verdict: ship merchant gallery adoption and fallback; generic qualification remains separate.

## Finish review · November 13
The owner-requested JavaScript-free gallery at9123f4d is adopted without media/catalog changes. Native public1280/412px JS-on/off checks pass ordering, authored alt text, eager/high-priority lead, lazy responsive extras, unchanged price/metadata/cart and single-image simplicity, with zero shopper writes or checkout requests. The existing primary renders at640×480 with300/600 candidates; the detail retains1200×900 and300/600/1200, preserving the image contract’s source-width cap rather than the test fixture’s uniform1200px dimensions. Inspected native desktop and phone captures retain the daylight art, clear detail crop and next-picture peek without overflow; synthetic Chromium touch/focus passes, not physical-device/Safari or qualified arrow scrolling. Verdict: ship the merchant adoption; accepted generic proof is not a signed release or shared-service deployment.
