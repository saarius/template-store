# Qualifying a future server-cart upgrade

The serving store still uses signed Commerce 0.8.0 and its existing browser-bound recovery. Template #229 and Commerce #272 are a breaking, paired candidate, not an installed release. Do not adopt either alone or discard the original pending browsers. A merchant-only recovery adapter is now source-qualified below, but **not enabled**.

## Disposable compatibility check

Build exact Commerce v0.8.0 and the chosen server-cart commit in separate clean source checkouts on Node24, with their own dependencies. From this template checkout:

```sh
node scripts/qualify-backroadbum-server-cart.mjs --check \
  --old=/path/to/built-commerce-v080 \
  --candidate=/path/to/built-commerce-server-cart
```

Without arguments it does nothing. The command accepts no database, credentials or capability input. It creates a temporary migrated SQLite database and two synthetic purchases using the **actual 0.8.0 kernel**, not hand-written old-shaped attempts: one paid and one unresolved past its provider window. Current fixture pricing then changes from $16 to $14.

The candidate's compiled Registry runs through actual EmDash1.4.0/workerd in a disposable site using the merchant's real `/api/checkout/status` route. Without installed Payments bindings, it reads original capabilities and preserves frozen item/total/receipt facts at $32, denies forged/foreign requests and refuses frozen-cart changes without rewriting those carts or Orders. The default `status-v1` wrapper returns503 against the candidate's removed status route; restarting that same fixture with explicit `cart-v1` returns200 for both original capabilities. Forged/foreign requests, mutation bodies and mismatched attempt locators get no receipt. This is the actual anonymous EmDash public dispatcher, not a fabricated response or HTTP bridge. The disposable site loads the real wrapper, not the whole merchant storefront/Caddy; separate middleware units verify the existing rate budget and checkout pause. The new mutable native cart endpoint is classified as checkout, never a status exemption: it is blocked during a pause and refused by the current legacy public admission even when checkout is open.

The second phase uses the candidate **kernel with synthetic Payments**, replays the same attempt and reconciles it paid without another provider session. An idempotent ensure-session call is counted separately from creation. Runtime output is discarded and temporary databases/site/processes are removed in `finally`; the fixture uses the merchant dependency tree without copying it.

November13: the earlier old35f80f2→candidate986a382 direct check remains historical. Fresh old35f80f2→candidate1ef8465 passes both direct and actual-wrapper checks: candidate backend131043bytes/29headroom on Node24.22.0. The old Registry `status` address returns401; the new `cart` read is supported. The elapsed-window old status reported recoverable failure with Payments unavailable, while the unconfigured installed cart read reports pending. The new candidate also adds frozen contact to paid orders. This is **not exact whole-response/order equivalence**, release or provider proof. The unchanged merchant wire omits top-level `total`; this non-pricing fixture therefore proves pending identity/state and the direct frozen total, not a new pending amount projection. Its paid wrapper receipt retains $32 and the same order/receipt/line quantity. Evidence: workspace `evidence/2026-11-13-recovery-wrapper-installed.json`.

## Explicit recovery staging, not an upgrade switch

`BACKROADBUM_RECOVERY_PROTOCOL` defaults to `status-v1`. That is the **only serving mode on signed Commerce0.8.0**. Once a coordinated candidate installation is independently qualified, `cart-v1` may be set in the merchant server environment; it requires `BACKROADBUM_MERCHANT_PROFILE=1` and refuses playground use. Unknown values fail closed. **Do not set cart-v1 on the current signed plugin:** it has no cart route and recovery would become unavailable.

In cart mode the wrapper accepts only `{}` or `{ "attemptId": "<original locator>" }`, sends exactly `{}` to the fixed cart endpoint and retains the original capability header. No `lines`, `version`, `key`, wake or other field can turn it into a write. A requested attempt must equal Commerce's returned attempt or no projection is relayed; cart reads cannot locate older attempts. Only the existing validated checkout wire is returned, not mutable cart state or secret capability material. Origin/host checks, body/response bounds, merchant rate budget and checkout-pause recovery remain in place. There is no automatic probing/fallback, capability replacement or change to browser storage, start or payment authority.

This adapter does **not** adopt Template229's real forms, cookies or server cart, nor make the merchant's old inline-lines start protocol compatible. It removes only the recovery-wrapper source blocker; activation and the full shopper migration remain separate gates.

## Before merchant adoption

- Obtain the coordinated signed Commerce beta and matching template pin. Independently qualify real forms, cookie security and actual hosted TEST checkout in isolation; this command does not qualify Template #229 or signed installation.
- The recovery wrapper's explicit cart-read mode is source-qualified, not activated. Requalify against the actual coordinated artifact before enabling it. Preserve original browser capabilities and unresolved attempts; the upstream owner's no-fallback template policy is not permission to lose this store's evidence. Do not resend old inline lines to the new start route.
- Qualify a paid receipt and unresolved original-capability read through that wrapper, without replacement starts. Plan fresh-cart handling separately; unresolved payment still freezes edits.
- Keep a matching private database/configuration recovery snapshot and explicit rollback conditions. This is not full admin/catalog upgrade, scheduled cleanup, account delivery, hosted Payments, carrier, or off-host recovery proof.

The repository's broader `test:registry-upgrade` run on this host stopped in the **old** admin phase with a V8 heap exhaustion before catalog creation. It did not reproduce the author's later catalog-create failure, enter the new phase, or prove an EmDash product bug. The narrower check deliberately avoids that admin fixture rather than calling the broad gate passed.
