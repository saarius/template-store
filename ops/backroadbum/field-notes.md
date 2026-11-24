# Native Field Notes

Thirteen notes are published as EmDash Pages. `field-note-*` slugs, published native titles and opening paragraphs drive the journal, search previews and onward reading; files under `seed/` record authorship, not runtime content.

## Passenger note · November 24
`seed/backroadbum-passenger-note.json` records the four chapters, three check-in prompts and two links to older notes. The exact draft was private before the native publication; the public article has no product association. Run `node scripts/verify-backroadbum-authored-note.mjs --check --source=backroadbum-passenger-note.json` for script-on/off journal, search, native blocks and print checks. The protected `passenger-note.json` authoring guard is complete; do not replay. Evidence: `evidence/2026-11-24-passenger-note/`.

## Small things · November 24
`seed/backroadbum-small-things-note.json` records four chapters, a three-step table sweep and two links. Native draft and published reloads match all 14 blocks, including the closing paragraph. The bandana and both collections link back; the earlier cap and mug notes remain on their product pages and in the journal. Run `node scripts/verify-backroadbum-authored-note.mjs --check --source=backroadbum-small-things-note.json` to verify public reading, search and print. The protected `small-things-note.json` authoring guard is complete; do not replay. Workspace evidence: `evidence/2026-11-24-small-things/`.

## Warm cup · November 23
`seed/backroadbum-warm-cup-note.json` records four chapters, a three-step pack-out list and two used links. The published note gives the Creekside Camp Mug its first reading match; Slow camp’s two-note shelf now shows the fleece and mug notes, while the reset remains in the journal and linked from the tote.

Run `node scripts/verify-backroadbum-authored-note.mjs --check --source=backroadbum-warm-cup-note.json` for the read-only manuscript, search, print and linked reading checks. The protected warm-cup authoring and paragraph-correction guards are complete; never replay either. Check the complete block sequence, including empty blocks, before publishing another article; filtering empty blocks can hide an accidental spacing paragraph. Evidence: `evidence/2026-11-23-field-note-discovery/`.

## Chapter navigation · November17
The merchant presentation derives sections from real non-list native h2 blocks. Two or more chapters expose a closed native disclosure; heading fragments are focusable with scripts off and hidden from print. Titles remain plain text in navigation while EmDash retains marks/alignment in the article; duplicate titles get distinct position-based targets. This is request-local projection, not a CMS save, topic taxonomy or permanent-link promise after reordering. Non-note/policy/layout pages retain their own renderer.

`node scripts/verify-backroadbum-note-sections.mjs` checks every published article and eight phone/desktop Light/Dark script-on/off contexts, blocking HTTP writes. `--baseline` records prior native article facts; `BACKROADBUM_VERIFY_BASELINE=<result.json>` requires exact subsequent prose/list/link/heading equality, and `BACKROADBUM_VERIFY_ORIGIN` / `BACKROADBUM_VERIFY_OUT` select an isolated preview and ignored evidence directory. Browser checks cover actual heading focus, native Back/reload, print omission and policy/missing-page exclusion. Evidence: `evidence/2026-11-17-journal-sections/`; no account, payment or authoring replay is involved.

## Shade note · November17
`seed/backroadbum-shade-note.json` records16native blocks, four chapters, three list items and two links. Native draft save/reload, anonymous draft exclusion and one confirmed publication pass; completed0600 guard `/etc/backroadbum/operator/shade-note.json` must not be replayed. The cap gains its first reading shelf; Road day now shows notebook/shade under the existing two-note stable ordering, while the reset note stays in the journal and tote shelf. Evidence:`evidence/2026-11-17-cap-care/`.

`node scripts/verify-backroadbum-authored-note.mjs --check --source=backroadbum-shade-note.json` verifies the exact published manuscript, links, search, onward reading and print in eight script-on/off390/1440 Light/Dark contexts with all HTTP writes blocked. Updated product-reading checks retain all seven products’ prior buying facts/structured data and now cover four note round trips; collection-reading checks retain Slow camp and unlisted-route exclusion. The prior thirteen Pages, catalog and ten Orders remain unchanged.

## Product reading · November16
Product pages now reuse the collection shelf’s exact used native-link relationships. The current notebook, tote and fleece each have one matching published note; the other four products render no shelf. Optional reading is omitted in preview/edit mode or on a failed Pages read, and never supplies buying facts or changes the product’s canonical metadata.

`node scripts/verify-backroadbum-product-reading.mjs --check` blocks all HTTP writes and checks seven products, three keyboard note→product round trips, the journal link, missing-product exclusion, unchanged collection reading and browser intent across eight script-on/off phone/desktop Light/Dark contexts. `BACKROADBUM_VERIFY_BASELINE` compares buying copy and structured data with a prior read; `BACKROADBUM_VERIFY_ALLOW_ORIGIN_CHANGE=1` permits only explicit schema-URL origin translation for a local HTTP fixture, never a blanket metadata bypass. Evidence: `evidence/2026-11-16-shopper-discovery/`; this is optional merchant discovery, not a CMS or plugin release.

## Layer note · November17
`seed/backroadbum-layer-note.json` records16native blocks, four headings, three numbered packing steps and two links. EmDash draft/reload/publication and anonymous draft exclusion were verified; `/etc/backroadbum/operator/layer-note.json` retains the completed operation and must not be replayed. The note is reachable from journal/search, the fleece and Slow camp; its content distinguishes a comfort design from technical weather protection. Evidence: `evidence/2026-11-17-reachable-layer/`.

`node scripts/verify-backroadbum-authored-note.mjs --check` compares the published manuscript, native headings/list/links, metadata, onward reading, search, print visibility and optional gear/collection keyboard round trips in eight script-on/off Light/Dark390/1440contexts. `--source=backroadbum-layer-note.json` selects a seed checklist, not runtime content; all browser writes are blocked. Updated product/collection checks pass the same eight contexts, including the new fleece relationship; the collection checker no longer assumes the older seven-note index.

## Bounded authoring
- Take a current backup and `node scripts/inspect-backroadbum-business.mjs --check` before editing. For a new note, record a unique operation guard in `/etc/backroadbum/operator/` with mode0600; refuse an existing guard/slug rather than recreating an uncertain save.
- Use the native Pages editor for Title/slug, headings, ordered lists and inline links. Save one draft, reload, and compare all stored blocks, styles, list items and applied links with the manuscript. The editor may add an empty caret paragraph after a final list; distinguish this editor-only affordance from an empty saved block. Never assign the editor DOM or write CMS tables directly.
- Confirm the draft route is404 and absent from the public journal and matching search. This store's Pages editor currently exposes no Preview button; its admin `supportsPreview` flag follows collection support. A scriptless manuscript-in-shell audit can inspect provisional content geometry, but a local file can use fallback fonts and is not actual CMS preview or final typography proof.
- Publish once through the native confirmation, then reload the saved page and inspect published/no-draft state. On uncertainty, read back before considering another mutation. Keep the guard's completed phase; never replay a historical authoring driver.
- Audit the real article at390/1440 in Light/Dark, inspect captures, and check script-off links, published index/search, onward reading and print media. Keep screenshots/PDFs and one-off operation drivers outside git.

## Departure note · November16
`seed/backroadbum-departure-note.json` records17blocks: four headings, four numbered items and two reading links. Private completed guard: `/etc/backroadbum/operator/departure-note.json`; evidence: `evidence/2026-11-16-departure-note/`. All eleven earlier page rows, catalog and ten Orders are unchanged; no shopper operation is part of publication.

`node scripts/verify-backroadbum-departure-note.mjs` is a reusable, read-only public check: eight script-on/off phone/desktop Light/Dark journeys compare native prose/list/link structure, search/keyboard discovery, onward reading and print-media visibility, refusing browser writes. Reports/captures go to ignored `runs/backroadbum/departure-note/`. It does not sign in, publish, print a physical page or exercise commerce; exact manuscript differences require editorial review rather than an automatic overwrite.
