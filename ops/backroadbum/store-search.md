# Store search

The merchant `/search` route keeps native EmDash published content results and ranking first. If no visible result remains, a narrow fallback reads the signed public Commerce projection and the same published CMS/Commerce links used for product visibility. All query words must belong to one member's product title/options, including a complete option value; no sibling combinations, fuzzy aliases or SKU lookup are inferred. A family appears once with its matching member links and actual availability, including sold-out and backordered members. No indexed or seed prices are used.

The request shares one fresh catalog snapshot between native product filtering and fallback discovery. Catalog/CMS failure during needed fallback yields the existing unavailable/503 state, not a false zero result. Normal successful editorial-only queries still do not depend on Commerce; fallback is not a second content index or a replacement for the generic suggestion API. The public response remains no-store/noindex. One-character queries still ask for more detail (use `size L`, not just `L`).

## Read-only verification · Node24 / primary template-store

```sh
node scripts/verify-backroadbum-search-options.mjs --check
pnpm exec vitest run tests/unit/store-search.test.ts tests/unit/store-search-availability.test.ts tests/unit/variant-search.test.ts --maxWorkers=1
```

The browser checker blocks all writes and qualifies current published tee/fleece member selection, native GET form, keyboard links, reload, out-of-stock/backorder distinctions and retained mug/editorial discovery at390/1440 in Light/Dark with scripts on/off. It neither adds cart intent nor exercises payment, email, authentication or a physical screen reader. Use `BACKROADBUM_VERIFY_BASE`/`BACKROADBUM_VERIFY_OUTPUT` for disposable staging/evidence; default execution without `--check` does nothing.

Initial evidence: `evidence/2026-11-16-search-dogfood/`; public Before/After: `/pr-proof/search-options/`. This is merchant UX, not a confirmed EmDash defect or a proposed upstream search contract. Preserve it when bringing the server-cart preparation branch forward; do not transplant old cart forms with this independent search change.
