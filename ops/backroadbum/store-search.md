# Store search

The merchant `/search` route retains native EmDash published results and their order within each group. If no visible result remains, or a query contains a size term, exact matches come from the signed public Commerce projection and published CMS/Commerce links. An indexed product keeps its title, snippet and position; an unindexed exact family can join the Gear group without hiding a Field Note or bypassing the 20-result limit. All query words must belong to one member's product title/options, including a complete option value; no sibling combinations, fuzzy aliases or SKU lookup are inferred. A family appears once with its matching members and actual availability. If exactly one option matches, the product name and option form one link to the selected member; the availability describes that link. If several members match, the family and separate member choices remain available. No indexed or seed prices are used.

If matching indexed gear cannot be verified, the native search page omits those products and skips the option lookup against the same unavailable projection. Independently matched published notes and collections remain, with an inline gear notice and HTTP 200. If none remain, return the existing unavailable page with HTTP 503, not an empty result. Test this only against a disposable, network-isolated copy with Commerce disabled. The public suggestion API and healthy searches do not change.

The request shares one fresh catalog snapshot between native product filtering and exact options. Failure during the empty-result fallback returns 503, not a false zero result. A usable native result remains when optional discovery fails; ordinary editorial-only queries don't need Commerce. Recognizing that a query might contain a size only decides whether to check; it does not infer size availability, fuzzy aliases, or a new catalog authority. The public response remains no-store/noindex. One-character queries still ask for more detail (use `size L`, not just `L`).

## Read-only verification · Node24 / primary template-store

```sh
node scripts/verify-backroadbum-search-options.mjs --check
pnpm exec playwright test -c playwright.backroadbum.config.ts backroadbum-search-continuity.spec.ts
# In the loopback-only disposable fixture with Commerce disabled:
BACKROADBUM_ORIGIN=http://127.0.0.1:4390 BACKROADBUM_SEARCH_CATALOG_UNAVAILABLE=1 \
  pnpm exec playwright test -c playwright.backroadbum.config.ts backroadbum-search-continuity.spec.ts
pnpm exec vitest run tests/unit/store-search.test.ts tests/unit/store-search-availability.test.ts tests/unit/variant-search.test.ts --maxWorkers=1
```

The browser checker blocks all writes and qualifies current published tee/fleece member selection, native GET form, keyboard links, reload, out-of-stock/backorder distinctions and retained mug/editorial discovery at390/1440 in Light/Dark with scripts on/off. It neither adds cart intent nor exercises payment, email, authentication or a physical screen reader. Use `BACKROADBUM_VERIFY_BASE`/`BACKROADBUM_VERIFY_OUTPUT` for disposable staging/evidence; default execution without `--check` does nothing.

The November 23 follow-up (`evidence/2026-11-23-search-exact-link/` in the operator workspace) observed that the old title link returned shoppers to M for both `tee XL` and `fleece XL`, despite the nearby XL link. Use `/pr-proof/search-exact-link/` for that comparison. `evidence/2026-11-23-search-index-size/` shows the separate nonempty-index case: `fleece L` opened M and `fleece M` showed only a Field Note. The current `/pr-proof/search-index-size/` captures show that both results can coexist. Original fallback evidence is in `evidence/2026-11-16-search-dogfood/`, with captures at `/pr-proof/search-options/`. This is merchant UX, not a confirmed EmDash defect or a proposed upstream search contract. Preserve it when bringing the server-cart preparation branch forward; do not transplant old cart forms with this independent search change.

Off-live `23cb3c6` with the compiled Commerce beta.6 sandbox verifies the search-to-cart handoff. The fixture copied only published native index, CMS and catalog rows from a backup. Ordinary desktop forms and enhanced phone submits in both themes keep the native note, carry precise sizes to the PDP and save separate L×2, M×1 and backordered XL×1 lines at $272 after reload. Tee XL renders with a disabled Sold out button. This proves cart admission and persistence, not a signed same-ID upgrade or payment. See `evidence/2026-11-23-beta6-search-cart/` in the operator workspace.
