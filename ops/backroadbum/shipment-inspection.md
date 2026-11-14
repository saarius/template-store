# Inspect an existing TEST shipment

From the primary `template-store` checkout on Node24:

```sh
node scripts/inspect-backroadbum-shipment.mjs --check --order=1008 --hosted --pdf
```

Without `--check`, nothing runs. The order must already exist in the store’s read-only SQLite view and be TEST. This opens native Ship, not Commerce Orders; it does not trigger an Orders-admin reconciliation. `--hosted` also opens the corresponding signed-in owner page and refreshes the private hosted storage state in `finally`. `--pdf` reads the existing label PDF and reports only its size/hash, never its URL or contents.

Request admission allows native page-load/open interactions and merchant authentication, but rejects quote, purchase, cancel, connect, checkout and hosted write requests. No new label, order, payment, manual completion, settings save or browser receipt capability is created. Output excludes addresses, tracking references, private responses and authentication state; unavailable inspection fails without a purchase retry.

## Compare the guest receipt with the same canonical order

```sh
node scripts/inspect-backroadbum-receipt.mjs --check --fulfillment --state-file=/etc/backroadbum/operator/variant-packing-browser.json
```

`--fulfillment` implies a native signed status read. It uses the paid response's order ID internally to find exactly one canonical TEST record in a read-only SQLite connection; a missing/foreign/duplicate/non-test match stops without publishing identifiers. Output contains only fixed status/presence flags and receipt visibility. It restores only the original guest capability (no staff/customer cookies), refuses non-status writes and verifies both retained capability and private input-file bytes stay unchanged. Without `--check`, it does nothing.

On November14, the same existing1008 is Completed with carrier/tracking in Orders, native Ship and hosted Ship; the signed guest projection has no fulfillment/completion/status field and the receipt hides that section. [Commerce issue275](https://github.com/dinkuskit/commerce/issues/275) records the guest-read capability request, not an accepted contract, regression fix or implementation. Commerce main3f1ff30 and server-cart candidate272a966e82 both project frozen Checkout facts; later fulfillment belongs to Orders, and no merchant lookup/unsigned plugin/forced resync is introduced. The print-only receipt header already preserves demo context; no order-level TEST field is fabricated.

For order1008, the original fictional destination was definitively refused by the sandbox provider. Commerce’s native correction synchronized before one corrected label purchase; the frozen paid snapshot stayed unchanged. The16.5oz package input is a demo packing choice, not a measured product weight. The normal background task recorded completion, and re-reading the existing PDF matched the original hash. Preserve `/etc/backroadbum/operator/pack1008-fulfillment.json`; inspection is not permission to rebuy or cancel that label.
