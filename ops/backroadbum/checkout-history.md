# Checkout readiness observations

The existing minute telemetry service is the single writer for `/var/lib/backroadbum/checkout-observations.json` (0600, atomic replacement). Use `systemctl start backroadbum-telemetry.service` for a manual sample rather than launching another collector process; systemd serializes the writer. Deploy `checkout_history.py` alongside `collect-telemetry.py` in the service's working ops directory before enabling the import.

Only allowlisted UTC times, HTTP status, sample counts and readiness states are retained: five completed unavailable windows plus an active one. Planned admission closure does not start a failure window; if it ends one, it is not called recovery. Gaps over three minutes are marked unknown. Windows describe observations, not continuous outage durations or payment outcomes.

Missing files begin a new monitoring record at the actual first sample. Existing corrupt/unreadable evidence is never reset: current telemetry continues with history unavailable. Copy that file privately for diagnosis and repair only from known evidence; do not infer or manufacture earlier success. The earlier manually documented 503 remains in build history, not backfilled into automatic observations.

Run `python3 -m unittest -v test_checkout_history test_checkout_metrics test_account_metrics` from this directory. Tests use temporary storage only; never simulate a failure in the live history for coverage.
