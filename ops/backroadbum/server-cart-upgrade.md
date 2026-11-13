# Qualifying a future server-cart upgrade

The serving store still uses signed Commerce 0.8.0 and its existing browser-bound recovery. Template #229 and Commerce #272 are a breaking, paired candidate, not an installed release. Do not adopt either alone or discard the original pending browsers.

## Disposable compatibility check

Build exact Commerce v0.8.0 and the chosen server-cart commit in separate clean source checkouts on Node24, with their own dependencies. From this template checkout:

```sh
node scripts/qualify-backroadbum-server-cart.mjs --check \
  --old=/path/to/built-commerce-v080 \
  --candidate=/path/to/built-commerce-server-cart
```

Without arguments it does nothing. The command accepts no database, credentials or capability input. It creates a temporary migrated SQLite database and two synthetic purchases using the **actual 0.8.0 kernel**, not hand-written old-shaped attempts: one paid and one unresolved past its provider window. Current fixture pricing then changes from $16 to $14.

The candidate's compiled Registry runs through actual EmDash1.4.0/workerd. Without installed Payments bindings, it reads the original capabilities and preserves frozen item/total/receipt facts at $32, denies forged/foreign requests and refuses frozen-cart changes without rewriting those carts or Orders. The second phase uses the candidate **kernel with synthetic Payments**, replays the same attempt and reconciles it paid without another provider session. An idempotent ensure-session call is counted separately from creation. Runtime output is discarded and the temporary database/process is removed in `finally`.

November13 result: old35f80f2 → candidate986a382 passes. The old Registry `status` address returns401, not a status projection; the new `cart` read is the supported address. The elapsed-window old status call reported recoverable failure with Payments unavailable, while the unconfigured installed cart read reports pending: this is **not exact whole-response equivalence**, release or provider proof. Frozen facts match, no paid claim/redirect is invented, and payment resolution is demonstrated only by the synthetic kernel phase. Evidence: workspace `evidence/2026-11-13-cart-qualification-installed.json`.

## Before merchant adoption

- Obtain the coordinated signed Commerce beta and matching template pin. Independently qualify real forms, cookie security and actual hosted TEST checkout in isolation; this command does not qualify Template #229 or signed installation.
- Adapt the merchant's same-origin recovery wrapper to the new cart-read protocol before changing Commerce. Preserve original browser capabilities and unresolved attempts; the upstream owner's no-fallback template policy is not permission to lose this store's evidence. Do not resend old inline lines to the new start route.
- Qualify a paid receipt and unresolved original-capability read through that wrapper, without replacement starts. Plan fresh-cart handling separately; unresolved payment still freezes edits.
- Keep a matching private database/configuration recovery snapshot and explicit rollback conditions. This is not full admin/catalog upgrade, scheduled cleanup, account delivery, hosted Payments, carrier, or off-host recovery proof.

The repository's broader `test:registry-upgrade` run on this host stopped in the **old** admin phase with a V8 heap exhaustion before catalog creation. It did not reproduce the author's later catalog-create failure, enter the new phase, or prove an EmDash product bug. The narrower check deliberately avoids that admin fixture rather than calling the broad gate passed.
