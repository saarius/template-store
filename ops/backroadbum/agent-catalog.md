# Agent catalog dogfooding

The merchant branch merged upstream template-store `23207d9` one way on November 14. `/feeds/agent-catalog.json` now serves the upstream route with the existing signed Commerce0.8.0 projection; no plugin, marketing-channel setting or hosted service was replaced. Run `node scripts/verify-backroadbum-agent-catalog.mjs` for a read-only public comparison.

## Current result and boundary
- Seven published families / eleven concrete members remain shoppable, but every `feedChannels` list is empty. The agent builder requires an approved Google/Meta channel, so the JSON feed correctly returns `products: []`, canonical HTTPS origin/policy links, JSON MIME and `no-store`.
- This is the explicit **Open point** in [Template227](https://github.com/dinkuskit/template-store/pull/227), not a newly discovered regression. [Live evidence](https://github.com/dinkuskit/template-store/pull/227#issuecomment-6881635674) supplies the merchant consequence. Do not enable Google/Meta or bypass eligibility merely to fill an agent index; revisit after the owning follow-up decision.
- The current signed catalog supplies the effective customer amount, not a Regular/Sale comparison. Bandana is USD1400; do not copy the Regular1600 amount from seed into a feed. Sizes preserve their own amounts and availability; tee XL is sold out, fleece XL and the tote are backordered.
- A valid empty route does not qualify populated canonical product links, feed variant output or draft exclusion through that route. The native catalog switch is not present in signed0.8.0; its default-on consumer behavior is not a native toggle test.

## Local Worker, not a shared deployment
`saarius/dinkuskit:backroadbum/catalog-dogfood` includes upstream `662dd47` (#126/#127) plus the fork’s existing history. The catalog was bundled with `wrangler deploy --dry-run` and exercised in local Miniflare/workerd, disposable D1 and fabricated merchant admission. It fetched the actual public HTTPS feed successfully and indexed no products, as expected. Backroad Bum was not admitted to any remote public catalog; the catalog’s test-store exclusion policy remains intact.

Separate synthetic feed data assembled from public Commerce facts exercised seven families, eleven members, Size selection, effective prices, sold-out filtering/backorders, delivery and price filters, wrong-origin rejection,503 last-good retention,601-second expiration, recovery and empty-feed removal. It does not establish that the shipping route exports these products. Workers AI/Vectorize/category inference and hosted catalog operation remain unqualified.

Private workspace evidence: `evidence/2026-11-14-agent-catalog/worker-real-feed.json`, `feed-live.json`, `feed-verification.json` and `deploy-preservation.json`. Original desktop/phone browser intents and prepared legacy capability bytes survive the downstream deployment. No checkout start, payment, order, label or content write was made; Orders/catalog/CMS/numbering hashes remain unchanged. Use the ordinary deployment runbook; do not replay the one-off deployment driver.

## Next qualification
After an accepted eligibility decision or deliberately authorized native-channel change, rerun the public verifier and local Worker against the **actual populated feed**. Check every canonical product URL, all members, effective amounts, availability and unpublished exclusion before claiming cross-store discovery. A locally fabricated admission row is never proof of hosted approval or live AI-app distribution.
