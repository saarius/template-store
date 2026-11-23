# Isolated store-runtime recovery

The opt-in drill boots an existing private archive with the **current or a named retained release and a selected dependency tree**. It is a local runtime rehearsal, not a second live store, a self-contained backup, a provider test or a promotion procedure. The daily backup timer still performs the cheaper offline media check only.

From the primary template-store checkout, on this systemd host with Node 24 and passwordless agent sudo:

```sh
python3 ops/backroadbum/verify_runtime_recovery.py
python3 ops/backroadbum/verify_runtime_recovery.py --check --archive PRIVATE_ARCHIVE
python3 ops/backroadbum/verify_runtime_recovery.py --check --archive PRIVATE_ARCHIVE --release RETAINED_RELEASE_ID
python3 ops/backroadbum/verify_runtime_recovery.py --check --archive PRIVATE_ARCHIVE --release RETAINED_RELEASE_ID --dependencies /path/in/workspace/node_modules
python3 ops/backroadbum/verify_runtime_recovery.py --check --archive PRIVATE_ARCHIVE --release RETAINED_RELEASE_ID --dependencies /path/in/workspace/node_modules --pinned-launcher
python3 -m unittest discover -s ops/backroadbum -p test_runtime_recovery.py -v
node --test ops/backroadbum/test_runtime_recovery.mjs
```

Choose one completed 0600 archive under the private backups directory. Without `--check` nothing starts; an explicit archive is required. `--release` takes a retained deployment ID (`YYYYMMDDTHHMMSSZ`), not a path or symlink. Omit it to boot the current release. `--dependencies` takes the actual installed `node_modules` directory inside the workspace, not another symlink or an archive member. Omit it to select the primary checkout's tree. Install the separate tree from the intended release's locked manifests; the checker proves resolution and boot, not package provenance or an exact lockfile match. Success emits a `backroadbum.runtime-recovery-check/v1` report with `retainedRelease`, `dependencySelection`, and module and workerd checks. Neither `current` nor the serving dependency link moves. Failure emits a fixed message; runtime logs, archive contents, paths to dependency trees, key IDs, decrypted connections and rows are never relayed.

## Isolation and scope

- A new 0700 temporary directory receives only the bounded content/uploads extraction and the archived, validated encryption ring. Ready media sizes/hashes and encrypted-setting key coverage must pass first. Retired transport persistence/configuration is not extracted.
- A transient agent-owned systemd service bind-mounts the copy **over the live data path inside its own mount namespace**, with the deployed release read-only. Live private configuration, controller state/sessions and the agent home are hidden. The remaining host filesystem is read-only; temporary runtime files stay private.
- `PrivateNetwork=yes` gives the process and its workerd descendants a different network namespace with loopback only. Neither hosted services nor the live storefront are reachable. The child refuses execution outside that namespace or without its restored-copy marker and hidden-live-path checks. It uses the archived ring, never the live environment file.
- The isolated app uses the storefront launcher. A Node hook refuses resolved module files outside the bound bundle and selected dependency tree. After the installed Commerce catalog responds, the checker confirms the actual running workerd binary is from the same tree. The checker itself uses primary operator tooling; this is a module and subprocess check, not a general filesystem policy.
- `--pinned-launcher` rehearses the optional serving command with a private release pointer and a sibling `node_modules` symlink beside read-only mounts for the compiled `server` and `client` directories. A working primary parent link remains in the fixture so accidental fallback is detectable. This never installs the candidate drop-in. The unflagged path still tests legacy release layout.
- The HTTP reader admits only six named public pages, the installed Commerce public catalog, the passive agent JSON feed, archived media, up to 32 published/undeleted Field Notes derived from the restored CMS, and the anonymous EmDash admin redirect. Unsafe, duplicate or over-limit note routes refuse the drill; arbitrary pages/APIs and query capabilities remain inadmissible. It follows no redirects and performs no POST, checkout preparation/start, connection, quote, label or completion action. Every ready media file is checked offline; one is also served over HTTP and hash-checked.
- Final scoped CMS/business rows, **all plugin storage** (including saved carts/capabilities) and media rows must match their preboot copies. The aggregate report includes all six scoped collection counts, `businessCollectionsSha256`, Field Note HTTP checks and actual agent-feed family/member counts; it emits no records or private identities. To compare an archive with the baseline from `node scripts/inspect-backroadbum-business.mjs --check`, hash the baseline’s `collections` object in emitted order with `jq -cj .collections BASELINE | sha256sum` (`-j` omits the newline). Compare that digest to the report; this is not a whole-database checksum. Runtime shutdown must drain successfully; systemd bounds all descendants, memory and elapsed time. The parent stops the unit before removing private temporary data, including after failure/interruption.

## Verified November 23, 2026 · serving launcher candidate

The candidate launcher booted current release `20261123T125025Z` and retained release `20261123T113317Z` in separate private namespaces against one archive. The retained boot used a second install of the same lockfile; real Commerce/workerd, catalog and media reads, ten Orders and clean drain passed. An empty selected tree failed despite a working primary fallback. A legacy launch still booted the same archive. The unit candidate passed syntax verification but was not installed, and the live service never restarted. See `evidence/2026-11-23-serving-dependency-selection/` and the [candidate cutover steps](server-cart-upgrade.md#stage-b-serving-dependency-candidate).

## Verified November 23, 2026 · separate dependency trees

A single archived database booted release `20261123T113317Z` with primary dependencies and retained `20261123T110209Z` with a separately installed copy of the same lockfile. In each private namespace, JavaScript and the workerd executable came from the chosen tree, ten Orders and the seven-family/eleven-member feed remained, and the runtime drained without modifying the restored business rows. Nine Python tests and eight Node tests passed, including refusal of modules linked to an alternate tree. Evidence: `evidence/2026-11-23-runtime-dependency-lanes/` in the operator workspace.

The alternate tree was disposable. This did not test cross-version dependencies, a live release/dependency swap, a previous unit restoration or hosted reconciliation. Keep both exact dependency trees for the actual maintenance window and do not erase either under idle-worktree cleanup while it serves or remains a rollback target.

## Verified November 23, 2026

The same completed 10:35 UTC archive booted both the current release `20261123T103500Z` and the previous retained release `20261123T100414Z`. Both served ten archived Field Notes and the seven-family, eleven-member agent feed, checked ten ready media files and one media response, decrypted three archived plugin settings, retained ten Orders and stopped cleanly. The live release pointer and business digests did not change. Eight Python tests and seven Node tests passed; evidence is in `evidence/2026-11-23-cutover-recovery/` in the operator workspace.

These releases share the current primary dependencies. This drill did not replace the serving database, revert EmDash migrations, restore unit configuration or exercise hosted callbacks. See the [Stage B rollback plan](server-cart-upgrade.md#stage-b-rollback-point--before-the-maintenance-window) before changing the dependency tree or upgrading Commerce.

## Verified November 16, 2026

The 21:46 UTC archive boots merchant b6418b1 while retaining 10 Orders, 11 catalog records, 7 CMS products, 5 categories and 12 pages. All eight archived published Field Notes render, the passive agent feed serves seven families/eleven members, and the original six pages, installed Commerce catalog, anonymous sign-in redirect and clean drain still pass. Three archived plugin settings decrypt; all ten ready media files and sixteen upload files restore, with one media response hash-checked over HTTP. Seven Node guard/parser tests and seven Python archive/isolation/lifecycle tests pass; live business hashes remain unchanged, and no hosted connection or commerce action is replayed.

Evidence: `evidence/2026-11-16-recovery-refresh/`; the baseline run and expanded run used the same completed archive. Feed counts check the restored endpoint/envelope and concrete identities, not a fresh schema/pricing/availability qualification. Published-note checks verify successful rendering, not complete manuscript equality or print pagination. The daily timer still performs only offline asset verification; runtime drills remain explicit and opt-in.

## Earlier drill · November 14, 2026

The cap-era archive boots the current deployed release, serves all six pages and six Commerce families through the existing installed Registry loader, decrypts three archived plugin settings, and serves matching local media. All nine ready media files and fifteen upload files restore; anonymous admin redirects to sign-in, all scoped rows stay unchanged, and the runtime drains normally. The completed drill uses about 270 MiB peak memory; source tests separately cover unsafe/missing/duplicate/oversized keys, missing ring coverage, isolation configuration, request refusal and accidental direct child execution.

This exercises the cached installed **Commerce** backend; it does not freshly download or independently certify Registry signatures, or exercise Payments/Ship runtime behavior. Existing signed package versions and hosted grants are not changed. The current code/dependencies are host inputs, not restored archive assets; source rehydration on a new host remains untested. Admin passkey sign-in, Caddy/Basic Auth/TLS restoration, current hosted authorization, background-job behavior and encrypted off-host recovery remain unverified. Never replay a payment or label to make the drill pass. See `emdash-credential-recovery.md` and `upload-recovery.md` for the separate offline checks and private-archive boundary.
