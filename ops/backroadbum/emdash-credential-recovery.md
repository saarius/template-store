# EmDash credential recovery

Backroad Bum stores three hosted-plugin connection settings as encrypted EmDash 1.4.0 values in `content.db`. Earlier local snapshots omitted `/etc/backroadbum/emdash.env`; the database alone cannot decrypt those values. Current snapshots include a normalized `recovery/emdash.env` containing **only** `EMDASH_ENCRYPTION_KEY`, alongside the matching online SQLite copy.

## Private archive boundary

The archive now holds both ciphertext and its decryption key. Treat the **entire archive as a credential**, not as encrypted storage: keep the backup directory at 0700 and archives at 0600, outside every public web root. Never print or upload archive contents, source the recovered file in a diagnostic shell, commit recovery material, or attach it to a dashboard/issue/PR. Off-host storage needs an independently protected encrypted transport/destination; none is configured or verified yet.

The snapshot writer requires a regular 0600 configuration file containing only the allowlisted assignment. It validates canonical EmDash key syntax, retains rotation-ring keys, checks that every encrypted plugin setting's key ID is covered, and refuses a key change during copying. A failed snapshot does not replace the last good archive. Successful snapshots retain at most three archives, excluding dependencies, git and server binaries; earlier retained archives may still lack the key until they age out.

## Non-mutating drill

From the primary template-store checkout, with Node 24 and its existing dependencies:

```sh
sudo systemctl start backroadbum-backup.service
node ops/backroadbum/verify-emdash-recovery.mjs PRIVATE_ARCHIVE
```

Choose a completed private `.tar.gz` under `/var/lib/backroadbum/backups/`; do not send its contents to stdout. The verifier creates a new 0700 temporary directory, extracts only regular 0600 `content.db` and `recovery/emdash.env`, checks SQLite/key coverage, and uses EmDash's installed authenticated decoder for every encrypted plugin setting. It also checks that decryption without a key is refused. Output contains only counts and outcomes; exceptions, key IDs, decrypted values and rows are not relayed. The temporary copy is removed on success or failure.

No HTTP server, provider request, plugin reconnect, checkout, label, live-file replacement or runtime restart occurs. The retired Ship drill ignores the active EmDash key and continues to extract only its own scoped material. Unit coverage uses synthetic secrets and never reads production configuration:

```sh
python3 -m unittest discover -s ops/backroadbum -p test_backup.py -v
node --test ops/backroadbum/test_emdash_recovery.mjs
```

## Restore limits

This proves recovery of encrypted settings from a local archive, not a complete store restart, current hosted authorization, admin sign-in, upload restoration or off-host disaster recovery. The separate offline drill in `upload-recovery.md` now restores uploads and checks ready-media sizes/hashes; it does not add runtime or off-host qualification. A real restore still needs a reviewed deployment/configuration procedure, the corresponding database and encryption ring, uploads, signed Registry plugins, private admin access and verification with new checkout admission paused. Do not generate a replacement key to silence a missing-key error: an unrelated key cannot decrypt existing connection settings. Never replay payments or labels as a recovery test.
