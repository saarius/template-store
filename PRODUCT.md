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
Fresh deployment, November 9, 2026. No pre-existing store content, photography, customers or product claims were supplied. Source baseline: repos/template-store and exact dependency pins in its package.json. Any illustrative products are fictional demo merchandise. Road day and Slow camp are merchant-managed EmDash collections across the five products, not pre-priced bundles. On November 9 an operator completed a real Stripe TEST purchase through the installed Commerce sandbox; provider lookup produced a durable paid order and receipt ID, visible as TEST in Orders. A loopback-only preview then completed the normal guest browser-cart flow with a Stripe test card, recovered a pending attempt, and displayed its paid receipt. On November 10 a fresh test-card payment became a canonical Commerce order through signed own-account webhook delivery, a durable wake and scheduled provider reconciliation, with the return page blocked. Public checkout remains closed while sandbox fulfillment is unfinished. The preview uses normal guest endpoints, not the operator dispatcher.

## Product Principles
- Make the next shopping action clear.
- Show authoritative commerce facts, never a second price list.
- Keep test instructions findable and separate from editorial storytelling.
- Treat failure and recovery as part of the product.
- Keep operational evidence public-safe and truthful.
