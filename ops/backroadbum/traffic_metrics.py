"""Read daily aggregates only. Never open content.db or publish request data."""
import datetime
import pathlib
import sqlite3

SCHEMA = 'backroadbum.traffic/v1'
MAX_SAFE = 9007199254740991


def traffic_metrics(path=pathlib.Path('/var/lib/backroadbum/traffic.db'), now=None):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    db = None
    try:
        if now.tzinfo is None:
            return None
        db = sqlite3.connect(pathlib.Path(path).resolve().as_uri() + '?mode=ro', uri=True, timeout=.1)
        db.execute('PRAGMA query_only=ON')
        db.execute('BEGIN')
        rows = db.execute('SELECT schema,since,heartbeat FROM traffic_meta').fetchall()
        if len(rows) != 1 or rows[0][0] != SCHEMA:
            return None
        _, since_raw, through_raw = rows[0]
        since = datetime.datetime.fromisoformat(since_raw.replace('Z', '+00:00'))
        through = datetime.datetime.fromisoformat(through_raw.replace('Z', '+00:00'))
        if since.tzinfo is None or through.tzinfo is None or not since <= through <= now:
            return None
        if (now - through).total_seconds() > 180:
            return None
        today = now.astimezone(datetime.timezone.utc).date()
        totals = {1: 0, 7: 0, 30: 0}
        days = db.execute('SELECT day,responses FROM traffic_days').fetchall()
        if len(days) > 90:
            return None
        for raw_day, count in days:
            day = datetime.date.fromisoformat(raw_day)
            age = (today - day).days
            if raw_day != day.isoformat() or not 0 <= age < 90 or day < since.date():
                return None
            if type(count) is not int or not 0 < count <= MAX_SAFE:
                return None
            for window in totals:
                if age < window:
                    totals[window] += count
                    if totals[window] > MAX_SAFE:
                        return None
        return {'schema': SCHEMA, 'since': since_raw, 'through': through_raw,
                'retentionDays': 90, 'today': totals[1], 'last7Days': totals[7], 'last30Days': totals[30]}
    except Exception:
        # Missing, stale, corrupt or unwritable is unavailable, never fabricated zero.
        return None
    finally:
        if db is not None:
            db.close()
