# Native catalog shipping weights

Use the product’s **Dinkus Commerce → Shipping** form. Labels name ounces and each variant; weights are Commerce data, not EmDash product copy. Keep the page editor’s save/publish operation separate.

## Current demo inputs
Wrong Turn Tee has M **6 oz**, L **6.5 oz**, XL **7 oz**, saved through signed Commerce0.8.0 on November12. These are illustrative values for fictional merchandise, not measured samples or a whole packed parcel. The bandana’s pre-existing2 oz is unchanged; other product weights remain unknown. A real merchant must weigh the goods and the complete package before buying postage.

## Editing safely
1. Read existing values and identify every member before editing. Keep price, SKU, availability and option identity untouched.
2. The form accepts positive ounces up to2400 with at most two decimals; blank clears a value. An invalid member refuses the entire weight save, without partially applying other members.
3. On EmDash1.4.0 a refusal can close Shipping even though the plugin returned it open. Reopen the same disclosure: typed values remain. Correct the input there rather than assuming it was erased or blindly repeating a save.
4. After a valid Save weight, read back every member and reload the native page. An uncertain save requires read-back before retry, not a direct database edit.

Existing paid Orders and acknowledged Ship records are not automatically rewritten by catalog editing. Do not change an order revision, replay sync or buy another label to test this. Order1008 remains completed at revision3 with its original paid snapshot and single sandbox label. Its16.5 oz package input is distinct from today’s catalog item weights.

Private terminal guard: `/etc/backroadbum/operator/tee-weights.json` at0600. It records the completed save and baseline hashes, not permission to replay it. Evidence index: workspace `evidence/2026-11-12-catalog-weight-cycle.md`; EmDash sharp-edge ledger item7 records the retained-form workaround.
