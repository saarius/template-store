# Native product content and pictures

## Full-size inspection · November 16
The merchant gallery keeps its native desktop grid and phone snap strip, with an additional server-rendered group of full-size image links. Only resolved approved Commerce media becomes a link; placeholders do not. Each 48px link announces its image order, alt text and separate tab, preserving the shopping page without JavaScript, dialogs or commerce requests.

`node scripts/verify-backroadbum-gallery.mjs` checks desktop/mobile with JavaScript on/off, opens both bandana originals with the keyboard and verifies one cap/three mug links while retaining price, metadata and browser cart intent. Evidence: workspace `evidence/2026-11-16-gallery-inspection/`; public captures: `/pr-proof/gallery-originals/`. This merchant-only affordance does not reopen the upstream gallery architecture or change media/CMS/catalog records.

## Details navigation · November 15
Buying panels without a used native summary link now receive a Details & care shortcut; the tee keeps its authored measurement wording without a duplicate. The return link targets the product heading, and both directions use native fragments with scripts on or off. No summary, details block, media or Commerce field was edited; evidence: `evidence/2026-11-15-product-details-navigation/`.

From `repos/template-store`, run `pnpm exec playwright test --config=playwright.backroadbum.config.ts tests/e2e/backroadbum-product-details-navigation.spec.ts` for eight read-only desktop/phone Light/Dark script-on/off checks. Set `BACKROADBUM_ORIGIN` only for an isolated candidate. The spec covers fleece, multi-picture mug and tee, preserving selected sizes (including sold-out XL), quantity drafts, metadata and synthetic cart intent; every non-read request is refused.

## Bandana details · November 15
Switchback Bandana now has four native specification rows for cotton, 22 × 22-inch design size, contour artwork and the yellow corner, with a separate use/care disclosure. `seed/backroadbum-bandana-details.json` records authorship, not runtime content or Commerce facts; the $14 effective amount, in-stock state, gallery, summary and metadata remain unchanged. The saved draft stayed private before native publication, and all ten Orders plus unrelated CMS/catalog rows are preserved; evidence: `evidence/2026-11-15-merchant-discovery/`.

Run `node scripts/verify-backroadbum-product-details.mjs --check --source=backroadbum-bandana-details.json` for eight read-only desktop/phone Light/Dark script-on/off checks. `/etc/backroadbum/operator/bandana-details.json` is already `native-published`; never replay the historical draft/publication drivers or restore its private preimage wholesale. The dimensions are illustrative, the pattern is not a map, and no protective performance rating is claimed.

## Tote details · November 15
Glovebox Field Tote now has four native specification rows and a separate packing/care disclosure. `seed/backroadbum-tote-details.json` is an authorship checklist, not runtime content or Commerce authority; the original summary, artwork, $32 backorder facts and dimensions remain unchanged. The native draft was reloaded and checked private before publication, with Orders and unrelated CMS/catalog rows preserved; evidence is in `evidence/2026-11-15-shopper-navigation/`.

`node scripts/verify-backroadbum-product-details.mjs --check --source=backroadbum-tote-details.json` checks eight desktop/phone Light/Dark script-on/off reads, Commerce price/metadata and native disclosure keyboard behavior with writes blocked. Private `/etc/backroadbum/operator/tote-details.json` is already `native-published`; never replay the historical draft/publication drivers. Its matching `tote-details-before.json` retains the private preimage; do not restore it wholesale.

## Mug gallery · November 13

Creekside Camp Mug was enriched through EmDash and signed Commerce on November13. `seed/backroadbum-mug-details.json` records authored copy/crop framing, not runtime product authority. Public price, stock and media order still come from Commerce; the original illustration remains the lead.

Run the read-only regression from this checkout on Node24:

```sh
node scripts/verify-backroadbum-mug.mjs --check
```

It checks published specifications/care, keyboard disclosure, three responsive pictures and current Commerce pricing at1440/390 with scripts on/off. It blocks non-GET traffic and keeps synthetic browser cart intent unchanged; it does not start a checkout. Rasters, source hashes, crop boxes and Chromium provenance remain in ignored `runs/backroadbum/mug-details/`, with dated receipts in workspace evidence. The existing bandana verifier now uses the cap for its single-picture case because the mug has a gallery.

The private action guard `/etc/backroadbum/operator/mug-details.json` is already `native-published`. Do not replay uploads, attachments or publication. A media upload completes through native `upload-url` and per-media `confirm`, not a legacy `/media/upload` response; a helper that waits for the latter can time out **after success**. Inspect the unique ready media row and compare stored bytes with the source before considering any retry. The first handle upload was confirmed this way, without duplication; both alt/caption values were saved and re-read through the native Media Library.

CMS draft isolation and Commerce media saves are different boundaries. The mug's specification/care draft stayed out of the public page until native Publish changes, while each gallery attachment took effect immediately. Native publication also rotated the mug's catalog page-claim marker/storage revision; all other catalog fields, pricing/availability rows and five other products were preserved. No sample measurement, photography, physical weight or new product-performance claim was added.
