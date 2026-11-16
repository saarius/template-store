import datetime as dt
import json
import pathlib
import sqlite3
import tempfile
import unittest
from traffic_metrics import traffic_metrics

NOW = dt.datetime(2026, 11, 16, 12, tzinfo=dt.timezone.utc)


class TrafficMetricsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = pathlib.Path(self.tmp.name) / 'traffic.db'
        self.db = sqlite3.connect(self.path)
        self.db.executescript('CREATE TABLE traffic_meta(id INTEGER PRIMARY KEY,schema TEXT,since TEXT,heartbeat TEXT); CREATE TABLE traffic_days(day TEXT PRIMARY KEY,responses INTEGER);')
        self.db.execute('INSERT INTO traffic_meta VALUES(1,?,?,?)', ('backroadbum.traffic/v1', '2026-08-01T00:00:00.000Z', NOW.isoformat()))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def test_real_initialized_zero_and_no_private_output(self):
        result = traffic_metrics(self.path, NOW)
        self.assertEqual((result['today'], result['last7Days'], result['last30Days']), (0, 0, 0))
        self.assertEqual(set(result), {'schema', 'since', 'through', 'retentionDays', 'today', 'last7Days', 'last30Days'})
        self.assertNotIn(str(self.path), json.dumps(result))

    def test_utc_windows(self):
        for days, count in [(0, 2), (1, 3), (6, 5), (7, 7), (29, 11), (30, 13), (89, 17)]:
            self.db.execute('INSERT INTO traffic_days VALUES(?,?)', ((NOW.date() - dt.timedelta(days=days)).isoformat(), count))
        self.db.commit()
        result = traffic_metrics(self.path, NOW)
        self.assertEqual((result['today'], result['last7Days'], result['last30Days']), (2, 10, 28))

    def test_missing_corrupt_unknown_stale_or_future_is_not_zero(self):
        missing = self.path.parent / 'missing.db'
        self.assertIsNone(traffic_metrics(missing, NOW)); self.assertFalse(missing.exists())
        corrupt = self.path.parent / 'corrupt.db'; corrupt.write_text('not sqlite')
        self.assertIsNone(traffic_metrics(corrupt, NOW)); self.assertEqual(corrupt.read_text(), 'not sqlite')
        for schema, heartbeat in [('future', NOW.isoformat()), ('backroadbum.traffic/v1', 'broken'),
                                  ('backroadbum.traffic/v1', (NOW - dt.timedelta(seconds=181)).isoformat()),
                                  ('backroadbum.traffic/v1', (NOW + dt.timedelta(seconds=1)).isoformat())]:
            self.db.execute('UPDATE traffic_meta SET schema=?,heartbeat=?', (schema, heartbeat)); self.db.commit()
            self.assertIsNone(traffic_metrics(self.path, NOW))

    def test_invalid_days_counts_and_overflow_are_unavailable(self):
        for day, count in [('2026-11-17', 1), ('2026-08-01', 1), ('2026-11-16', -1), ('2026-11-16', 0),
                           ('2026-11-16', 1.5), ('private-synthetic', 1), ('2026-11-16', 9007199254740992)]:
            self.db.execute('DELETE FROM traffic_days')
            self.db.execute('INSERT INTO traffic_days VALUES(?,?)', (day, count)); self.db.commit()
            self.assertIsNone(traffic_metrics(self.path, NOW))
        self.db.execute('DELETE FROM traffic_days')
        self.db.executemany('INSERT INTO traffic_days VALUES(?,?)', [('2026-11-16', 9007199254740991), ('2026-11-15', 1)])
        self.db.commit(); self.assertIsNone(traffic_metrics(self.path, NOW))

    def test_collection_is_read_only(self):
        before = self.path.read_bytes()
        traffic_metrics(self.path, NOW)
        self.assertEqual(self.path.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
