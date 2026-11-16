// Separate operational aggregates only: no content.db, request log or identity.
import { DatabaseSync } from 'node:sqlite';
import { closeSync, openSync } from 'node:fs';
import { qualifiesTraffic } from './traffic-policy.js';

export function openTrafficLedger(path: string) {
  const fd = openSync(path, 'a', 0o600); closeSync(fd);
  const db = new DatabaseSync(path);
  try {
    db.exec(`PRAGMA busy_timeout=50; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS traffic_meta (
        id INTEGER PRIMARY KEY CHECK(id=1), schema TEXT NOT NULL,
        since TEXT NOT NULL, heartbeat TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS traffic_days (
        day TEXT PRIMARY KEY, responses INTEGER NOT NULL CHECK(responses>0 AND responses<=9007199254740991)
      ) WITHOUT ROWID;`);
    let lastMinute = '';
    return {
      close: () => db.close(),
      observe(request: Request, response: Response, now = new Date()) {
        const iso = now.toISOString(), day = iso.slice(0, 10);
        const eligible = qualifiesTraffic(request, response);
        if (!eligible && iso.slice(0, 16) === lastMinute) return false;
        db.exec('BEGIN IMMEDIATE');
        try {
          const current = db.prepare('SELECT * FROM traffic_meta WHERE id=1').get();
          if (current && (current.schema !== 'backroadbum.traffic/v1' ||
              typeof current.since !== 'string' || typeof current.heartbeat !== 'string' ||
              !Number.isFinite(Date.parse(current.since)) || !Number.isFinite(Date.parse(current.heartbeat)) ||
              current.since > current.heartbeat || current.heartbeat > iso)) throw Error('traffic_state_unavailable');
          if (!current) {
            if (db.prepare('SELECT 1 FROM traffic_days LIMIT 1').get()) throw Error('traffic_state_unavailable');
            db.prepare('INSERT INTO traffic_meta VALUES(1,?,?,?)').run('backroadbum.traffic/v1', iso, iso);
          } else if (typeof current.heartbeat === 'string' && iso.slice(0, 16) !== current.heartbeat.slice(0, 16)) {
            db.prepare('UPDATE traffic_meta SET heartbeat=? WHERE id=1').run(iso);
          }
          if (eligible) db.prepare(`INSERT INTO traffic_days VALUES(?,1)
            ON CONFLICT(day) DO UPDATE SET responses=responses+1`).run(day);
          const cutoff = new Date(now.getTime() - 89 * 86400000).toISOString().slice(0, 10);
          db.prepare('DELETE FROM traffic_days WHERE day < ?').run(cutoff);
          db.exec('COMMIT');
          lastMinute = iso.slice(0, 16);
          return eligible;
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      },
    };
  } catch (error) { db.close(); throw error; }
}

export function createTrafficObserver(open: () => ReturnType<typeof openTrafficLedger>, clock = Date.now) {
  let current: ReturnType<typeof openTrafficLedger> | undefined;
  let retryAt = 0;
  return (request: Request, response: Response): void => {
    if (clock() < retryAt) return;
    try {
      current ??= open();
      current.observe(request, response);
    } catch {
      try { current?.close(); } catch { /* Never break a shopper response. */ }
      current = undefined;
      retryAt = clock() + 60_000;
    }
  };
}
const recordTraffic = createTrafficObserver(() => openTrafficLedger('/var/lib/backroadbum/traffic.db'));
/** Fail open for serving, not for reporting. Missing/stale storage is unavailable. */
export function observeStoreTraffic(request: Request, response: Response): void {
  if (process.env.BACKROADBUM_TRAFFIC_ENABLED !== '1' ||
      process.env.NODE_ENV !== 'production' || process.env.BACKROADBUM_HOSTED_REGISTRY !== '1') return;
  recordTraffic(request, response);
}
