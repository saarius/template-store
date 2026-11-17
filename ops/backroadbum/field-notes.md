# Native Field Notes

Nine notes are published as EmDash Pages. `field-note-*` slugs, published native titles and opening paragraphs drive the journal, search previews and onward reading; files under `seed/` record authorship, not runtime content.

## Product reading · November16
Product pages now reuse the collection shelf’s exact used native-link relationships. The current notebook, tote and fleece each have one matching published note; the other four products render no shelf. Optional reading is omitted in preview/edit mode or on a failed Pages read, and never supplies buying facts or changes the product’s canonical metadata.

`node scripts/verify-backroadbum-product-reading.mjs --check` blocks all HTTP writes and checks seven products, three keyboard note→product round trips, the journal link, missing-product exclusion, unchanged collection reading and browser intent across eight script-on/off phone/desktop Light/Dark contexts. `BACKROADBUM_VERIFY_BASELINE` compares buying copy and structured data with a prior read; `BACKROADBUM_VERIFY_ALLOW_ORIGIN_CHANGE=1` permits only explicit schema-URL origin translation for a local HTTP fixture, never a blanket metadata bypass. Evidence: `evidence/2026-11-16-shopper-discovery/`; this is optional merchant discovery, not a CMS or plugin release.

## Layer note · November17
`seed/backroadbum-layer-note.json` records16native blocks, four headings, three numbered packing steps and two links. EmDash draft/reload/publication and anonymous draft exclusion were verified; `/etc/backroadbum/operator/layer-note.json` retains the completed operation and must not be replayed. The note is reachable from journal/search, the fleece and Slow camp; its content distinguishes a comfort design from technical weather protection. Evidence: `evidence/2026-11-17-reachable-layer/`.

`node scripts/verify-backroadbum-authored-note.mjs --check` compares the published manuscript, native headings/list/links, metadata, onward reading, search, print visibility and optional gear/collection keyboard round trips in eight script-on/off Light/Dark390/1440contexts. `--source=backroadbum-layer-note.json` selects a seed checklist, not runtime content; all browser writes are blocked. Updated product/collection checks pass the same eight contexts, including the new fleece relationship; the collection checker no longer assumes the older seven-note index.

## Bounded authoring
- Take a current backup and `node scripts/inspect-backroadbum-business.mjs --check` before editing. For a new note, record a unique operation guard in `/etc/backroadbum/operator/` with mode0600; refuse an existing guard/slug rather than recreating an uncertain save.
- Use the native Pages editor for Title/slug, headings, ordered lists and inline links. Save one draft, reload, and compare all native blocks, styles, list items and link destinations with the manuscript. Never assign the editor DOM or write CMS tables directly.
- Confirm the draft route is404 and absent from the public journal and matching search. This store's Pages editor currently exposes no Preview button; its admin `supportsPreview` flag follows collection support. A scriptless manuscript-in-shell audit can inspect provisional content geometry, but a local file can use fallback fonts and is not actual CMS preview or final typography proof.
- Publish once through the native confirmation, then reload the saved page and inspect published/no-draft state. On uncertainty, read back before considering another mutation. Keep the guard's completed phase; never replay a historical authoring driver.
- Audit the real article at390/1440 in Light/Dark, inspect captures, and check script-off links, published index/search, onward reading and print media. Keep screenshots/PDFs and one-off operation drivers outside git.

## Departure note · November16
`seed/backroadbum-departure-note.json` records17blocks: four headings, four numbered items and two reading links. Private completed guard: `/etc/backroadbum/operator/departure-note.json`; evidence: `evidence/2026-11-16-departure-note/`. All eleven earlier page rows, catalog and ten Orders are unchanged; no shopper operation is part of publication.

`node scripts/verify-backroadbum-departure-note.mjs` is a reusable, read-only public check: eight script-on/off phone/desktop Light/Dark journeys compare native prose/list/link structure, search/keyboard discovery, onward reading and print-media visibility, refusing browser writes. Reports/captures go to ignored `runs/backroadbum/departure-note/`. It does not sign in, publish, print a physical page or exercise commerce; exact manuscript differences require editorial review rather than an automatic overwrite.
