# Offline upload recovery

The credential drill verifies the database and encrypted connection settings, but does not restore uploads. `verify_upload_recovery.py` separately restores `content.db` and the entire uploads tree from a completed local archive, then checks every **ready** media row against its restored file's size and recorded SHA-1/SHA-256 digest. It does not read the live database/uploads, extract private configuration, start a server or contact a provider.

From the primary template-store checkout:

```sh
python3 ops/backroadbum/verify_upload_recovery.py PRIVATE_ARCHIVE
python3 -m unittest discover -s ops/backroadbum -p test_upload_recovery.py -v
```

Choose an existing 0600 archive under the private backups directory; no new snapshot or service restart is needed. Output is aggregate counts/outcomes only; failure emits one fixed message without paths, media keys, database rows or archive details. No success summary is emitted if a ready file is missing, has different bytes/size, or lacks a supported hash. Non-ready rows are counted separately, not certified.

## Automatic latest-archive check

The production `backup.py` CLI (used by the daily systemd timer and `deploy.sh`) now runs `upload_recovery_status.check_latest` after writing a snapshot and before reporting success. A refused media check leaves the archive available for investigation but exits nonzero; deployment stops before release promotion. The snapshot function, writer and three-archive retention are unchanged. Direct library callers of `snapshot()` still need to invoke the check explicitly.

The check takes the same backup lock, selects the latest completed archive and writes a private 0600 `upload-recovery-check.json` receipt atomically under `/var/lib/backroadbum/`. The receipt records the archive filename, device/inode, size, modification/change times and aggregate results. Telemetry compares that identity every minute, without extracting again: a different or modified archive is **not checked**, not covered by an older success. Missing/corrupt evidence is unavailable; a matching refusal is failed. This invalidation guard is not independent authenticity or signature verification, and the timestamp is a past observation, not continuous monitoring of bytes. No private receipt fields, exception text or archive/media paths reach the dashboard.

To check the latest existing archive without making a new backup:

```sh
python3 ops/backroadbum/upload_recovery_status.py
python3 -m unittest discover -s ops/backroadbum -p 'test_upload_recovery*.py' -v
```

A routine timer run or deployment performs the same check independently of agent cycles. The collector only reads the receipt; it never verifies hosted connections, starts a runtime or opens an archive on each minute sample. Manual archive checks above remain useful for older recovery points.

## Extraction boundary

The archive remains a credential: its database includes private/authentication data even though this drill does not extract the encryption ring or retired transport configuration. A new 0700 temporary directory holds the copy; files are normalized to 0600 and directories to 0700. The tool refuses existing/linked destinations, duplicate or noncanonical scoped paths, traversal, links, special files, file/parent collisions and incomplete database/uploads headers before extraction. Bounds are 10,000 archive headers, 128 MiB per selected file and 512 MiB selected bytes; raise deliberately if the store grows. Temporary data is removed after success or failure.

## Verified November 13, 2026

The earlier three-archive drill restored 13 upload files (445,424 bytes) and seven ready media records (241,416 media bytes). After the mug gallery publication, the latest existing archive independently restores 15 upload files (550,044 bytes) with all nine ready media records matching archived sizes and SHA-1 hashes (346,036 media bytes), no non-ready rows and zero traced network syscalls. The private receipt matches that latest archive. The earlier independent credential drill decrypted all three plugin settings; that is separate evidence, not newly rerun by the automatic media check.

Synthetic tests cover missing/changed media, unsafe archives, receipt refusal, newer/replaced archives, malformed or linked receipts, atomic-write cleanup and the actual backup CLI’s successful/failed gate. A failed check retains its archive and never replaces the live database or uploads.

Six restored upload files are Registry cache manifests/backends, **not** newly verified signatures, installed plugin acceptance or execution proof. The recorded media digest checks consistency with archived metadata, not independent authenticity or a claim about every editorial remote image. This offline command does not prove runtime/admin sign-in, hosted authorization, off-host recovery or the outcome of a future check. The separate opt-in November 14 drill in `runtime-recovery.md` boots a restored copy using deployed code with external networking blocked; unattended media checks still do not start a runtime. Admin sign-in, hosted authorization and off-host recovery remain unverified. The snapshot writer and retention policy are unchanged; the automatic result covers only its matching latest archive. Run the manual drill on any older archive being considered for recovery. See `emdash-credential-recovery.md` for the separate encryption-ring drill and recovery limits. Never replay payments or labels as a restore test.
