# Native catalog edits and stale forms

## Verified beta workflow · November 17, 2026
Commerce **0.9.0-beta.2**, genuinely installed from the Registry, protects sibling size forms with the product’s shared revision. Two editor contexts on the prepared Field Journal theme exercised M and XL saves while plain desktop and enhanced Dark phone carts retained M×2 + XL×1. Evidence: `evidence/2026-11-17-native-catalog-contention/{native-contention.json,events.json,staged-business-before.json,staged-business-after.json,cycle.md}`; four inspected interaction-state images are public at `/pr-proof/native-catalog-contention/`.

This is a disposable public-only fixture with no Orders, Payments or hosted consents—not a live promotion, original CMS revision clone, signed in-place upgrade or hosted purchase. The first incomplete fixture was discarded after a test incorrectly expected variant SKU text in the cart; the second fresh fixture completed once under its own action guard. Exact cart member links and separate read-only staged SKU records are checked instead of inventing missing public SKU data.

## Merchant procedure
1. Open the intended product’s native **Dinkus Commerce** panel. Confirm the size, SKU, Regular/Sale fields and availability before changing it; record the intended operation before Save.
2. Treat **“Product changed; reload before saving”** as a refusal, even when the Block Kit HTTP response is200. The inline error/toast carries the business outcome. A sibling size save can invalidate your form; this is deliberate whole-product fencing, not evidence that the two sizes share prices.
3. Preserve any unsaved corrections privately, then reload and reopen Settings/Commerce/the intended size. Read the newer values before deciding what should still be changed. The refused form retains its typed price, sale, SKU and stock state, but a second Save from that same stale form remains refused—it is not a forced overwrite.
4. Save only from the fresh form, then inspect the persisted panel and shopper/agent-feed view. After a timeout or uncertain response, inspect before retrying; an enabled Save button is not proof the previous action failed.
5. On a phone, use the native editor’s Settings button to reopen its drawer when needed. Do not force-click inert or hidden fields, patch catalog records, or bypass the native revision action.

## What the rehearsal established
A saves M at Regular70/Sale60; B’s already-open XL form tries90/50, a changed SKU and Out of stock, and is refused twice without partial writes. B reloads and saves XL80/62/backorder; A’s now-stale M form is refused with its own edits intact. Existing carts and feed agree at **$204 → $188 → $182 → $204**, with unchanged quantities, exact member links and Secure/HttpOnly capabilities. Original M/XL68 prices, blank Sales, original SKUs and stock states are restored through fresh native forms; all32 imported public catalog/media/page row data are byte-identical afterward, except allowed storage revisions.

No new framework defect or upstream change is proposed. The live signed0.8 installation and paid Orders remain unchanged; qualifying its existing forms or a future stable migration is a separate task. Public feed money checks here prove effective prices, not an authoritative Regular/Sale pair.
