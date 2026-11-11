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
OWN-WORLD: Preserve the daylight illustration stage, blue ink, small squared thumbnail controls and ordinary focus outline. Keep the product summary and yellow cart action unchanged.
STORY: Main illustration first; an authored detail crop explains the corner and contour pattern. Commerce supplies gallery membership/order and EmDash supplies media/alt text. The extra view is an illustration, not product photography or a material-quality claim.
FIRST VIEWPORT: Existing desktop image/buying columns and stacked phone layout remain. A wrapping thumbnail row sits directly beneath the main image. Choosing a view changes only the image and its accessible description, without moving keyboard focus or touching cart intent.
FORM: Narrow extension of existing product inspection and actual native Media Library → signed Product image & gallery workflow. Code-led; seed: none (local extension). No new visual identity or animation.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constraints and proof
One new raster crop from the original committed bandana.svg, generated into ignored runs/ with source/crop provenance; upload through native EmDash and attach through signed Commerce, keeping the original primary image. Durable private mutation guard before upload/attachment. Verify persistent native read-back, actual gallery interactions/alt/currentSrc, keyboard and phone layout, and no-JavaScript behavior. No price/publication/order/payment/postage changes. Any observed defect needs evidence and target research before an upstream report.

## Finish review · November 11
Native upload/alt save/gallery attachment persisted, with one new media record and the original primary unchanged. The original renderer exposed inert thumbnail buttons without JavaScript at desktop and phone widths; template-store issue221 records it after review of163/164 and duplicate searches. The merchant fallback keeps buttons hidden until enhancement and provides plain image links in noscript, with the same small squared thumbnail language.
Reviewed actual1440/390 JS/no-JS renders and the detail raster; the useful moment is now keyboard selection or a native link to the public detail image with browser Back. JS checks also fit320px and preserve focus, main-image alt/dimensions, current price, metadata and synthetic saved cart; a single-image mug has no invented gallery. Eleven focused tests and Astro checks pass. No full generic verification, physical-device or screen-reader claim; no new image asset is committed, and the ignored raster sidecar records source hash, crop and uploaded-byte hash. Verdict: ship merchant gallery adoption and fallback; generic qualification remains separate.
