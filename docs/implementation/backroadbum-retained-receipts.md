# Backroad Bum retained receipts

These merchant-only checks use the shopper’s retained Commerce capability, not
operator dispatch, authentication cookies or a ready-new-checkout requirement.
Keep the private input state outside git; neither command writes it back.

```sh
node scripts/inspect-backroadbum-receipt.mjs --check --native
node scripts/verify-backroadbum-receipt-print.mjs --check
# Optional private PDFs/screenshots under ignored runs/backroadbum/receipt-print-signed:
node scripts/verify-backroadbum-receipt-print.mjs --check --capture
```

Both accept `--state-file=PATH`; the default is the private retained public
shopper state. The shared helper restores only that origin’s receipt-retention
key, drops cookies/other storage and blocks external requests and unrelated
writes. Only exact status POSTs are allowed; native diagnostics require opt-in.
Print verification reads the signed status projection in the browser, compares
its heading/items/paid total to the screen and Letter/A4 PDF, and checks
keyboard/repeated printing, no print-triggered status reads, unchanged browser
storage/input file, capability exclusion and empty-browser refusal. The 35-row
pagination check is a browser-only layout fixture, not additional orders.

Signed Commerce 0.8.0 omits the older local number/TEST/fulfillment extras.
Do not infer them from another order or a URL. A full canonical order ID may
contain the attempt UUID; it is public receipt text, not an access capability.
The print verifier requires `pdftotext`; optional progress diagnostics use only
bounded stage names (`BACKROADBUM_VERIFY_PROGRESS=1`), never receipt contents.
These read-only checks do not prove fresh hosted payment, mail delivery or new
fulfillment. Reopening a label in native/hosted Ship should print its existing
PDF, never buy another label as a recovery step.
