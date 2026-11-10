---
version: 1
slug: "scripts-backroadbum-ship-admin-mjs"
primary_target: "scripts/backroadbum-ship-admin.mjs"
related_targets: ["scripts/backroadbum-ship-packing.mjs"]
---

# Merchant Ship connection and practice packing
Mode: Operate. Backroad Bum Administrators check the private Ship host and save a demo origin address and their own box sizes from the existing EmDash Shipments page. Source is the peer Ship fork’s merchant `ops/backroadbum/admin.ts`, mounted as a Registry sandbox build; the named target is its browser driver.

## Direction contract
THESIS: Make packing setup usable without implying that saving it connects Commerce or creates a shipment.
OWN-WORLD: Inherit native EmDash Block Kit fields, forms, tables, banners and buttons. No storefront skin, custom assets or decoration.
STORY: See verified admin connection, closed intake and absent Commerce handoff. Open Packing setup, save a US demo return address, add/remove a named box, and return to the shipment status. Unknown, label and intake actions never dispatch.
FIRST VIEWPORT: Shipments heading, compact facts, one no-orders banner and Refresh/Packing setup actions. Packing setup is a separate in-page view: Back to Shipments, saved-state summary, origin form, existing boxes table and add-box form. Keep units in labels and typed values on validation failure. Failed transport cannot claim a save.
FORM: Local extension of the established native admin page, code-led; no new identity or composition tournament, seed: none (local extension). The useful moment is saving packing facts and confirming them after reload.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

Intake remains empty and closed. No provider credentials, shared Connect links, label actions or capabilities are rendered. Real origin addresses stay in the authenticated admin and private Ship storage, never the public dashboard/evidence; local captures use only the explicit fictional fixture. Verify protected mutation, invalid input, saved reload, add/remove and unavailable states at1440/390. No new raster ships.

## Finish — November 10, 2026
Inline review: **ship** after moving validation feedback beside its form. Reviewed saved connection, upper/lower packing, invalid and unavailable states at1440/390; inner admin scrolling required separate viewport captures, not a claimed full-page shot. Native Remove remains visible at390, values survive a rejected save, reload/restart retain saved packing and disabling the grant refuses a form submission. Detector:0 blockers,2 inherited dashboard type-ramp advisories. Workspace narrative/review: `evidence/2026-11-10-ship-packing-{cycle,finish-review,documenter}.md`.
