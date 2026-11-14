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
- All six products continue through the signed Commerce catalog. Cards gain tonal surfaces and quieter body facts; no indexed or seeded price becomes shopping authority.
- A final 1.618:1 reading invitation leads to Field Notes with distinct serif rhythm. No extra carousel, fake testimonials, newsletter collection or duplicated shopping flow.

## Shop, collections, product and search · Phase 2
- Shop and collection containers align to the shell's 80rem / 20px gutters. The introduction separates its lead from a quiet illustrated-design note; 48px collection filters mark the current route with both underline and rust border.
- Catalog cards use flush 4:3 native image stages, 24px body padding and a two/three-column responsive grid (one column on phones). No colored bloom or hover recoloring touches the product art. Names lead, followed by tabular Commerce prices and quiet availability; a whole-card link keeps one destination and no nested shopping control.
- The desktop PDP is **1.618fr : 1fr**, top aligned at 60rem, with a quieter product heading than the home hero. The native no-JavaScript gallery retains the original image order, crops and eager/lazy hints. Native specification rows and care disclosures sit under a distinct Details & care heading; no CMS copy is duplicated in theme data.
- Variant pills have 48px targets, a 2px selected border and an `aria-hidden` checkmark; sold-out choices remain inspectable and visibly struck through. Native radio arrows, focus rings, original no-JavaScript GET fallback, stale-selection notice and exact Commerce member matching remain unchanged. Decorative marks must never become part of a radio's accessible name.
- Search follows the webapp title scale rather than a marketing hero. One rust action submits an ordinary GET form; grouped results retain native destinations, published previews and actual highlights without adding indexed prices. Surface cards separate result groups from form guidance.
- Regular/Sale comparisons render only when the signed projection supplies both. The current signed0.8.0 projection returns the effective amount alone for the bandana, so no struck-through seed or indexed Regular amount is invented. This is a data-contract limitation, not a styling decision.

## Cart, checkout, receipt and reading · Phase 3
- Cart and checkout follow the **1.2 webapp scale**: the title tops out at2.488rem, keeping the order and form rather than the heading as the task's focal point. Tonal 24px panels with24px padding and8px controls replace heavy outlines and mismatched radii. Mobile keeps its existing order-summary-first source order; desktop retains contact left, summary right in a1.618:1split.
- Contact labels sit4px above inputs; the next label is separated by16px plus the grid gap, and address groups use40px. Email/name fields cap at22rem, address lines at32rem, state/region at14rem and postal codes at10rem. The same-as-delivery checkbox has a full labeled48px target, an explicit selected surface, and still controls the existing conditional billing section. Field identities, autocomplete, validation/focus behavior, countries and server admission are unchanged.
- A quiet test-card inset puts4242, future expiry/CVC and the full guide alongside the form. Prices and shipping stay Commerce's; unquoted shipping/tax are not replaced with a theme estimate. Browser fixtures intercept prepare/status and refuse all starts for visual proof; a simulated paid receipt is never evidence of a provider payment.
- Receipt presentation lives in `receipt-screen.css` under **@media screen**. The canonical receipt, TEST badge, totals, delivery and fulfillment retain their native DOM/data; totals align on a quiet right axis and pending amounts stay in a separate panel with no print control. `receipt-print.css` continues to own paper geometry and excludes navigation, controls, thumbnails and capabilities.
- Field Notes opens with an asymmetric copy/photograph split, one featured published note and quieter two-column reading links. Ordinals are decorative/aria-hidden, not invented dates. The existing photograph/credit and native note ordering remain intact.
- Articles use the generated editorial scale: expressive title, serif opening paragraph, DM Sans body at17–18px/1.75 and at most65ch. Chapter gaps are64px, versus24px paragraph spacing. Back/related/shop links work without JavaScript. Guides share this reading rhythm with smaller task headings and clear policy navigation; their native CMS words are not duplicated or edited by the theme.

## Public experiment dashboard · Phase 4
- Operating typography follows the generated **1.125 scale**: a DM Sans title capped at2.027rem, section headings at1.266–1.424rem and1.125rem subheadings. No marketing-size reporting hero. Tabular numerals cover samples, tokens, amounts and identifiers.
- Four sampled metric cards distinguish process state, advisory readiness, memory and explicitly unavailable visitor/order aggregates. A stale probe is called stale; advisory readiness is never payment proof. The sampled timestamp and detailed operations remain accessible through a native disclosure.
- Separate open-review cards show the three checked heads and real store friction. The candidate table gives each branch a concise disposition, with every original evidence/deployment note retained behind a native keyboard-operable details control. On phones each semantic row becomes a stacked card; table captions and header associations remain available.
- The overview keeps one current dispatch; older dispatches and review context remain in labeled disclosures. The dated history is still newest-first, with136 entries and all135 prior article bodies unchanged. No client pagination, search indexing of private logs or reporting-side write action is added.
- A six-surface Before/After showcase links original1440px captures to final-phase Light/Dark desktop and390px phone captures. Media stays outside git. All five archived instruction versions, including Steer4, remain in date order and unchanged.
- Dashboard components add no JavaScript. Navigation, disclosures, instructions and evidence work without scripting; only the existing shared appearance preference needs enhancement.

## Native fit guidance
Tee and fleece size tables are native EmDash specification blocks, with measuring instructions nearby and illustrative dimensions explicitly distinguished from manufactured samples. Signed Commerce alone supplies selected-size price and availability; the buyable XL fleece backorder must not imply a dispatch date. Browser-only cart proof refuses legacy preparation attempts and must not be described as checkout qualification.

## Protected runtime and completed phases
Visual authorization is broad; business authority is not. Preserve signed Commerce0.8.0 / Payments0.5.0 / Ship0.3.1, hosted consents, test-only admission, authoritative prices/availability, distinct selected members, guest cart storage, pending checkout protection, retained receipt recovery/printing, every Order, native mug media/specs and all six field notes. No CMS publication, replacement payment, shipment resync, credential exposure or /proof runtime change is part of the rebrand.

1. **Phase 1 — live:** baseline captures, tokens/fonts, appearance, shell and home.
2. **Phase 2 — live:** shop/collection/PDP/search hierarchy, native gallery/spec/care and variant controls; Regular/Sale comparison only when the signed projection actually supplies both.
3. **Phase 3 — live:** cart/checkout/receipt, guides and magazine-grade editorial; proportional forms, field-level correction and print-safe receipts.
4. **Phase 4 — live:** dashboard metric cards, native evidence disclosures and responsive contribution tables on the1.125scale; full history, source ledger, archived instructions and six-surface Before/After showcase preserved.

Before each rollout, run the supplied DOM auditor at390/1440 in Light/Dark against the built site, inspect captures, repair overflow/painted contrast/control geometry and preserve reusable focused tests. The legacy Impeccable detector flags Fraunces as overused; it is retained deliberately for the new skill’s editorial pairing, judged in the rendered home rather than treated as an automatic font ban. Keep media outside git at `/var/www/backroadbum-pr-proof/storefront-redesign/`; temporary audit files are removed after retaining concise evidence. Upstream DinkusKit PRs remain Path A: their own visual system, never this merchant rebrand.
