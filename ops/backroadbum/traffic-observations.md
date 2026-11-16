# Page-response observations

The merchant's optional traffic observer runs after response construction, not as analytics JavaScript. It records successful canonical public-page HTML GET navigations only, with conservative Fetch Metadata/browser-header checks. Editor/preview URLs, the editing cookie, explicit authorization, known bots, HeadlessChrome, monitors, scripted agents, `Purpose`/`Sec-Purpose` prefetches and `BackroadBum-SelfCheck/1.0` are excluded; `X-BackroadBum-Self-Check: 1` also opts a request out. Always tag automated/operator probes. These filters can undercount browsers and miss disguised automation; totals are recorded page responses, never unique people, sessions, engagement or sales.

## Storage and serving
- Explicit `BACKROADBUM_TRAFFIC_ENABLED=1`, production Node and hosted Registry are required, behind the middleware's merchant/non-proof/non-playground/non-Cloudflare guard. Other templates, source previews and staging remain inert by default.
- `/var/lib/backroadbum/traffic.db` is a separate 0600 SQLite ledger, not Commerce or controller state. Only schema/start/minute-heartbeat metadata and UTC-day/count rows are stored. The last 90 UTC dates are retained; request addresses, URLs, queries, referrers, cookies, user agents and IPs are never persisted. No visitor cookie or third-party call is added.
- Failed recording never fails a shopper response; a one-minute retry cooldown limits repeated storage failures. The independent existing telemetry timer reads the ledger read-only. Missing, corrupt, future or over-three-minute-stale data becomes unavailable, not zero. Values are best-effort recorded responses, not a complete access log; the dashboard also refuses stale telemetry.
- Collection begins at the ledger's `since` timestamp; no earlier history is inferred. The disposable traffic ledger is intentionally outside commerce recovery archives. If it is lost, preserve the damaged file for investigation and explicitly restart a new observation interval; never combine an old start timestamp with reset counters. Disabling the opt-in flag leaves data intact and causes observations to become stale/unavailable.

## Verification
From `repos/template-store`: `pnpm exec vitest run tests/unit/backroadbum-traffic.test.ts tests/unit/backroadbum-telemetry.test.ts tests/unit/backroadbum-dashboard.test.ts`.
From the workspace: `PYTHONPATH=ops python3 -m unittest ops/test_traffic_metrics.py`.

Positive-count, private-value exclusion, reopen and retention checks use disposable ledgers only. Do not manufacture production audience traffic to test an increment. Live verification uses tagged/headless requests, checks the initialization/heartbeat and confirms excluded probes do not raise counters. Dashboard figures never substitute for independently verified Stripe test orders; unique visitors and visitor-attributed orders remain unavailable.
