---
name: Backroad Bum
description: Daylight, enamel blue and a slower weekend.
colors:
  ink: "#183f52"
  lagoon: "#c9e0eb"
  sun: "#f3cf62"
  sun-hover: "#eac04b"
  daylight: "#f8fbfc"
  white: "#ffffff"
  quiet-blue: "#486371"
  line: "#c4d6df"
  deep-water: "#173f53"
  footer-text: "#d4e5ec"
typography:
  display:
    fontFamily: "Barlow Semi Condensed, sans-serif"
    fontSize: "clamp(2.8rem, 5.7vw, 5rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  product-title:
    fontFamily: "Barlow Semi Condensed, sans-serif"
    fontSize: "1.65rem"
    fontWeight: 600
    lineHeight: 1.15
rounded:
  small: "4px"
spacing:
  tight: "8px"
  standard: "16px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.ink}"
    rounded: "{rounded.small}"
    padding: "0.7rem 1.25rem"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.sun-hover}"
---
# Design System: Backroad Bum

## Overview
**Creative North Star: "The swimming-hole noticeboard"**
A clear daylight storefront: upright lettering, broad blue fields and useful yellow actions. Outdoors photography gives the site a place to breathe; flat product illustrations make the fictional merchandise easy to inspect. The identity is provisional and can evolve with actual merchant use.

**Key Characteristics:**
- Cool, light grounds rather than aged-paper nostalgia.
- Plain shopping controls and a compact, bold wordmark.
- Photography and product art, not decorative badges or invented social proof.

## Colors
Lagoon carries whole content regions. Sun marks an action; deep water anchors the footer and demo banner. Quiet blue is secondary text, never an excuse for low contrast.

**The Daylight Rule.** Keep product inspection on light surfaces and use dark blue ink for the reading layer.

## Typography
Barlow Semi Condensed is self-hosted in weights 600 and 700. Use it for headings and the wordmark; use the system sans stack for body copy and controls. Product headings are visibly larger than their prices. Long copy stays within roughly 72 characters per line.

**The Upright Rule.** Let scale and wording carry hierarchy, rather than tiny tracked labels above headings.

## Layout
Containers are at most 70rem wide with 1rem minimum side gutters. Desktop product grids have three columns, then two below 45rem and one below 34rem. The main navigation moves beneath the wordmark on small screens. Wide photographic regions and blue text regions stack cleanly on phones; no content waits for an entrance animation.

## Elevation & Depth
The brand layer is flat: color fields, whitespace and quiet borders separate regions. The shadow token is transparent. Product imagery scales gently in its image plane on hover, without lifting an entire card.

## Shapes
Corners are gently squared. Most large surfaces use the small radius; product listings have no enclosing border or card shell. Avoid decorative stamps and physical-material imitations.

## Components
### Actions
Primary links have a sun field, dark ink, a 48px minimum height and a small corner radius. Hover deepens the yellow. Focus uses a visible 3px outline with separation from the control. Secondary links remain visibly underlined in content.

### Product listings
Image, name, authoritative price and availability, in that order. The whole listing links to its product page. Illustrations have cool flat grounds; prices must never be baked into artwork or copied into editorial content.

### Navigation
A compact uppercase wordmark and short plain-language links. The cart remains visible on phones. Current-page and hover states use underlines, not color alone.

### Shopping collections
The shop and collection pages share a wrapping row of ordinary links, not JavaScript tabs. All gear stays first; the current collection has a strong underline. Counts reflect only published, linked Commerce products; descriptions and membership come from EmDash. Empty collections remain addressable but stay out of navigation unless current. A catalog failure shows an error, never a false empty count.

### Checkout and receipts
Checkout is an Operate surface: daylight fields, blue text, ordinary address controls and a yellow payment action. Keep Stripe test-card instructions beside contact entry. The paid receipt uses a plain white panel, canonical TEST labeling and readable order identifiers; no decorative stamps or imitation barcodes. Explain browser-bound receipt recovery, and do not promise unconnected email or fulfillment services.

### Reading and reporting
Editorial pages have a single clear title and readable paragraph measure. Dashboard facts use aligned definition lists; tables have semantic headers and wrap rather than overflow.

## Do's and Don'ts
- **Do** use real product imagery or explicitly labeled illustrative designs.
- **Do** keep every state usable without motion.
- **Do** keep the demo banner concise and the detailed instructions on their own route.
- **Don't** add faux park insignia, invented reviews or unsupported environmental claims.
- **Don't** use prices or availability from the brand seed as storefront authority.
