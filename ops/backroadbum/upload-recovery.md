# Offline upload recovery

The credential drill verifies the database and encrypted connection settings, but does not restore uploads. `verify_upload_recovery.py` separately restores `content.db` and the entire uploads tree from a completed local archive, then checks every **ready** media row against its restored file's size and recorded SHA-1/SHA-256 digest. It does not read the live database/uploads, extract private configuration, start a server or contact a provider.

From the primary template-store checkout:

```sh
python3 ops/backroadbum/verify_upload_recovery.py PRIVATE_ARCHIVE
python3 -m unittest discover -s ops/backroadbum -p test_upload_recovery.py -v
```

Choose an existing 0600 archive under the private backups directory; no new snapshot or service restart is needed. Output is aggregate counts/outcomes only; failure emits one fixed message without paths, media keys, database rows or archive details. No success summary is emitted if a ready file is missing, has different bytes/size, or lacks a supported hash. Non-ready rows are counted separately, not certified.

## Extraction boundary

The archive remains a credential: its database includes private/authentication data even though this drill does not extract the encryption ring or retired transport configuration. A new 0700 temporary directory holds the copy; files are normalized to 0600 and directories to 0700. The tool refuses existing/linked destinations, duplicate or noncanonical scoped paths, traversal, links, special files, file/parent collisions and incomplete database/uploads headers before extraction. Bounds are 10,000 archive headers, 128 MiB per selected file and 512 MiB selected bytes; raise deliberately if the store grows. Temporary data is removed after success or failure.

## Verified November 13, 2026

All three retained archives independently restore 13 upload files (445,424 bytes). All seven ready EmDash media records match their archived sizes and SHA-1 hashes (241,416 media bytes), with no non-ready rows. A traced run makes zero network syscalls; the independent credential drill also still decrypts all three plugin settings. The media verifier detects missing files, changed same-length bytes, wrong sizes, missing/unsupported hashes and unsafe storage keys in synthetic tests.

Six restored upload files are Registry cache manifests/backends, **not** newly verified signatures, installed plugin acceptance or execution proof. The recorded media digest checks consistency with archived metadata, not independent authenticity or a claim about every editorial remote image. This is not a full runtime/admin sign-in, hosted authorization, off-host recovery or automatic verification of future backups. The snapshot writer and retention policy are unchanged; run the drill on the particular archive being considered for recovery. See `emdash-credential-recovery.md` for the separate encryption-ring drill and recovery limits. Never replay payments or labels as a restore test.
