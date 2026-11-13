# Native product content and pictures

Creekside Camp Mug was enriched through EmDash and signed Commerce on November13. `seed/backroadbum-mug-details.json` records authored copy/crop framing, not runtime product authority. Public price, stock and media order still come from Commerce; the original illustration remains the lead.

Run the read-only regression from this checkout on Node24:

```sh
node scripts/verify-backroadbum-mug.mjs --check
```

It checks published specifications/care, keyboard disclosure, three responsive pictures and current Commerce pricing at1440/390 with scripts on/off. It blocks non-GET traffic and keeps synthetic browser cart intent unchanged; it does not start a checkout. Rasters, source hashes, crop boxes and Chromium provenance remain in ignored `runs/backroadbum/mug-details/`, with dated receipts in workspace evidence. The existing bandana verifier now uses the cap for its single-picture case because the mug has a gallery.

The private action guard `/etc/backroadbum/operator/mug-details.json` is already `native-published`. Do not replay uploads, attachments or publication. A media upload completes through native `upload-url` and per-media `confirm`, not a legacy `/media/upload` response; a helper that waits for the latter can time out **after success**. Inspect the unique ready media row and compare stored bytes with the source before considering any retry. The first handle upload was confirmed this way, without duplication; both alt/caption values were saved and re-read through the native Media Library.

CMS draft isolation and Commerce media saves are different boundaries. The mug's specification/care draft stayed out of the public page until native Publish changes, while each gallery attachment took effect immediately. Native publication also rotated the mug's catalog page-claim marker/storage revision; all other catalog fields, pricing/availability rows and five other products were preserved. No sample measurement, photography, physical weight or new product-performance claim was added.
