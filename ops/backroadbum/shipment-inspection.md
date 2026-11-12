# Inspect an existing TEST shipment

From the primary `template-store` checkout on Node24:

```sh
node scripts/inspect-backroadbum-shipment.mjs --check --order=1008 --hosted --pdf
```

Without `--check`, nothing runs. The order must already exist in the store’s read-only SQLite view and be TEST. This opens native Ship, not Commerce Orders; it does not trigger an Orders-admin reconciliation. `--hosted` also opens the corresponding signed-in owner page and refreshes the private hosted storage state in `finally`. `--pdf` reads the existing label PDF and reports only its size/hash, never its URL or contents.

Request admission allows native page-load/open interactions and merchant authentication, but rejects quote, purchase, cancel, connect, checkout and hosted write requests. No new label, order, payment, manual completion, settings save or browser receipt capability is created. Output excludes addresses, tracking references, private responses and authentication state; unavailable inspection fails without a purchase retry.

For order1008, the original fictional destination was definitively refused by the sandbox provider. Commerce’s native correction synchronized before one corrected label purchase; the frozen paid snapshot stayed unchanged. The16.5oz package input is a demo packing choice, not a measured product weight. The normal background task recorded completion, and re-reading the existing PDF matched the original hash. Preserve `/etc/backroadbum/operator/pack1008-fulfillment.json`; inspection is not permission to rebuy or cancel that label.
