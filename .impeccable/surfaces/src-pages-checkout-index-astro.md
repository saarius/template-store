---
version: 1
slug: "src-pages-checkout-index-astro"
primary_target: "src/pages/checkout/index.astro"
related_targets: ["src/pages/cart.astro", "src/pages/checkout/success.astro", "src/features/guest-cart/GuestCheckout.astro", "src/features/guest-cart/GuestCheckoutReturn.astro"]
---

# Checkout and return
Mode: Operate. Primary action: complete a test purchase, then understand and recover its receipt.

Preserve the store's daylight-blue fields and yellow action. Address forms use ordinary labeled controls; the order summary stays beside contact entry on desktop and stacks below it on phones. Put test-card instructions beside the form, not in a modal.

Only Commerce's capability-scoped paid order can confirm. Never trust a Stripe return URL as paid proof; keep pending recovery separate from new checkout. Show the canonical TEST label and explain that recovery requires the same browser's site data. No decorative stamps, imitation barcodes or promises of unconnected email/shipping services. Show Commerce’s current fulfillment separately from paid money. Label TEST tracking as synthetic text with no carrier link; complete is not delivered. Public merchant checkout is independently gated behind durable request limits. An unadmitted checkout is unavailable right now, not necessarily disconnected or awaiting its first launch. A limit is not a payment failure: preserve the cart and explain when to retry. Recovery instructions must not promise unverified email delivery.

Cart uses flat product rows and a quiet adjacent summary, stacking below the list on phones. Continue shopping is always findable; an empty browser offers Browse the gear. Quantity errors stay beside their fields, retain invalid drafts across catalog refresh, hide stale totals and prevent checkout until all are corrected or removed. Product-specific control names and stable DOM placement preserve keyboard typing and removal focus. The same quantity gate applies to the checkout summary. No-JavaScript visitors get an honest explanation and a working shop link.

Receipt rediscovery extends this surface without adding a new visual world: permanent footer and cart links open the existing return page, never an order identifier or credential in a URL. Name the latest-checkout-only browser limit and distinguish a browser with no saved checkout from an unsuccessful payment. Verify empty, corrupt and blocked storage without minting a capability; paid receipts still require canonical Commerce status. Use Commerce Orders’ canonical short number in the receipt heading when present; fall back to the complete canonical ID when not. A short display number is never a new lookup credential.

Paid receipts offer a secondary Print or save receipt action beside the retention explanation. Use the native print surface, not a modal or a download service. Print black on white with a plain branded masthead, the demo limitation, canonical number, TEST marker and the authorized receipt facts; hide navigation, art and controls. The copy is a snapshot that cannot update or restore online access. Verify desktop and phone screen layouts, keyboard action, Letter/A4 output, repeated invocation after dismissal, unchanged storage/no print-triggered network, and unavailable/pending/failed exclusion. No new imagery.
