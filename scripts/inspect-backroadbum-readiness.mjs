// Read-only cache metadata for diagnosis, never an admission decision or refresh.
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

/** No generation, settings revision, row ID, binding, payload or exception leaves this boundary. */
export function summarizeReadinessCache(value, checkedAt = new Date()) {
  const now = Math.floor(checkedAt.getTime() / 1000);
  const unavailable = { schema: 'backroadbum.readiness-cache-inspection/v1',
    checkedAt: checkedAt.toISOString(), state: 'unavailable' };
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'attempts,expiresAt,generation,lastAttemptAt,status,version' ||
      value.version !== 1 || typeof value.generation !== 'string' || !value.generation.length || value.generation.length > 1024 ||
      !['supported', 'unavailable'].includes(value.status) || !Number.isSafeInteger(value.lastAttemptAt) ||
      value.lastAttemptAt < 0 || value.lastAttemptAt > now || value.expiresAt !== value.lastAttemptAt + 900 ||
      !Array.isArray(value.attempts) || !value.attempts.length || value.attempts.length > 100 ||
      !value.attempts.includes(value.lastAttemptAt) ||
      !value.attempts.every(at => Number.isSafeInteger(at) && at >= 0 && at <= value.lastAttemptAt)) return unavailable;
  const utc = at => new Date(at * 1000).toISOString();
  return { ...unavailable, state: 'recognized', cachedStatus: value.status,
    freshAtInspection: now < value.expiresAt, expiresAt: utc(value.expiresAt),
    lastAttemptAt: utc(value.lastAttemptAt), retainedAttemptCount: value.attempts.length,
    retainedAttemptTimes: value.attempts.map(utc) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv.includes('--check')) {
    console.log('No action. --check reads the installed Commerce readiness cache metadata without refreshing it.');
  } else {
    let db;
    try {
      db = new DatabaseSync('/var/lib/backroadbum/content.db', { readOnly: true });
      const row = db.prepare("SELECT data FROM _plugin_storage WHERE plugin_id=? AND collection=? AND id=?")
        .get('r_gshdrqaldna3r7sn', 'checkout_readiness', 'readiness');
      console.log(JSON.stringify(summarizeReadinessCache(row ? JSON.parse(row.data) : null), null, 2));
    } catch {
      console.error('Readiness inspection unavailable; database content and errors withheld. No writes attempted.');
      process.exitCode = 1;
    } finally { db?.close(); }
  }
}
