---
version: 1
slug: "src-pages-checkout-index-astro"
primary_target: "src/pages/checkout/index.astro"
related_targets: ["src/pages/cart.astro", "src/pages/checkout/success.astro", "src/features/guest-cart/GuestCheckout.astro", "src/features/guest-cart/GuestCheckoutReturn.astro"]
---

# Checkout and return
Mode: Operate. Primary action: complete a test purchase, then understand and recover its receipt.

Preserve the store's daylight-blue fields and yellow action. Address forms use ordinary labeled controls; the order summary stays beside contact entry on desktop and stacks below it on phones. Put test-card instructions beside the form, not in a modal.

Only Commerce's capability-scoped paid order can confirm. Never trust a Stripe return URL as paid proof; keep pending recovery separate from new checkout. Show the canonical TEST label and explain that recovery requires the same browser's site data. No decorative stamps, imitation barcodes or promises of unconnected email/shipping services. Public merchant checkout stays independently gated during private preview work.
