---
version: 1
slug: "src-pages-shop-astro"
primary_target: "src/pages/shop.astro"
related_targets: ["src/pages/categories/[slug].astro", "src/features/store-shell/CollectionNav.astro"]
---

# Shop and collections
Mode: Operate. Primary action: find a relevant product, inspect it, then add it to the cart.

Preserve the daylight Backroad Bum world: light ground, upright blue display type, flat product illustrations and plain shopping controls. A wrapping link row keeps All gear and the two merchant collections visible without a menu or JavaScript; current state uses an underline and aria-current.

Collection copy and membership live in EmDash. Their published descriptions also supply the homepage’s collection links, so native draft edits must not leak there before publication. Product price, sale and availability stay in Commerce and use the same listing component on every route. Empty collections offer the way back to All gear; catalog failure is an error, not a false zero. Unknown and unpublished collections return 404 with a useful recovery link.
