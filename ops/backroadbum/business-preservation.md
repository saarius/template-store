# Read-only business preservation evidence

Use `node scripts/inspect-backroadbum-business.mjs --check` before and after a bounded change. It reports counts and SHA-256 digests only, in a read transaction; it never prints records. `--db=PATH` selects a private offline database copy. Compare like-for-like snapshots from this command; a changed count or hash requires scoped investigation, not a blanket preservation claim.

Orders, numbering and catalog items are `_plugin_storage` collections. Products, categories and pages are actual `ec_products`, `ec_categories` and `ec_pages` tables. Earlier ad hoc snapshots queried those table names as plugin collections, producing empty counts/hashes; those values do **not** prove CMS preservation. Missing tables now fail closed rather than masquerading as empty CMS content. Do not compare these new hashes directly with old-format hashes.

For native merchant changes, keep original private rows (0600) and separately compare the intentionally changed aggregate plus every unrelated row. A root variant product may legitimately gain members and a new publication claim while its original M member remains unchanged. Never roll back business records wholesale from a snapshot or treat a public guest cart as order authority.
