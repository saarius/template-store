# Backroad Bum — Field Journal

Living `ui-design` specification · Owner Steer 4 · November 13, 2026.
This replaces the former light-only enamel-blue theme. Historical design decisions are retained in `evidence/2026-11-13-redesign-phase1/DESIGN-before.md`; they are not a visual freeze.

## Direction
A small outdoor outfitter with the pace of a field journal: expressive serif headlines, precise sans-serif tools, mineral surfaces and one rust-colored action. Photography supplies the sense of place; the original product illustrations honestly describe fictional merchandise. No invented testing, reviews, dispatch dates, certifications or environmental claims.

The flagship home uses an asymmetric photograph/copy composition rather than a photo banner above a blue noticeboard. Shop and reading routes remain separate, with real collection links between the opening story and the full catalog. The demo boundary remains explicit and the detailed test-card guide stays one click away.

## Benchmarks and interpretation
- **Anthropic / editorial:** serif–sans contrast, warm canvas and calm reading measure; not its proprietary font or branding.
- **Google Store / consumer:** proportional image stages and clearly separated action weights; not its logos or product claims.
- **Airbnb / commerce:** image → name → quiet availability → authoritative tabular price, consistent geometry and useful proximity.
- Local DNA cards and generated color/scale output are recorded in `evidence/2026-11-13-redesign-phase1/`. No scraped media enters the source repository.

## Typography
Two active self-hosted families, Latin variable WOFF2 with `font-display: swap`:
- **Fraunces 500–700:** display, product names and editorial headings. Optical sizing enabled; weight 500 is the default, tracking −0.025em to −0.04em.
- **DM Sans 400–700:** body, navigation, forms, prices and operations. Body is 1rem / 1.618; quiet text is .875rem, never a low-contrast substitute for hierarchy.
- Files, exact sources and OFL licenses are in `public/backroad/fonts/`. Old Barlow files are retained for history but no longer declared or loaded.
- Marketing follows the generated φ half-step scale: 16 / 20 / 26 / 33 / 42 / 68px. The hero's mobile floor is 40px, desktop ceiling 67.8px. Editorial uses √2, webapp 1.2, dashboard 1.125; all four route-specific phases are now implemented.
- Text measure is at most 68ch, with a 54ch default for DM Sans’s wide numeral metric; headline measure is about 12–24ch. Use balanced headings and pretty paragraph wrapping; never shrink text to conceal overflow.
- All prices, quantities, totals and telemetry use tabular numerals. Identifiers wrap; they are not decorative monospace.

## Color system
Canonical implementation: `src/styles/theme.css`. `ui-design/color-harmony.mjs --seed '#a74c2e' --harmony split-complementary` supplies the perceptual wheel: rust **38.6°**, mineral teal **188.6°**, slate **248.6°**.

| Semantic token | Light OKLCH | Dark OKLCH |
| --- | --- | --- |
| Canvas | 98.5% .004 38.6 | 14.5% .009 38.6 |
| Surface | 100% 0 38.6 | 19% .010 38.6 |
| Raised / muted surface | 95.5% .007 38.6 | 23.5% .011 38.6 |
| Text | 20% .012 38.6 | 94.5% .005 38.6 |
| Muted text | 46% .011 38.6 | 72% .008 38.6 |
| Primary / rust | 52.7% .128 38.6 | 68% .118 38.6 |
| Primary foreground | 99% .005 38.6 | 13% .015 38.6 |
| Control border | 62% .011 38.6 | 52% .011 38.6 |

The palette generator reports text/canvas 17.36:1 light, 16.85:1 dark. Painted browser contrast, focus and actual image contexts still require inspection. Body text must meet 4.5:1; large text, active indicators and control borders must meet 3:1. Decorative dividers may remain quieter.

Allocate roughly 60% canvas, 30% surfaces/photographic structure and no more than 10% focal accent. Dark elevation steps lightness upward, never adds black drop shadows. `--store-*`, `--dinkus-action-*` and transitional `--brb-*` aliases preserve the existing components' contracts without changing their data. Legacy blue/yellow names are aliases, not a second palette.

## Appearance and state
- **System is the first-visit default**, using native `color-scheme: light dark` / `light-dark()`; OS changes take effect without a polling listener.
- The footer's labeled **System / Light / Dark** select has a 48px target and a 12rem proportional width. It is revealed only after binding; without JavaScript the site follows the device and says so.
- A shared inline head bootstrap reads only `backroadbum.theme` before first paint. Valid explicit choices are applied immediately, invalid/blocked storage falls back to System. Theme changes never touch cart, contact or checkout keys. A refused preference save still applies for the current page with quiet feedback; other tabs synchronize via the storage event.
- `theme-client.ts` owns this merchant-only preference. Native focus outline, selected option, hover fill, active feedback, disabled states and storage refusal are designed states, not afterthoughts.
- Default token archetype is **Field Journal**. Optional `data-archetype="trail-supply"` switches to the same installed sans family, sharper radii and a generated green action without markup changes; this is not a shopper-facing theme choice or a second store.
- Reduced motion disables nonessential transitions and smooth scrolling. Content never waits for an entrance animation.

## Geometry and shell
- Marketing container: max 80rem, 1.25rem minimum side gutters. Reading and operating pages retain narrower task containers.
- Mobile first. The hero stacks copy then photograph; at 60rem it becomes **1fr : 1.618fr**, with a 4rem outer gap. Image and original caption sit in a rounded stage without text overlays.
- Spacing uses .25 / .5 / .75 / 1 / 1.5 / 2 / 2.5 / 4 / 6.5rem. Label/input gaps stay below field gaps; section/group spacing is at least 1.6× its internal counterpart.
- Radii: 8px controls, 16px cards, 24px panels. Nested shapes use outer radius = inner radius + padding or remain flush, never pinched identical radii at different insets.
- Header: compact two-line DM Sans wordmark, ordinary main navigation, visible cart. On phones navigation occupies its own wrapping row; no hidden script-dependent menu or lost no-JavaScript route.
- Footer: editorial brand introduction, two labeled navigation columns, then appearance. Policy and last-checkout links remain prominent; the final colophon separates site identity from platform attribution.
- Demo banner is a restrained dark strip with the authoritative existing admission copy and a 44px guide link. It never claims checkout readiness from a catalog render.

## Home
- Native EmDash headline, deck and CTA destinations remain authoritative and unchanged. The existing landscape is eager/high-priority, with honest authored alt text and no fabricated place name.
- Two published nonempty collections use tactile, bounded text cards. Their copy and membership still come from EmDash; a failed catalog read cannot invent an empty collection list or copied prices.
- All published product families continue through the signed Commerce catalog. Cards gain tonal surfaces and quieter body facts; no indexed or seeded price becomes shopping authority.
- A final 1.618:1 reading invitation leads to Field Notes with distinct serif rhythm. No extra carousel, fake testimonials, newsletter collection or duplicated shopping flow.

## Shop, collections, product and search · Phase 2
- Shop and collection containers align to the shell's 80rem / 20px gutters. The introduction separates its lead from a quiet illustrated-design note; 48px collection filters mark the current route with both underline and rust border.
- Catalog cards use flush 4:3 native image stages, 24px body padding and a two/three-column responsive grid (one column on phones). No colored bloom or hover recoloring touches the product art. Names lead, followed by tabular Commerce prices and quiet availability; a whole-card link keeps one destination and no nested shopping control.
- The desktop PDP is **1.618fr : 1fr**, top aligned at 60rem, with a quieter product heading than the home hero. The native no-JavaScript gallery retains the original image order, crops and eager/lazy hints. A quiet full-size image link group below it uses 48px outlined targets, descriptive image-order/alt accessible names and an explicit new-tab notice; originals open separately with noopener, preserving the shopping page. Links use only approved resolved media, never placeholder fallback URLs; no modal or gallery script is added. Native specification rows and care disclosures sit under a distinct Details & care heading; no CMS copy is duplicated in theme data.
- Variant pills have 48px targets, a 2px selected border and an `aria-hidden` checkmark; sold-out choices remain inspectable and visibly struck through. Native radio arrows, focus rings, original no-JavaScript GET fallback, stale-selection notice and exact Commerce member matching remain unchanged. Decorative marks must never become part of a radio's accessible name.
- Search follows the webapp title scale rather than a marketing hero. One rust action submits an ordinary GET form; grouped results retain native destinations, published previews and actual highlights without adding indexed prices. Surface cards separate result groups from form guidance.
- Regular/Sale comparisons render only when the signed projection supplies both. The current signed0.8.0 projection returns the effective amount alone for the bandana, so no struck-through seed or indexed Regular amount is invented. This is a data-contract limitation, not a styling decision.

## Cart, checkout, receipt and reading · Phase 3
- Cart and checkout follow the **1.2 webapp scale**: the title tops out at2.488rem, keeping the order and form rather than the heading as the task's focal point. Tonal 24px panels with24px padding and8px controls replace heavy outlines and mismatched radii. Mobile keeps its existing order-summary-first source order; desktop retains contact left, summary right in a1.618:1split.
- Contact labels sit4px above inputs; the next label is separated by16px plus the grid gap, and address groups use40px. Email/name fields cap at22rem, address lines at32rem, state/region at14rem and postal codes at10rem. The same-as-delivery checkbox has a full labeled48px target, an explicit selected surface, and still controls the existing conditional billing section. Field identities, autocomplete, validation/focus behavior, countries and server admission are unchanged.
- Checkout contact and payment controls share a named native form. Enter and pointer submission use the same custom validation/focus, admission and in-flight guards; `novalidate` preserves the associated inline corrections rather than adding native validation bubbles. The manifest’s quantity controls stay outside the submit form, auxiliary actions stay `type="button"`, and no-script guidance keeps the unbound form inaccessible. No contact/capability values become native query submissions.
- A quiet test-card inset puts4242, future expiry/CVC and the full guide alongside the form. Prices and shipping stay Commerce's; unquoted shipping/tax are not replaced with a theme estimate. Browser fixtures intercept prepare/status and refuse all starts for visual proof; a simulated paid receipt is never evidence of a provider payment.
- Receipt presentation lives in `receipt-screen.css` under **@media screen**. The canonical receipt, TEST badge, totals, delivery and fulfillment retain their native DOM/data; totals align on a quiet right axis and pending amounts stay in a separate panel with no print control. `receipt-print.css` continues to own paper geometry and excludes navigation, controls, thumbnails and capabilities.
- Field Notes opens with an asymmetric copy/photograph split, one featured published note and quieter two-column reading links. Ordinals are decorative/aria-hidden, not invented dates. The existing photograph/credit and native note ordering remain intact.
- Articles use the generated editorial scale: expressive title, serif opening paragraph, DM Sans body at17–18px/1.75 and at most65ch. Chapter gaps are64px, versus24px paragraph spacing. Back/related/shop links work without JavaScript. Guides share this reading rhythm with smaller task headings and clear policy navigation; their native CMS words are not duplicated or edited by the theme.

## Native editorial depth · November16
The departure note uses the existing article hierarchy unchanged: four native headings, a real four-item ordered list and ordinary inline reading links. Do not turn safety guidance into decorative callout cards or shopping prompts; native source order, 65ch measure, script-free links and complete print content remain the contract. Four live390/1440 Light/Dark audits and eight script-on/off journeys pass; the earlier file-based manuscript preview used fallback fonts and is not the final typography proof.

## Public experiment dashboard · Phase 4
- Operating typography follows the generated **1.125 scale**: a DM Sans title capped at2.027rem, section headings at1.266–1.424rem and1.125rem subheadings. No marketing-size reporting hero. Tabular numerals cover samples, tokens, amounts and identifiers.
- Four sampled metric cards distinguish process state, advisory readiness, memory and explicitly unavailable visitor/order aggregates. A stale probe is called stale; advisory readiness is never payment proof. The sampled timestamp and detailed operations remain accessible through a native disclosure.
- Separate review cards distinguish accepted source fixes from pending heads and explain the real store friction. Keep sampled GitHub status dated; preserve public proof after worktree retirement and never imply that a merge updates a signed plugin or shared service. The candidate table gives each branch a concise disposition, with every original evidence/deployment note retained behind a native keyboard-operable details control. On phones each semantic row becomes a stacked card; table captions and header associations remain available.
- The overview keeps one current dispatch; older dispatches and review context remain in labeled disclosures. The dated history is still newest-first, with136 entries and all135 prior article bodies unchanged. No client pagination, search indexing of private logs or reporting-side write action is added.
- A six-surface Before/After showcase links original1440px captures to final-phase Light/Dark desktop and390px phone captures. Media stays outside git. All five archived instruction versions, including Steer4, remain in date order and unchanged.
- Dashboard components add no JavaScript. Navigation, disclosures, instructions and evidence work without scripting; only the existing shared appearance preference needs enhancement.

## Traffic observations
The fourth operations card reports recorded page responses for seven UTC dates, not visitors or orders. Reuse the existing tabular metric/status/disclosure primitives: a native privacy/method disclosure supplies today/seven/thirty-day counts, observation start and filtering limits, with unavailable text for missing or stale data rather than a fabricated zero. This adds no tracking script, identifier or new chart idiom; initialized zero, positive, stale and absent projections require separate checks.

## Server-cart preparation · off live
The isolated `backroadbum/server-cart-prep` branch carries the same Field Journal token system onto upstream server forms, not a second visual direction. Keep the 1.618:1 contact/summary desktop split and summary-first phone layout,48px controls, proportional postal/region fields and tabular totals; native option inputs belong to the actual Add form, so the ordinary POST remains useful without JavaScript. The receipt uses the merchant screen/print surface instead of decorative stamps and barcodes. November15 scoped cart/checkout/receipt Light/Dark audits pass at390/1440 with synthetic Payments and generic products, excluding only the playground host toolbar/tour; original-browser recovery, real signed catalog/receipt visuals and complete regression qualification remain separate gates before deployment.

## Earlier-checkout handoff · off live
`/checkout/retained` keeps the Field Journal receipt geometry and a deliberate48px read action, with separate pending/failure guidance and a print-clean paid view. It reads the old browser capability without adopting it into the current cart cookie; cross-tab retention changes remove painted private details. November15 actual old-kernel disposable browser proof passes at390/1440 in both themes, with no overflow; the official four-view painted snapshot audit has zero findings. Real retained merchant browsers, numbered/test-badged receipts, signed artifact and full regression qualification remain separate cutover gates. Synthetic captures stay outside git under `/pr-proof/retained-receipt-prep/`.

## Optional receipt artwork · off live
Server thank-you and explicit earlier-checkout reads share the same exact-item public catalog/Media Library fallback. Current artwork is visual context, never a source for paid names, options, SKUs, quantities or money; preserve an existing safe frozen image, use a neutral placeholder on unavailable/unpublished/unsafe media, and omit optional artwork rather than exceeding the receipt transport bound. Print keeps purchase text and excludes images. Four-view actual-old-kernel fixture proof and the painted audit pass; canonical number/TEST marks render only if supplied, and beta2's absent fields remain the separate Commerce283 request rather than invented UI facts.

## Field notes on paper
The browser’s Print / Save as PDF command gets a field-note-only paper layout; there is no new script or print button. Keep Fraunces/DM Sans at readable print sizes (24pt title, 14pt section headings, 11pt body / 1.5), a 68ch measure and16mm page margins. Use black ink on white paper independently of appearance, keep headings with their following text and avoid splitting individual list items or example quotes. Hide navigation, related reading/shopping and the footer, but retain the complete native article, a compact demo context and the canonical source address; do not append browser capabilities or query strings. All rules require the field-note body marker, so receipts and other CMS pages keep their own print behavior. Chromium A4 PDF is verification, not a claim about physical printers or every browser.

## Account profile corrections
A rejected explicit Save points to the first missing address field in form order, with a concise inline correction and associated invalid state. Focus and an immediate non-animated scroll keep the field and correction visible; typing clears only that field’s correction, retains unrelated description tokens and never jumps elsewhere. Use existing alert ink and merchant spacing tokens, preserving blank-address/phone-only behavior and clearing stale corrections with successful profile replacement or session changes.

## Product details navigation
Keep product inspection within one native-page round trip: a quiet 44px text link below the summary reaches the existing Details & care section, then a return link focuses the product heading above the options. Preserve an actually used authored summary link (including the tee’s measurement wording) instead of adding another shortcut; unused definitions do not count. Use the established ink/accent/focus tokens and native fragment navigation, without scrolling scripts or smooth-motion dependence. Hash changes retain selected-size queries, quantity drafts, metadata and cart intent; products without details gain neither link.

## Journal continuation
Keep the existing quiet two-link reading footer and shop invitation. Choose the next two notes in the published index’s stable slug order, wrapping once at the end and excluding the current article; with fewer notes, show only the available destinations. This is a reading sequence, not a relevance, publication-date or popularity claim. Native titles and addresses come only from the published CMS collection; an unavailable optional read still leaves the article and shop link intact. No new controls, client navigation or print content are needed.

## Collection reading
Place optional reading after the complete product shelf, never between a collection introduction and its gear. Use the existing 1:1.618 intro/reading split on desktop and a simple phone stack, with native title-named whole-card links, 220-character opening previews, 44px minimum targets and the same surface/ink/focus tokens. At most two stable-slug-order published notes qualify through an actual used native link to a current collection product; unused link definitions, product-name guesses and external URLs do not establish a relationship. Skip this secondary shelf in CMS preview/edit mode or on read failure rather than breaking shopping or exposing drafts; no second tag list or recommendation catalog is introduced.

## Bandana specifications & care
Keep the existing Field Journal specification/disclosure pair: four short rows for the bandana’s design facts, followed by native, keyboard-operable use/care text. Retain original gallery and summary; the checklist is authorship evidence, never runtime content or pricing. Keep illustration dimensions and the decorative-not-a-map boundary explicit without presenting physical test or protection claims; preserve the same reading hierarchy with scripts on/off in both themes.

## Tote specifications & care
Use the existing native specification/disclosure pair rather than a new card idiom: the tote’s four design facts occupy the wider desktop column, packing/care the narrower column, stacking on phones. Preserve the original dimensions and explicitly distinguish illustration dimensions from measured samples or load ratings; Commerce alone owns the $32 backorder state. The native disclosure remains keyboard-operable without JavaScript, in both themes, with browser intent and metadata unchanged.

## Journal examples
Native field-note quotes use a body-type inset with zero inline margins, existing surface/ink tokens, a rust leading rule and16/24px inner padding. This preserves reading width on phones rather than inheriting40px browser margins on both sides; quotes are examples within the article, not oversized testimonials. Authored sample entries must be explicitly identified as invented nearby, never attributed to a real traveler or presented as a product field test. Headings, list items, links and quote text remain native CMS content; the source manuscript is only an authorship/test checklist.

## Verified-inbox email
Account and Test store share a quiet, token-based explanation of Cloudflare Free’s verified-destination sandbox, separate from the native guide and primary receipt action. State that other visitor addresses cannot receive codes, without exposing the inbox or suggesting that public guest checkout needs an account. The public sandbox form is open after TEST1010 and actual email/UI qualification; this remains dated evidence, not unrestricted account availability or an independent mail monitor. Use the webapp title scale and1.618:1form/limits layout, with stepped token surfaces, concentric panels, a22rem email field and10rem PIN/postal fields. The signed-in view separates historical Orders from editable profile details, uses tabular totals and a quiet high-contrast Sign out control; changing the profile never edits a paid shipping snapshot. Permit surrounding-space paste before strict six-digit trim validation, associate rejected codes with the status message and clear only that correction on editing. Keep playground styling separate through the merchant data marker. The generic starter’s fixed-chalk cards/status resolve a local Light color scheme; our adaptive merchant cards/status explicitly inherit the page scheme instead. Preserve both contracts when syncing upstream, and run `playwright.backroadbum.config.ts` for synthetic signed-out/error/populated-order/profile/save/sign-out text-contrast checks without real account writes. Keep codes, addresses other than the designated public test mailbox, provider bodies and session capabilities out of reporting.

## Checkout profile defaults
Checkout remains a guest-editable draft, not a view authorized by the currently signed-in account. Apply a delayed profile default only while the capability that requested it is still current after JSON decoding; a new sign-in, sign-out, expiry or unreadable storage must discard that response. Preserve already entered values and focus, including earlier defaults the shopper may have accepted, and never automatically replace the draft with another account’s profile. This guards late optional prefill only; it does not clear an existing checkout when Account changes or alter payment/receipt authority.

## Shared shopper identity
Keep Account’s displayed identity and action authority together. A session changed or ended in another tab clears old orders, profile fields and email from the retained DOM, then uses the existing status presentation for sign-in or reload guidance; do not silently transfer an unsaved address to the new shopper. Recheck before Save, Clear and Sign out and after asynchronous responses, not only on storage events. Preserve a newer stored capability, ordinary same-session drafts and transient-error recovery. This changes client continuity only, not Commerce authentication, receipt authority, theme tokens or the already-qualified real-email journey.

## Downstream adoption
The November15 merge of starter6340dcb keeps the merchant’s PIN hint and conservative no-selected-member metadata fallback. Scope the starter’s14rem PIN rule away from `[data-merchant-account]`; the merchant’s10rem field and adaptive color scheme remain authoritative here. Merged source and local browser checks never imply a signed-plugin or hosted-service upgrade.

## Generic shell qualification
The retained starter CSS now gives its search, appearance and chevron controls a44px floor, restores input focus and deepens only small-label accent fills. Backroad Bum uses its own48px header/footer controls; generic Before/After captures in Template232 are upstream-starter proof, not a merchant rebrand or a new checkout qualification. Preserve that distinction in reporting and later downstream syncs.

## Search eligibility reporting
A published CMS product page and a shoppable Commerce product are different states. Report the isolated native price-clear/reprice qualification as a copy-store eligibility check, not live merchant action or a changed public catalog; the signed plugin remains authoritative. The downstream test-fixture merge changes no screen design, and the full merchant typecheck is not a substitute for the generic starter’s unrun header browser matrix.

## Catalog discovery reporting
A healthy empty agent feed is not a populated catalog success or a broken storefront. Keep the actual Google/Meta channel-eligibility consequence distinct from the store-level catalog switch and from synthetic populated Worker tests; link the existing upstream follow-up rather than declaring a new regression. A downstream sync preserves this entire theme and the legacy browser capability keys; it does not authorize external channel enrollment, a server-cart cutover or shared-service deployment.

## Populated feed reporting
Keep the existing Field Journal reporting tokens, disclosure rhythm and plain native links. Separate the actual seven-family/eleven-member JSON export and real HTTPS Worker proof from the five-row Google/Meta limitation, missing native option-product switches and fenced API workaround; never turn partial export or a bug report into a readiness/repair claim. Installed-panel captures crop to the native Commerce section and stay outside git; public proof compares product shapes in the same signed release, not fabricated Before/After repair states.

## Exact catalog lookup reporting
An empty product returned for a filtered exact size is not a useful availability answer. Report the compiled Worker’s exact-input correction separately from storefront availability, channel eligibility and shared deployment: public tee facts can supply a local synthetic feed without authorizing remote catalog enrollment. API-only Before/After HTTP output belongs directly in the PR body; do not fabricate screenshots or imply that the live empty feed exports those variants.

## Merchant workflow reporting
Keep installed interaction proof separate from a repair comparison: the product-restore captures show the same signed plugin before and after an explicit native unpublish→publish workaround, not a new implementation. Dashboard reporting must say the experiment used a disposable copy and that Restore→Draft remains the accepted contract. Redact contact text, retain the original EmDash/Block Kit visual system and link the owning workflow report; do not imply that a live CMS summary alone proves Commerce sellability or that historical order records are visitor metrics.

## Completed Account reporting
Report signed own-orders completion separately from guest receipt visibility. Existing TEST1010's native/hosted tracking and real-email Account read match after one sandbox label; keep the $17 frozen payment, illustrative3oz package input and free label distinct. Account's existing wrapping identifier/status controls need no new visual idiom, and public reporting must never embed the live session, contact details, tracking reference or label PDF; use fixed qualification flags and the existing dashboard disclosure.

## Hosted order reporting
A dated TEST order is curated self-dogfood evidence, never visitor volume or customer-sales telemetry. Field Book checkout reports frozen merchandise/shipping totals separately from sandbox postage and illustrative package weights; canonical completion and hosted tracking are not inserted into an unqualified guest receipt. Keep operator guards, Session URLs, contacts and label PDFs private; reporting uses existing dashboard disclosures and adds no public order lookup.

## Recovery reporting
Keep automatic latest-archive media checks separate from the dated opt-in runtime rehearsal. The current dispatch reports a restored catalog served inside a private network namespace, not provider readiness or a self-contained off-host backup. Use the existing disclosure and status-row primitives; never expose private archive paths, decrypted settings, raw runtime logs or session material.

## Catalog link semantics
Whole-card shopping links take their accessible name from the visible Commerce product heading and their description from the visible current price/availability group. Keep the authored illustration alt text intact; do not hide images or buying facts to shorten a link name. Scope heading/facts IDs to each rendered card rather than the product identity, so separate shelves cannot share an association. The whole card stays one native keyboard link with the existing focus treatment; unlinked cards retain their own Add controls.

## Notebook design
County Line Field Book adds an original vector illustration in the existing 4:3 media stage: kraft/mineral neutrals, a rust spine and a winding-road cover, not a product photograph. Native EmDash specification rows lead; the secondary care disclosure starts closed and remains keyboard-operable without scripting. Authored design dimensions are explicitly illustrative, and the source checklist is not runtime product or price data. Road day keeps the in-stock notebook ahead of the backordered tote through published native reference order.

## Native fit guidance
Cap specifications precede its native Fit & care disclosure, using the existing two-column detail grid and phone stack. Adjustment instructions distinguish an adult-fit label from a measured range, and the care copy makes no tested UPF claim; its source checklist is verification input, never runtime content or commerce authority.

Tee and fleece size tables are native EmDash specification blocks, with measuring instructions nearby and illustrative dimensions explicitly distinguished from manufactured samples. Signed Commerce alone supplies selected-size price and availability; the buyable XL fleece backorder must not imply a dispatch date. Browser-only cart proof refuses legacy preparation attempts and must not be described as checkout qualification.

## Product option feedback
A variant product's existing stock paragraph is a server-rendered atomic `status` region (implicit polite announcements), present before the first radio change. Update its text in place, retain native radio focus and keep the visible price/status/button behavior unchanged; simple products do not need this dynamic status role. Chromium accessibility-tree properties are proof of supplied semantics, not proof of speech on a physical assistive-technology setup.

## Product Add continuity
The local product Add mutation is synchronous: do not transiently disable its button or programmatically move focus on success. Retain the native button focus cue through success, combined-line refusal and storage failure; only malformed quantity correction focuses the input. The onward View cart link remains success-only and next in keyboard order. A future asynchronous server-cart implementation needs its own honest pending state and focus qualification, not an assumption that this local strategy transfers unchanged.

## Cart product-link continuity
Cart and checkout keep each native product link attached while its name, destination and neighboring Commerce facts refresh. A tab return, quantity edit or catalog read must not replace an unchanged navigation target and drop keyboard focus to the document body; the next Tab still reaches Quantity. Changed prices and invalid drafts remain visible under the existing rules, with no focus restoration to a link that has legitimately disappeared and no new checkout authority.

## Product-detail retry focus
Keep the existing quiet Try again button in the keyboard order while snapshot refresh is pending, with `aria-disabled`, `aria-busy` and muted token ink; the existing request guard refuses repeat activation. Keep the owned target visible with immediate nearest scrolling, never an animated jump. A repeated refusal retains the same button; success moves to the first recovered product link (or retained quantity when no product link exists) only if the retry still owns focus at completion. Never return focus or scroll after the shopper moves elsewhere, and do not erase an invalid quantity draft or change the saved size/quantity. This is the current browser-cart presentation, not a policy to transplant into the native server-cart preparation.

## Saved-checkout status focus
The asynchronous explicit status check keeps its native button focusable, with `aria-disabled` and `aria-busy` while the controller refuses reentry. A pending result preserves button focus for another keyboard check; a terminal result focuses the described status only if the disappearing button still owns focus. Automatic reads and shoppers who moved away never receive a forced focus change. The existing five-read limit keeps its explanation and a focusable unavailable control; it is not a new provider retry policy or server-receipt implementation.

## Product quantity feedback
A rejected explicit Add associates its existing alert with Quantity via a stable ID and `aria-describedby`, marks `aria-invalid` and focuses the retained input. The stepper outline and alert use the established danger token, not a new palette; editing or stepping clears only the quantity correction without moving focus. Storage refusals and combined-cart-line limits remain separate, and success-only View cart never appears for a failed save.

## Native merchant diagnostic evidence
The public EmDash ledger links two synthetic phone captures showing a successful weight save dismissing the Settings sheet. They are before/after an interaction, not before/after a repair; the original EmDash/Kumo visual system is retained. Inspect `aria-hidden`, inertness and viewport geometry when testing a translated drawer: a CSS-visible offscreen element is not a usable open control.

## Protected runtime and completed phases
Visual authorization is broad; business authority is not. Preserve signed Commerce0.8.0 / Payments0.5.0 / Ship0.3.1, hosted consents, test-only admission, authoritative prices/availability, distinct selected members, guest cart storage, pending checkout protection, retained receipt recovery/printing, every Order, native mug media/specs and all published field notes. No CMS publication, replacement payment, shipment resync, credential exposure or /proof runtime change is part of the rebrand.

1. **Phase 1 — live:** baseline captures, tokens/fonts, appearance, shell and home.
2. **Phase 2 — live:** shop/collection/PDP/search hierarchy, native gallery/spec/care and variant controls; Regular/Sale comparison only when the signed projection actually supplies both.
3. **Phase 3 — live:** cart/checkout/receipt, guides and magazine-grade editorial; proportional forms, field-level correction and print-safe receipts.
4. **Phase 4 — live:** dashboard metric cards, native evidence disclosures and responsive contribution tables on the1.125scale; full history, source ledger, archived instructions and six-surface Before/After showcase preserved. Telemetry is a validated server-side projection: invalid/missing data uses the existing Unavailable presentation and future timestamps are stale, without new controls or visual tokens.

Before each rollout, run the supplied DOM auditor at390/1440 in Light/Dark against the built site, inspect captures, repair overflow/painted contrast/control geometry and preserve reusable focused tests. The legacy Impeccable detector flags Fraunces as overused; it is retained deliberately for the new skill’s editorial pairing, judged in the rendered home rather than treated as an automatic font ban. Keep media outside git at `/var/www/backroadbum-pr-proof/storefront-redesign/`; temporary audit files are removed after retaining concise evidence. Upstream DinkusKit PRs remain Path A: their own visual system, never this merchant rebrand.
