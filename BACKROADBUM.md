# Backroad Bum deployment

Merchant-specific fork branch: `backroadbum/store`. The public store is https://backroadbum.com; this is not a generic TemplateStore release or an upstream change proposal. `PRODUCT.md` and `DESIGN.md` record the provisional brand; the original starter design is archived at `docs/template-design.md`.

## Current state
Five products are stored in EmDash and the pinned Commerce Registry bundle. Guest cart, two field notes, HTTPS, protected admin, telemetry and local backups are working. Payments and Ship Registry bundles are mounted, but their service connections, paid orders, receipts and sandbox fulfillment are not yet verified; checkout refuses requests.

## Operate
- Node 24.22.2, pnpm 11.9.0. Use `NODE_OPTIONS=--max-old-space-size=1600 pnpm exec astro check` on this 2 GB host.
- Store: `backroadbum.service`; proxy: `caddy.service`. Service sources and deploy/backup scripts are in `ops/backroadbum/`.
- Durable data: `/var/lib/backroadbum/content.db` and `uploads/`. Deploys build into `releases/` and atomically switch `current`; two releases and at most three SQLite/upload backups are retained. Run `bash /var/lib/trialrun/workspace/ops/deploy.sh`.
- `backroadbum-telemetry.timer` samples public-safe health and host metrics each minute. `backroadbum-backup.timer` takes a daily consistent SQLite/upload snapshot. Backups are local only; off-host recovery remains unfinished.
- Caddy gates private EmDash paths with a random credential; EmDash also requires a passkey. Credentials live only in `/etc/backroadbum/` with mode 0600. The private Caddy configuration is intentionally not committed. Never enable a production dev-bypass.
- `scripts/backroadbum-admin.mjs` opens a local passkey-authenticated browser; always call `saveKey()` and close the browser in `finally` to preserve authenticator counters. Do not run multiple operator helpers concurrently.
- `node scripts/backroadbum-seed.mjs` adopts untouched starter records and creates missing brand products/pages. It deliberately does not reset merchant-edited products or prices.
- `node scripts/verify-backroadbum.mjs` checks public desktop/mobile shopping and refusal boundaries. Evidence goes to ignored `runs/backroadbum/`; no orders or personal data are created.

## Next
Connect a merchant-owned Payments runtime with fail-closed Stripe test keys, then prove the full payment/receipt flow before opening checkout. Investigate the observed Node image dependency gap on an isolated generic branch before proposing an upstream patch. Visitor/order aggregates, cycle/token accounting, off-host backups and sandbox shipping remain incomplete; the dashboard reports these as unavailable rather than zero.
