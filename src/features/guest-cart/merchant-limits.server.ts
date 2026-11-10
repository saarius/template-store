// Merchant-host operational state only: never carts, payment authority or order records.
import { DatabaseSync } from 'node:sqlite';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { closeSync, openSync, readFileSync } from 'node:fs';

export const WINDOW_SECONDS = 600;
export const REQUEST_LIMITS = {
  prepare: { visitor: 8, global: 80 },
  start: { visitor: 3, global: 20 },
  status: { visitor: 120, global: 1200 },
} as const;
export type LimitedAction = keyof typeof REQUEST_LIMITS;

export function openMerchantLimits(path: string, secret: Uint8Array) {
  if (secret.length !== 32) throw Error('admission_key_unavailable');
  const fd = openSync(path, 'a', 0o600); closeSync(fd);
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA busy_timeout=250; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS request_windows (
      window INTEGER NOT NULL, action TEXT NOT NULL, visitor TEXT NOT NULL, count INTEGER NOT NULL,
      PRIMARY KEY(window,action,visitor)
    ) WITHOUT ROWID;`);
  const count = db.prepare('SELECT count FROM request_windows WHERE window=? AND action=? AND visitor=?');
  const increment = db.prepare(`INSERT INTO request_windows VALUES(?,?,?,1)
    ON CONFLICT(window,action,visitor) DO UPDATE SET count=count+1`);
  const purge = db.prepare('DELETE FROM request_windows WHERE window < ?');
  return {
    close: () => db.close(),
    take(action: LimitedAction, ip: string, now = Math.floor(Date.now() / 1000)) {
      if (!isIP(ip) || !Number.isSafeInteger(now) || now < 0) throw Error('admission_context_unavailable');
      const window = Math.floor(now / WINDOW_SECONDS) * WINDOW_SECONDS;
      // Caddy supplies a canonical peer address, not caller-controlled forwarding headers.
      // Rotate the HMAC per window and purge old rows: no raw IP or cross-window visitor identity is kept.
      const visitor = createHmac('sha256', secret).update(`${window}:${ip}`).digest('hex');
      const retryAfter = window + WINDOW_SECONDS - now;
      const limits = REQUEST_LIMITS[action];
      db.exec('BEGIN IMMEDIATE');
      try {
        const latest = db.prepare('SELECT MAX(window) AS latest FROM request_windows').get()?.latest;
        if (typeof latest === 'number' && latest > window) throw Error('admission_clock_unavailable');
        purge.run(window);
        const used = (key: string) => Number(count.get(window, action, key)?.count ?? 0);
        if (used('*') >= limits.global || used(visitor) >= limits.visitor) {
          db.exec('COMMIT');
          return { allowed: false, retryAfter };
        }
        increment.run(window, action, '*'); increment.run(window, action, visitor);
        db.exec('COMMIT');
        return { allowed: true, retryAfter };
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}
let current: ReturnType<typeof openMerchantLimits> | undefined;
export function merchantLimits() {
  return current ??= openMerchantLimits('/var/lib/backroadbum/admission.db', readFileSync('/etc/backroadbum/admission.key'));
}
