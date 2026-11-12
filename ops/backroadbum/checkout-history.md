# Checkout readiness observations

The existing minute telemetry service is the single writer for `/var/lib/backroadbum/checkout-observations.json` (0600, atomic replacement). Use `systemctl start backroadbum-telemetry.service` for a manual sample rather than launching another collector process; systemd serializes the writer. Deploy `checkout_history.py` alongside `collect-telemetry.py` in the service's working ops directory before enabling the import.

Only allowlisted UTC times, HTTP status, sample counts and readiness states are retained: five completed unavailable windows plus an active one. Planned admission closure does not start a failure window; if it ends one, it is not called recovery. Gaps over three minutes are marked unknown. Windows describe observations, not continuous outage durations or payment outcomes.

Missing files begin a new monitoring record at the actual first sample. Existing corrupt/unreadable evidence is never reset: current telemetry continues with history unavailable. Copy that file privately for diagnosis and repair only from known evidence; do not infer or manufacture earlier success. The earlier manually documented 503 remains in build history, not backfilled into automatic observations.

## Probe diagnosis

Each minute still makes one GET with a 10-second socket timeout, without retries or provider requests. `checkout_probe.py` reads at most 4097 bytes and rejects bodies above 4096; it returns only a fixed outcome category, HTTP status when known and monotonic elapsed milliseconds. Python’s socket timeout is not a guaranteed end-to-end deadline. The overview shows the latest category/timing; normal telemetry replacement does not create a latency history.

An actual unavailable independent sample emits one `checkout-probe-unavailable` JSON event to the existing service journal. Inspect privately with `sudo journalctl -u backroadbum-telemetry.service --since '2026-11-12 11:00 UTC' -o cat`; never publish raw journal output. Events contain only UTC time, schema, category, elapsed milliseconds and HTTP status, not response bodies, exception messages, headers, URLs or credentials. Healthy and deliberately closed admission samples emit no failure event. Journal retention follows the host’s journal policy, not the five-window file limit; no permanent incident archive is implied.

Timeout/network/read/contract categories describe the probe, not a payment-provider outage. They cannot diagnose the two earlier no-response samples, which predate these diagnostics. The existing observation-history format and first monitoring time remain unchanged. The event time is the end of the checkout probe; the history’s sample time is the end of the full telemetry pass.

Run `python3 -m unittest -v test_checkout_probe test_checkout_history test_checkout_metrics test_account_metrics` from this directory. Tests inject private fake openers/temporary storage only; never simulate a failure in the live history or service journal for coverage.
