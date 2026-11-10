# Backroad Bum
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Owner-required EmDash + DinkusKit template-store, Commerce, Payments and Ship; Node 24. SQLite and local uploads on this server, with systemd and Caddy HTTPS. Registry sandbox bundles only for commerce plugins. Commerce's Backroad Bum TEST profile isolates the merchant issuer and exact-host grant from generic DinkusKit Connect; public rollout remains independently gated.

## Users
Inferred from the owner brief: people planning short backroad trips, looking for practical camp and travel gear. A second audience is merchants and developers exercising the demo checkout and following the public experiment.

## Product Purpose
A working independent outdoor demo brand and a real merchant proving ground for DinkusKit. Success is an understandable browse → cart → Stripe test payment → receipt → sandbox fulfillment journey and useful framework fixes grounded in that journey.

## Capabilities and Constraints
All purchases are demonstrations: no real charges or physical shipments. Commerce owns price and availability; EmDash owns editorial content. Stripe must fail closed outside test mode. Admin must require strong authentication. Inventory is off until needed. Current installation and checkout status must be reported honestly rather than inferred from a catalog render.

## Brand Commitments
Confirmed name: Backroad Bum. Owner delegates catalog, collections and editorial development. Provisional voice: plainspoken, observant, practical; no ruggedness theater, invented reviews or environmental/manufacturing claims. Initial content targets a slow weekend away, not extreme expeditions.

## Evidence on Hand
Fresh deployment, November 9, 2026. No pre-existing store content, photography, customers or product claims were supplied. Source baseline: repos/template-store and exact dependency pins in its package.json. Any illustrative products are fictional demo merchandise. Road day and Slow camp are merchant-managed EmDash collections across the five products, not pre-priced bundles. On November 9 an operator completed a real Stripe TEST purchase through the installed Commerce sandbox; provider lookup produced a durable paid order and receipt ID, visible as TEST in Orders. A loopback-only preview then completed the normal guest browser-cart flow with a Stripe test card, recovered a pending attempt, and displayed its paid receipt. On November 10 a fresh test-card payment became a canonical Commerce order through signed own-account webhook delivery, a durable wake and scheduled provider reconciliation, with the return page blocked. An existing TEST order was later completed through Commerce’s manual admin form with an explicitly synthetic tracking reference. Guest receipts now read current fulfillment without changing paid totals; completion is not a carrier scan or delivery. Ship is installed but not connected to this merchant profile. Public checkout opened on November 10 after adding durable per-network and store-wide request limits and a non-creating readiness probe. A fresh unauthenticated browser completed a Stripe TEST purchase through the public domain and recovered its paid receipt at desktop and phone sizes. Ship automation is separate follow-up work. A private merchant practice-label host now runs with empty intake admission; temporary synthetic SQLite tests prove its label/PDF/event lifecycle, not an integrated store shipment. Commerce and the installed Ship plugin remain unconnected to it. Local snapshots now include Ship SQLite, metadata and its matching private print configuration; an isolated empty-host restart drill and a separate synthetic label/PDF/event recovery test pass. This is not full-store or off-host recovery. Earlier previews used normal guest endpoints, not the operator dispatcher.

## Product Principles
- Make the next shopping action clear, including a findable route back to the latest browser-bound checkout.
- Show authoritative commerce facts, including Orders-assigned receipt numbers, never a second price list or a locally invented order label.
- Keep test instructions findable and separate from editorial storytelling.
- Give field notes a complete reading path: practical EmDash-authored advice, another note and an unobtrusive way back to the gear. Never imply the fictional merchandise has been field-tested.
- Treat failure and recovery as part of the product.
- Keep operational evidence public-safe and truthful.
