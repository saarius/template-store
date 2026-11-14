# Isolated store-runtime recovery

The opt-in drill boots an existing private archive with the **current deployed code and primary dependencies**. It is a local runtime rehearsal, not a second live store, a self-contained backup, a provider test or a promotion procedure. The daily backup timer still performs the cheaper offline media check only.

From the primary template-store checkout, on this systemd host with Node 24 and passwordless agent sudo:

```sh
python3 ops/backroadbum/verify_runtime_recovery.py
python3 ops/backroadbum/verify_runtime_recovery.py --check --archive PRIVATE_ARCHIVE
python3 -m unittest discover -s ops/backroadbum -p test_runtime_recovery.py -v
node --test ops/backroadbum/test_runtime_recovery.mjs
```

Choose one completed 0600 archive under the private backups directory. Without `--check` nothing starts; an explicit archive is required. Success emits one aggregate `backroadbum.runtime-recovery-check/v1` JSON report. Failure emits a fixed message; runtime logs, archive contents, key IDs, decrypted connections and rows are never relayed.

## Isolation and scope

- A new 0700 temporary directory receives only the bounded content/uploads extraction and the archived, validated encryption ring. Ready media sizes/hashes and encrypted-setting key coverage must pass first. Retired transport persistence/configuration is not extracted.
- A transient agent-owned systemd service bind-mounts the copy **over the live data path inside its own mount namespace**, with the deployed release read-only. Live private configuration, controller state/sessions and the agent home are hidden. The remaining host filesystem is read-only; temporary runtime files stay private.
- `PrivateNetwork=yes` gives the process and its workerd descendants a different network namespace with loopback only. Neither hosted services nor the live storefront are reachable. The child refuses execution outside that namespace or without its restored-copy marker and hidden-live-path checks. It uses the archived ring, never the live environment file.
- The HTTP reader admits only six named public pages, the installed Commerce public catalog, archived media and the anonymous EmDash admin redirect. It follows no redirects and performs no POST, checkout preparation/start, connection, quote, label or completion action. Every ready media file is checked offline; one is also served over HTTP and hash-checked.
- Final scoped CMS/business rows, **all plugin storage** (including saved carts/capabilities) and media rows must match their preboot copies. Eight Orders are retained in the November 14 archive. Runtime shutdown must drain successfully; systemd bounds all descendants, memory and elapsed time. The parent stops the unit before removing private temporary data, including after failure/interruption.

## Verified November 14, 2026

The cap-era archive boots the current deployed release, serves all six pages and six Commerce families through the existing installed Registry loader, decrypts three archived plugin settings, and serves matching local media. All nine ready media files and fifteen upload files restore; anonymous admin redirects to sign-in, all scoped rows stay unchanged, and the runtime drains normally. The completed drill uses about 270 MiB peak memory; source tests separately cover unsafe/missing/duplicate/oversized keys, missing ring coverage, isolation configuration, request refusal and accidental direct child execution.

This exercises the cached installed **Commerce** backend; it does not freshly download or independently certify Registry signatures, or exercise Payments/Ship runtime behavior. Existing signed package versions and hosted grants are not changed. The current code/dependencies are host inputs, not restored archive assets; source rehydration on a new host remains untested. Admin passkey sign-in, Caddy/Basic Auth/TLS restoration, current hosted authorization, background-job behavior and encrypted off-host recovery remain unverified. Never replay a payment or label to make the drill pass. See `emdash-credential-recovery.md` and `upload-recovery.md` for the separate offline checks and private-archive boundary.
