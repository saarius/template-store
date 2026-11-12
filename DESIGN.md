---
name: Backroad Bum
description: Daylight, enamel blue and a slower weekend.
# Dashboard Read surface: distinguish signed installation, hosted connection and paid-order proof.
# November 10: report the operator login-state failure plainly; paused checkout is not readiness.
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
  reading-body:
    fontFamily: "Segoe UI, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  reading-intro:
    fontFamily: "Segoe UI, system-ui, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 400
    lineHeight: 1.65
  summary-value:
    fontFamily: "Segoe UI, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.6
  collection-title:
    fontFamily: "Barlow Semi Condensed, sans-serif"
    fontSize: "clamp(1.65rem, 3vw, 2.4rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  compact-product-title:
    fontFamily: "Barlow Semi Condensed, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.15
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

The body has no minimum width tied to rem: a real 32px browser default must not turn a phone into a 640px canvas. Reading-shell text may break an otherwise overflowing word; the homepage reading invitation uses a shrinkable single-column track on phones. Footer navigation uses auto-fitting 10rem columns, capped by the available width, so it stacks when enlarged type needs the space. Do not shrink fonts or hide horizontal overflow to pass a reflow check; browser default-font preference, zoom and OS text scaling are distinct evidence.

## Elevation & Depth
The brand layer is flat: color fields, whitespace and quiet borders separate regions. The shadow token is transparent. Product imagery scales gently in its image plane on hover, without lifting an entire card.

## Shapes
Corners are gently squared. Most large surfaces use the small radius; product listings have no enclosing border or card shell. Avoid decorative stamps and physical-material imitations.

## Components
### Actions
Primary links have a sun field, dark ink, a 48px minimum height and a small corner radius. Hover deepens the yellow. Focus uses a visible 3px outline with separation from the control. Secondary links remain visibly underlined in content.

### Product listings
Image, name, authoritative price and availability or option guidance, in that order. Variant listings say Check options in the existing quiet availability line, not the default member's stock state or an inferred family stock total; simple items keep their Commerce stock label. The whole listing links to its product page. Illustrations have cool flat grounds; prices must never be baked into artwork or copied into editorial content.

### Product inspection
The tee introduction has an ordinary underlined Compare tee measurements link, not another button or modal. Its native fragment focuses the existing product-details region without adding a Tab stop or changing the selected size. Native CMS blocks put Choosing a size instructions first, the plain M/L/XL definition list with explicit inches next, and unchanged Design & care last. Keep the illustrative-dimensions qualification adjacent to the measurements; no diagram, new color or fabricated sample-testing claim. The existing collapsible section and specification rows supply the layout on desktop and phones, with no JavaScript needed for reading or jumping.

The Switchback Bandana illustration is original source-authored artwork in `public/backroad/bandana.svg` (November10,2026), rasterized in Chromium and uploaded to EmDash Media, not committed as a PNG. Its blue cloth, cream decorative contours and yellow BRB corner belong to the fictional product, not new interface tokens. Commerce's media reference supplies the shopper image and authored alt text; never bake the price into the art. Native Sale pricing uses the same plain effective-price treatment: no crossed-out comparison, urgency badge or discount claim is reconstructed from a public payload that exposes only what the shopper pays. Paid receipts keep their frozen amounts rather than looking up today’s product price.

The bandana’s detail view is a 1200×900 crop of that same committed illustration at viewBox `280 225 240 180`, produced by `scripts/render-backroadbum-artwork.mjs`; generated PNG/provenance live in ignored runs and the native Media Library. The original remains the primary image on listings and product arrival. Commerce’s ordered pictures use a small wrapping thumbnail row directly below the stage, with blue pressed state, visible focus and descriptive Show picture names. Selection replaces the main image/alt/dimensions without moving focus or changing price, metadata or cart. Interactive controls stay hidden until enhancement; without JavaScript, a short instruction and ordinary Open picture links lead to the resolved public image and allow browser Back. No modal, fake zoom, carousel or second gallery authority; single-picture products keep no controls. Template-store issue221 records the observed no-JavaScript defect; the merchant repair is deployed separately from generic PR222 at7e3aa67. That isolated candidate preserves the starter’s own thumbnail styling and passes real desktop/phone JS/no-JS product-page checks; GitHub’s full desktop/phone/Registry/aggregate checks also pass at that head. It remains open for review, not a release or shared deployment.

The product quantity stepper keeps its quiet border and native minus/input/plus order. Each control has a 48px minimum target (the input retains its 3.25rem width); stretch the row and leave overflow visible so the outer keyboard focus ring is never clipped. Keep the existing 1–99 rules and let the wider stepper wrap naturally beside Add to cart on narrow phones, without shrinking targets.

A saved addition reveals an ordinary underlined View cart link beside its live confirmation, immediately after Add to cart in keyboard order. Keep it secondary to the yellow action, with a 48px minimum target and wrapping feedback on phones. Leave focus in place; do not open a drawer or redirect. Hide the invitation on invalid quantities, failed storage writes and when a variant change clears the success confirmation.

Product cart/quantity controls stay hidden until the existing cart-handler readiness marker is present. A plain paragraph in that same area explains the JavaScript/reload requirement and offers Browse all gear; no disabled-looking fake purchase action, alert box or new panel. Hide the paragraph only after enhancement is ready. Reveal Size radio fieldsets only after their change handlers are bound, so a checked no-script XL cannot retain M’s stock wording. Without JavaScript, use a labeled native GET select and View option action, with 48px controls and wrapping layout: its current public member ID selects the existing server-rendered price/availability view, including sold-out members. Stale requests retain the empty required choice and hidden price; this form inspects, never purchases. Template-store issue224 records the original inert buying-controls failure. Generic PR225 at8d017dd preserves the starter’s own styling and names the initially displayed option instead of adding a selection route; six desktop/phone cases and typecheck/unit/workflow/Registry gates pass, with the inherited full local admin timeout disclosed. GitHub’s full desktop, phone, Registry and aggregate CI now passes at that head; maintainer review is pending. The merchant GET form remains separate; its cart marker now follows handler attachment, never precedes it.

Visible identifier rows describe the selected member, not the family’s default. Show only its normalized public SKU when present; hide and clear that row on unknown or stale selections, never substitute an ID or a derived suffix. Default GTIN/MPN stay off variant pages because Commerce does not project them per member; simple products retain their own SKU/GTIN/MPN, and family brand remains unchanged. Server GET selection and browser changes follow the same rule without moving focus or introducing an unavailable-data notice. This merchant-only repair is separate from template214’s JSON-LD change and Commerce260’s proposed public member SKU; the signed legacy projection currently means no tee SKU row.

Keep native Size radios between the authoritative price and stock status. A sold-out size stays visible with both a strike-through and accessible sold-out wording; selecting it shows its own stock state and disables Add to cart. Sized cart lines name their option values and keep separate quantity/remove controls. Selected-offer identity is tracked in template-store #213 / PR214. Do not borrow the visible parent SKU: older signed payloads keep only page facts without an Offer, while an authoritative public member SKU enables that member’s metadata. This changes no visible line, picker, price or cart behavior.

Keep the primary product illustration, CMS summary, price, availability and yellow cart action together; use a direct Shop breadcrumb rather than a home-bound catalog label. Product prices are plain facts, without an animated underline. Below the native Design & care disclosure, ordinary collection links lead to up to three existing catalog cards from shared published collections. Reuse the catalog’s responsive grid inside the page container without adding gutters, a carousel or another enclosing panel; a secondary catalog failure gets a short browse/refresh message rather than a false empty list.

### Navigation
A compact uppercase wordmark and short plain-language links. The cart remains visible on phones. Current-page and hover states use underlines, not color alone.

Main-navigation links and footer-navigation links keep at least 48×48px actual anchor boxes. Vertically center their existing text with internal padding rather than margins that are not clickable; retain fit-content widths, normal wrapping and the existing type/color treatment. Footer columns still stack when enlarged browser fonts need the space, without clipping or shrinking the text. Keyboard order, all destinations and the 3px focus outline remain unchanged.

### Shopping collections
Unused starter Tees, Hats and Hoodies are now private native EmDash drafts after a search led to an empty collection. Their old public URLs reuse the existing missing-collection404 and shopping recovery, without a redirect, new empty-state design or theme blacklist. Intentional published empty collections retain their existing behavior; Road day and Slow camp remain the active merchant collections.

Homepage discovery puts the current nonempty published collections between the hero and full catalog: two plain, ruled columns on desktop, stacked on phones. The collection name is an underlined heading link with a 48px target and visible keyboard focus; its EmDash description follows without added counts, copied prices, cards or illustration. Catalog failure omits this secondary surface while the main catalog reports the error. Keep empty collections off this shortlist without treating a sold-out product as absent.

Within a collection, card order follows the native category’s published product references rather than global catalog iteration. Road day currently puts the bandana first and backordered tote last; this is CMS merchandising, not a new badge, stock permission or price list. Saved drafts remain invisible until native publication. Reuse the existing reference-pagination/failure fallback, retain unmatched current members stably at the end and never admit stale references; the full catalog and related-gear order remain outside this change.

The shop and collection pages share a wrapping row of ordinary links, not JavaScript tabs. All gear stays first; the current collection has a strong underline. Counts reflect only published, linked Commerce products; descriptions and membership come from EmDash. Empty collections remain addressable but stay out of navigation unless current. A catalog failure shows an error, never a false empty count.

### Missing pages
Missing generic, CMS, product and collection pages use the store’s daylight shell rather than framework branding or an automatic redirect. Keep one left-aligned heading, a short explanation, a labeled native GET search with the yellow action, then ordinary gear and field-note links. A quiet ruled paragraph offers the last checkout and its browser/latest-checkout limits without asserting payment state. All recovery controls have 48px minimum targets; search stacks on narrow phones, no address/query is reflected, and missing pages retain HTTP404/noindex without a false canonical or Product claim. Existing product-removal and temporary availability states stay distinct.

### Search
Use one plainly labeled field and a yellow Search action, followed by ordinary underlined links grouped by destination. Search shares the daylight surface and blue ink rather than introducing a dark developer panel. Stack the action below the field when needed on phones. Keep a retained query and useful browse links in both empty and unavailable states; do not present an unavailable index as zero results. Native GET submission must work without JavaScript.

### Cart
Product names are ordinary underlined links back to their published EmDash product pages, resolved from Commerce's current page reference rather than the name, SKU or saved cart. Variant members link to their shared parent page with `?item=` naming the current Commerce member, restoring its exact option even when sold out. This inspects the saved choice; it does not edit the cart. Changing the picker replaces the URL's selection without navigation or another history entry, so reload/copy stays consistent; canonical URLs remain query-free. A removed, foreign, empty or duplicate selection leaves all choices unchecked, hides price/Offer and disables Add until a current option is chosen. Put a plain recovery sentence immediately before the option controls, not a modal or global error. Preserve keyboard focus and cart storage throughout. Missing, ambiguous or unavailable CMS destinations stay plain text; a CMS navigation failure must not suppress Commerce prices. Keep links keyboard-reachable and preserve quantity focus during row updates.

On window focus or a restored page, refresh Commerce facts even when browser intent is unchanged. Keep quantity focus, invalid drafts and checkout contact fields in place; hide stale totals and block purchase on refresh failure with the existing retry control. Do not reset a failed-write in-memory cart or an active checkout attempt. No new visual container or polling indicator.

After an accepted item removal, focus the next surviving row’s quantity; at the end, use the nearest previous row, and for the final item use the existing empty message. Determine neighbours from the rendered order before removal and match surviving Commerce IDs after the update, so a concurrent cart change cannot select a removed row. Keep invalid drafts and the focus ring through the following snapshot refresh; rejected or checkout-locked removals must not move focus. This is shared by cart and checkout without changing their layout or payment actions.

Use flat item rows rather than full-width enclosing cards. Keep artwork beside product facts and quantity controls; place a quieter blue summary alongside on desktop and below on phones. The empty state offers Browse the gear, and Continue shopping stays visible above the list. Quantity and Remove controls name their product for assistive technology. When no current public name is available, keep the same heading style but say Item 1 while details are unknown or Unavailable item 1 after a missing/unlisted response, numbering by cart position so controls stay distinguishable. Do not display the catalog UUID as a title or preserve an unpublished name in the browser; successful refresh restores Commerce’s real name. Invalid quantity drafts keep their typed text through catalog refresh, show a nearby correction and suppress stale line/subtotals; every draft must be corrected or removed before checkout. Valid typing updates totals without dropping focus. A no-JavaScript explanation retains a browse path rather than showing an inert checkout.

Available on backorder uses the existing plain stock/status line from discovery through checkout review, not a badge, urgency treatment or estimated dispatch date. The tote’s native Commerce state now supplies this scenario at its unchanged $32 price; Add and checkout eligibility still follow Commerce sellability and the separate merchant gate. No new visual container or product-copy stock claim.

### Shopper account
Account is an Operate surface. When sign-in email is unavailable, replace the sign-in form with a plain explanation and one yellow Open your last checkout link, followed by the same-browser/latest-checkout limits and a quieter Continue shopping link. Do not collect an email, imply a code was sent, introduce a fake demo login or decorate the pause as a stamp/card. Keep existing-session loading independent of this signed-out notice. The route and its links work without JavaScript; say that the receipt check itself needs it. Dashboard monitoring distinguishes a public route protected by Commerce capability from one blocked by merchant Basic Auth; neither proves email delivery.

### Checkout and receipts
Native Commerce shipping-weight labels keep their existing ounce units and per-size names. The tee’s6/6.5/7 oz values are illustrative merchant inputs, not shopper-facing measured-sample or whole-package claims. A refused form can collapse Shipping while retaining all typed values: reopen it to correct, with no custom overlay or second form. Record this as a human-review Block Kit identity/default-open sharp edge, separate from Ship’s missing-weight warning and existing completed labels.

Hosted Commerce setup’s amount field and next label currently share a line even on desktop; existing DinkusKit issue123 covers this wider account-dashboard friction. The focused local website candidate retains that site’s incumbent colors and narrow wrapper: stacked native radio labels, a visible associated flat-charge label, separate dollar fields, inherited typography and at least44px targets. No new panels, JavaScript, hidden settings, POST names or payment-mode semantics; local stage-by-stage qualification and full GitHub CI pass for open PR124; review and shared deployment remain separate gates.

Native Ship's missing item weights must not read as a complete zero-weight total. Ship PR97 uses the existing Block Kit alert banner before the label form and marks the plain total `(incomplete)`; known totals and package editing keep their old behavior. The warning tells the merchant to weigh the whole package before prices or purchase, without adding a new confirmation, disabling supported actions or inventing product weights. Six 1440/390px cases use the actual EmDash1.4.0 renderer with synthetic, locally intercepted responses, not a plugin deployment. The signed store still lacks the warning; both Ship views' absent frozen size labels remain the separate coordinated handoff question in Commerce264, without an implemented repair or backfill policy.

Missing-address feedback names the delivery or billing field that needs completion instead of listing five fields when only one is blank. Keep the existing summary and keyboard behavior, with no new field decoration, validation rule or payment action; optional fields stay optional and Commerce keeps its empty-delivery authority. This merchant-only wording refinement is separate from PR223’s generic feedback-placement proposal.

Local contact-validation corrections use one plain alert paragraph immediately after the Checkout contact legend, in the existing alert colors with a visible focus ring. Explicit rejected submission focuses it and brings the message into view; Tab proceeds to Email, while typing or choosing a contact country hides and clears it without moving focus. Preserve typed addresses/cart intent and existing validation messages; do not move provider errors into this local correction surface or change unknown-payment recovery. Template-store PR223 atceae366 proposes the same generic behavior, with six targeted desktop/phone cases passing and CI pending.

Hosted basket review verified matching Commerce/Stripe totals on both sides of the configured free-shipping threshold, without submitting a payment. Keep the pre-handoff “Calculated at checkout” wording until Commerce supplies a trusted estimate; do not copy hosted policy into a second storefront authority. Commerce #262 records a distinct unresolved display gap: M/L remain separate frozen selections but become identical name/quantity lines in Stripe. No theme workaround or revised Payments contract is shipped; keep reported friction separate from a repaired payment page.

Dashboard reporting now links Payments issue118 for three retained checkouts that still lack a payable link, order or supported native investigation after their stored payment windows. Keep that report explicitly an investigation: provider evidence is unknown, not proof of an adapter fault or terminal nonpayment. Do not add an apparent reset/restart action or change shopper recovery copy merely because the report exists.

A protected pending/recoverable checkout uses the Checkout status title and a flat, ruled Original checkout section. Show only Commerce’s validated original finalTotal, with an ordinary View current cart link and a direct “not a paid receipt” explanation; today’s cart prices can differ. Hide the section while checking, on refusal/malformed data and on paid/released states. Do not infer terminal nonpayment from an old deadline, an absent redirect or the provider’s generic timeout page; keep the existing status/retry gates. No print action is exposed until actual paid confirmation.

A failed automatic availability check has a plain message and secondary Check checkout availability button beside the payment action, not an offscreen generic error. Distinguish the merchant request limit (wait a few minutes) from an unavailable check; retain cart/contact values, never claim a payment failed or that an in-memory cart was saved. The explicit button disables during the request; a completed explicit retry focuses its nearby message only if focus stayed on the button, and success hides the retry without starting checkout. No automatic retry loop, elapsed-time permission, reset or retry for a server-closed or protected active checkout.

When checkout is not admitted, say it is unavailable right now; admission alone cannot diagnose a missing connection or promise a first launch. Keep the same neutral wording in the banner, catalog, cart and request refusals. Operational setup details belong on the dashboard, not in shopper error copy.

The last-checkout route starts with Checkout status and plain text explaining that the check has not run, how to enable JavaScript/reload and why to keep the original browser’s site data. Reuse its existing status paragraph and shopping link without a new panel, warning badge or script-dependent fallback; when enhancement runs, the original controller replaces the text. Only an authoritative paid response changes the heading to Order confirmation.

Checkout is an Operate surface: daylight fields, blue text, ordinary address controls and a yellow payment action. The single editable order summary comes before contact in source and keyboard order: above the form at 54rem and below, still on the right on desktop. Keep item names/options, current prices and quantity errors visible in flat ruled rows rather than nested card shells; Quantity, Remove and Edit cart have at least 44px targets. Preserve browser-local edits and the existing payment guards. Without JavaScript, hide the unusable form and show a plain saved-cart explanation plus a shopping link; no fake or server-reconstructed cart. Keep Stripe test-card instructions beside contact entry. The paid receipt uses a plain white panel, canonical TEST labeling and the canonical short Orders number when available (for example, Order #1004); keep the full order ID as a fallback rather than deriving a short label from it; no decorative stamps or imitation barcodes. Explain browser-bound receipt recovery, and do not promise unconnected email or fulfillment services. A separate, quiet Fulfillment section shows only Commerce’s latest state; omit it when unavailable. TEST completion says no parcel was sent and labels tracking as a demo reference, rendered as text rather than a carrier link. Completion must never read as Delivered. Request-limit errors preserve the cart and name a retry action. Failed recovery directs people to the browser used for checkout, never to an unverified confirmation email. A permanent “Your last checkout” footer link and a quieter cart link reopen the capability-scoped return page without URL credentials. Explain the latest-checkout-only limit. An empty browser gets a neutral empty state, not a claim that payment failed; corrupt or blocked storage still fails closed. Keep a secondary “Print or save receipt” button in the paid receipt’s Keep your receipt section, never in pending or failed confirmation. Printing uses the authorized view without another network request. The paper layout uses black text on white, a plain store masthead, the demo limitation, canonical order number, TEST marker, items, paid totals, contact and current fulfillment; omit navigation, product art and browser controls. Keep individual rows together but allow a long order to paginate. Describe the copy as a snapshot, not live status or recovered access. Receipt verification remains available while new checkout is paused: compare the authorized signed projection, omit absent number/TEST/fulfillment fields, and retain the full canonical order ID fallback even when it shares an attempt UUID. A public order ID is not a recovery capability. Hosted Ship’s Labels table still overflows phones (issue #95); PR #96 repairs it locally, not on the shared service. The hosted Operate surface keeps its existing neutral visual language: stack each label’s named fields at 600px and below, preserve full tracking text and semantic table headers, and keep the existing print/cancel controls together with 44px targets. Desktop retains the table. Synthetic Chromium checks cover existing, older/cancelled, practice and long-field histories; no physical-device or shared-deployment proof is claimed.

### Reading and reporting
Recovery reporting distinguishes an offline encrypted-setting decryption check from a full store restart, working hosted authorization and off-host disaster recovery. Report counts and outcomes only; never show key IDs, keys, archive contents, decrypted connection values or raw errors. The existing Recovery coverage definition row and plain dated entry carry this status without new panels, download links or controls.

The existing two-size order1008 now has one sandbox label/PDF and matching canonical completion after a real provider destination refusal and native address correction. Report refusal, correction, successful label and background completion as distinct facts; a quote is not an address-validation or purchase result. Keep the illustrative whole-package input separate from unknown catalog weights and preserve the signed guest receipt’s missing fulfillment projection. No new badge, tracking promise, native admin overlay or missing-choice handoff repair is added.

Checkout readiness history stays below the current metrics in the overview, using a plain heading, prose and an ordered list rather than metric cards or an uptime chart. Display human-readable UTC timestamps, unavailable sample counts and the next observed state; planned admission closure is explicitly not recovery. Start the record at monitoring’s actual first sample, label missing history unavailable and mark retained-sample gaps unknown. The five-window limit is a retention bound, not an incident total, inferred duration or payment conclusion; existing dated cycle entries remain unchanged. The existing metrics list also names the latest probe’s fixed, plain-English outcome and elapsed milliseconds, with unknown data unavailable rather than zero. Operator failure events stay private; no raw exception/body, latency chart or retrospective cause is added.

Commerce265 reports native Orders’ internal-ID ordering after a read-only merchant task hid the newest payment below older orders. Commerce PR266 proposes a native-only chronology before pagination, using recorded payment time then deterministic number/ID ties and placing unknown legacy times last. Canonical checks, installed desktop/phone proof and full GitHub CI pass at da754ae; maintainer review remains pending and separate from a signed release. No chronology badge, sorting control, custom admin overlay or signed plugin change is shipped; the list retains EmDash’s existing visual language.

Native item choices belong directly below their own item facts, in plain wrapping Block Kit Section text such as Size: M · Color: Blue. Use only frozen label/value pairs matched by the exact line catalog item ID, never snapshot position or today's catalog; simple and historical items without choices keep their old display. Commerce PR263 proposes this after a real two-size TEST order exposed identical native item names, with installed desktop/phone proof passing. The signed store still has the omission; keep that release boundary explicit and separate from PR261's metadata rows and issue262's hosted payment display.

The experiment overview is the current-state reading route, not the full diary. Keep short latest-work and review summaries at the existing History/Contributions anchors, linking to `/dashboard/history/` and `/dashboard/contributions/`. A wrapping, 48px-target page navigation names Overview, Build history and Contributions, with an underlined current-page state; subpages have a plain return link. Preserve all dated entries in their original order and keep shared report styling and authored ledger content in one component. Owner instruction archives remain plain links ordered Original, Steer1, Steer2; adding a later steer never replaces earlier text or adds a new visual container. Keep Commerce264’s live missing-choice observation separate from the synthetic sender/receiver replay and any future accepted handoff/backfill decision. Live telemetry is read only for the overview, not to decorate historical pages. No tabs, accordions, pagination or JavaScript dependency.

Test contact examples stay in native EmDash paragraphs inside the existing guide and Shipping reading shell: invented name, reserved example.com email and a public street/city/region/postcode/country fixture, with address line 2 left empty. Keep the carrier-refusal explanation adjacent, distinguishing it from payment failure without a new alert, form, copy button or prefilled checkout data. The fixture’s earlier sandbox acceptance is evidence, not a guarantee; never expose stored shopper contacts or ask for a home address. Native draft/publication and desktop/phone/no-JavaScript source-text checks cover both pages.

Shipping and Returns use the same 52rem reading shell as field notes, not a dark support rail and enclosing card. Keep the title near the top, then a wrapping Shipping / Returns link row with an underlined current page. Published EmDash policy prose stays at 68ch; retain its headings and optional support section. A quiet blue block after the policy links directly to the browser-bound last checkout and states its latest-checkout limit. The shared EmDash support section links to the Test-store guide; use the same plain guide link as a fallback, never an invented delivery charge or service promise.

The fourth field note, A lunch stop worth taking, reuses the existing prose shell without a new hero or card pattern. Native EmDash heading shortcuts preserve four H2 sections; desktop/phone renders keep the intro and practical paragraphs readable, with related notes and gear invitation after the article. The published index excerpt comes from its first normal paragraph, and search discovers its picnic advice without indexed prices. No new imagery or product-performance claim is introduced.

Editorial pages have a single clear title and readable paragraph measure. Field notes use a 68ch body, a quieter introductory paragraph, an ordinary back link and related reading at the end; a restrained blue shopping invitation follows the article rather than interrupting it. Native numbered and bulleted lists keep conventional markers, a modest text-relative indent and .75rem between long items. Inline reading links use the existing deep-water ink with an underline and visible keyboard ring, including visited links; never disguise navigation as unmarked prose or force it into a new tab. Published EmDash prose supplies index excerpts. Dashboard facts use aligned definition lists; tables have semantic headers and wrap rather than overflow. Activity uses the same quiet definition lists, not metric cards or charts. Label retained-record counts, controller outcomes and prompt-to-final windows separately; show token counts with grouping, identify reasoning as part of output and cached context as repeated processing. Keep API-equivalent request estimates separate from invoice/budget figures, with partial coverage and unavailable values explicit. Never display session paths, record IDs, transcript text or exception details. Distinguish hosted setup from historical local proofs, and passing CI from an unmerged review. Mark the local Payments/practice Ship transports as retired, show their actual inactive process samples, and do not turn historical webhook/wake records into current hosted health. Retained databases are recovery material, not active services. Separate paused new-checkout admission from capability-scoped receipt status. Report the verified hosted owner session, successful normal Commerce settings refresh and restored retained receipt independently of fresh hosted payment readiness. Fresh native Payments TEST readiness and a real test-card purchase now supersede the earlier CAPTCHA snapshot; do not invent how onboarding changed. Distinguish the normal shopper flow through a private same-origin preview from public checkout admission, which reopened after the fresh proof. Provider payment, canonical TEST order1006, its hosted USPS sandbox label/PDF and matching Commerce completion are verified; signed guest fulfillment fields remain absent rather than inferred. Live carrier scans remain unavailable. Signed receipt payloads omit the old local number/TEST/fulfillment extras; never infer those from another order or a return URL. Bind CI status to the checked commit; an interrupted agent cycle is not a serving outage when the deployed service stayed healthy. During migration state checkout availability explicitly rather than implying a previously verified local purchase proves hosted readiness. Reserve roughly a third of each contribution table for its source link so a long description cannot squeeze repository names into a letter-by-letter column. Distinguish configured webhook transport from verified delivery, and label wake counts separately from orders; missing metrics stay unavailable. Report Ship’s authenticated admin connection and saved practice packing separately from its operator-only admission control and unconnected Commerce handoff; a deployed control with no selected order is not active intake. Keep synthetic practice/disable/recovery and actual-sandbox fixture proof separate from provider-paid store fulfillment. Eligible selected Processing orders offer Open practice shipping, an ordinary link to Ship’s protected native admin with no pass/capability in the URL. Disabled, unselected, foreign, historical and completed orders show no shipping action; never send merchants to the unsupported shared hosted-label page. The native Orders inspector currently collapses its newline-delimited metadata into one paragraph. Commerce PR261 proposes one wrapping Section per fact, keeping full IDs and both addresses readable without truncating Fields cells or changing host CSS; locally verified, not deployed in the signed plugin. The merchant admin inherits EmDash Block Kit rather than reskinning the host: aligned connection facts, a truthful empty or unavailable state, Refresh and a separate Packing setup view. Native origin and box forms state units in labels, retain typed values on validation errors and show saved results only after confirmation; keep feedback beside the submitted form, not above an unrelated long form. An uncertain save offers reload before retry. Existing boxes use a native table with a confirmed Remove action. Do not offer generic Connect, selection, live-postage or unsupported hosted-service links. The selected-order practice view keeps one obvious task: inspect the TEST order, choose a saved box, enter total packed ounces, then create one practice label. Use wrapping native sections for the full address and tracking reference, not truncating fact cells. Retain invalid weight text, refresh before retrying an uncertain creation, and show saved label facts rather than another create form. A separate Prepare print link action yields a five-minute private PDF link only after confirmation. Disabled and not-received states explain what is missing without offering writes; stored labels remain inspectable. Packing edits freeze after selection. State that a Ship record is not Commerce completion, a scan or delivery. Place recovery scope beside the latest snapshot time; distinguish a local Ship restore drill from full-store and off-host recovery.

## Do's and Don'ts
- **Do** use real product imagery or explicitly labeled illustrative designs.
- **Do** keep every state usable without motion.
- **Do** keep the demo banner concise and the detailed instructions on their own route.
- **Don't** add faux park insignia, invented reviews or unsupported environmental claims.
- **Don't** use prices or availability from the brand seed as storefront authority.
