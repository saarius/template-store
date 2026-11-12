# Store shutdown

The merchant launcher `start-store.mjs` uses the standalone Astro 11.0.2 adapter's exported `startServer`, with autostart disabled. It changes no EmDash source, Registry plugin or payment contract. The service starts it with the immutable built entry as its argument; the primary checkout/dependencies must remain available.

## Signal order and failure boundary

`KillSignal=SIGINT` and `KillMode=mixed` send the initial signal to Node only. The launcher closes the public Node HTTP listener and waits for accepted HTTP requests to finish, then sends SIGTERM to itself so sandbox-workerd 0.9.6's existing listener cleans up workerd and its backing service. Repeated SIGINT does not forward early or reset the deadline. No library listener is removed, private runner API called or successful process exit forced.

The eight-second timer is unreferenced: a clean process exits naturally with code 0. A stuck HTTP request or retained handle reaches that deadline and exits 1; systemd's ten-second stop bound and whole-cgroup escalation remain. Direct external SIGTERM is bounded, but the runner receives it concurrently with HTTP close and therefore **does not promise in-flight plugin drain**. Use the service's normal stop/restart for the ordered path. This is not proof of background-job quiescence or full database/off-host recovery.

## Verification and rollout

Run `node --test --test-concurrency=1 ops/backroadbum/test_node_shutdown.mjs` in a separate loopback-only network namespace; workerd uses its default plugin port, which must not collide with the serving runner. Eleven cases cover the symlinked CLI, no runner/constructor/real worker, accepted real worker request, repeated signal, refused new connection, worker exit, direct SIGTERM, hung request, lingering handle, startup signal/failure and unchanged-entry negative control. The fixture has no Commerce, database, credentials, or external service.

On November 12, all eleven pass on Node 24.22.0 and 24.22.2. A separate current-release comparison used an online SQLite copy in a private mount/network namespace, with the original data directory overmounted and uploads/release mounted read-only. Both paths rendered six products and the current bandana price; the unchanged entry still served HTTP after SIGTERM, while the launcher exited 0 in 74ms. Evidence: workspace `evidence/2026-11-12-runtime-{shutdown-tests.txt,shutdown-live-node-tests.txt,built-proof.json}`. This is an existing signed-installation copy, not a new Registry install or provider test.

Install the reviewed `backroadbum.service`, run `systemctl daemon-reload`, and activate with one normal staged deployment. The old process did not use this launcher: do not call that migration stop a proven new-launcher drain. Inspect the **next normal** shutdown's journal and sampled HTTP behavior; do not restart the store merely to create evidence. Preserve historical readiness windows and all existing payment/label guards.

Rollback is the previous service unit plus daemon-reload and normal restart; immutable release rollback remains in `deploy.sh`. Do not change encryption configuration, authentication, signed plugins or checkout admission as a shutdown workaround.
