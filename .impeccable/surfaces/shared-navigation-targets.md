---
version: 1
slug: "shared-navigation-targets"
primary_target: "src/features/store-shell/StoreFooter.astro"
related_targets:
  - "src/features/store-shell/StoreHeader.astro"
---
# Shared navigation targets
Mode: Operate. Reach shopping, reading, checkout recovery and policy routes with a pointer or keyboard.

## Direction contract
THESIS: Make the existing navigation easy to tap without changing its content, appearance or destinations.
OWN-WORLD: Preserve the daylight header, deep-water footer, upright wordmark, system body text and ordinary links.
SCOPE: Main and footer navigation anchor boxes only. Use at least 48×48px actual clickable areas; internal padding replaces inert footer margins. Keep focus, current-page underlines, wrapping and the existing footer columns.
EVIDENCE: Read-only 1440/390px baseline measured footer navigation at 22.8px high and phone main navigation at40.9px. Baseline images/measurements are ignored runs/backroadbum/navigation/ files.
VERIFY: Reusable verify-backroadbum-navigation.mjs checks destinations, padded-edge clicks, keyboard order/focus, 1440/390/320px, actual32px Chromium font preference and phone no-JavaScript. No POST, checkout start, catalog edit or payment recovery is needed.
FINISH: Preserve the existing visual world. Inspect desktop/phone/enlarged-font captures, run the detector once and record any inherited advisory without treating it as a new defect.
