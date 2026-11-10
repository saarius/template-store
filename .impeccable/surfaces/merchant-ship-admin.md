---
version: 1
slug: "merchant-ship-admin"
primary_target: "scripts/backroadbum-ship-admin.mjs"
related_targets: []
---
# Merchant Ship connection
Mode: Operate. Backroad Bum Administrators check the private Ship connection from EmDash’s existing Shipments page. Source is the peer Ship fork’s merchant `ops/backroadbum/admin.ts`, mounted as a Registry sandbox build; the named target is its browser driver.

## Direction contract
THESIS: Make the integration boundary legible; a reachable host is not an order handoff.
OWN-WORLD: Inherit native EmDash Block Kit typography, fields, banners and buttons. No storefront skin or custom assets.
STORY: The merchant sees verified read-only connection, closed intake, absent Commerce handoff and practice-only provider, then can refresh. Unknown or unsupported actions never dispatch.
FIRST VIEWPORT: Shipments heading above two-column facts, one concise no-orders banner, next integration step and Refresh connection. The unavailable state replaces the facts rather than implying zero orders.
FORM: Narrow extension of the existing native admin page; no new visual identity or concept round. Code-led.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

No label/setup actions, shared Connect buttons, external fallback links, PII or capabilities are rendered. Verify closed-grant and connected states at desktop and phone sizes. Screenshots stay ignored; no new raster ships.
