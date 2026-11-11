---
version: 1
slug: "browser-font-reflow"
primary_target: "src/styles/theme.css"
related_targets: ["src/features/store-shell/global.css", "src/features/store-shell/StoreFooter.astro", "src/pages/index.astro"]
---

# Browser font preference and shared-shell reflow

Mode: Operate for shopping; Read for editorial/reporting. Preserve the daylight palette, upright lettering, authored content and Commerce facts. This is a narrow accessibility refinement, not a new visual world.

Full Chromium with its native default_font_size32 preference produces a32px root and expands the inherited20rem body minimum to640px on a390px viewport. Headless shell ignores that preference; synthetic root CSS is useful diagnosis but not native preference proof.

Remove the merchant body's rem minimum without concealing horizontal overflow. Reading-shell text can break otherwise overflowing words. Let the homepage reading invitation's narrow grid track shrink, and let footer navigation auto-fit10rem columns bounded by available width. Keep fonts and focus targets intact; leave wide layouts and all cart/payment rules unchanged.

Verify real16px/32px browser profiles at1440/390/320, with paired Commerce prices, keyboard quantity/cart/contact correction, footer destinations and representative shopping/reading/dashboard routes. Retain only reusable tests in git; screenshots and temporary profiles stay out. These checks do not establish physical-device, OS text scaling, full WCAG or browser-zoom coverage.
