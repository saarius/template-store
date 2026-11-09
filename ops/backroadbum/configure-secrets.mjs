// Run once with sudo on this merchant host. Never replace an existing encryption key.
import { randomBytes } from 'node:crypto';
import { chownSync, writeFileSync } from 'node:fs';
const path = '/etc/backroadbum/emdash.env';
writeFileSync(path, `EMDASH_ENCRYPTION_KEY=emdash_enc_v1_${randomBytes(32).toString('base64url')}\n`, { flag: 'wx', mode: 0o600 });
if (process.getuid?.() === 0) chownSync(path, 1000, 1000);
console.log('Private EmDash encryption key created; keep a separate secure recovery copy.');
