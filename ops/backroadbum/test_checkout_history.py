import copy
import datetime as dt
import json
from pathlib import Path
import tempfile
import unittest
from checkout_history import advance, record_checkout_history, validate

BASE = dt.datetime(2026, 11, 12, 9, tzinfo=dt.timezone.utc)
def at(minute):
    return (BASE + dt.timedelta(minutes=minute)).isoformat()
def sample(state='ready-advisory', http=200):
    return {'state': state, 'healthHttp': http}


class CheckoutHistoryTests(unittest.TestCase):
    def test_new_monitor_does_not_backfill_historical_success(self):
        s = advance(None, sample(), at(0))
        self.assertEqual(s['since'], at(0))
        self.assertEqual(s['recent'], [])
        self.assertIsNone(s['active'])

    def test_unavailability_groups_and_recovers_only_on_ready(self):
        s = advance(None, sample('unavailable', 503), at(0))
        previous = copy.deepcopy(s)
        s = advance(s, sample('unavailable', None), at(1))
        self.assertEqual(previous['active']['unavailableSamples'], 1)
        self.assertEqual(s['active']['unavailableSamples'], 2)
        self.assertIsNone(s['active']['lastHttp'])
        s = advance(s, sample(), at(2))
        self.assertIsNone(s['active'])
        self.assertEqual(s['recent'][0], {
            'firstObservedAt': at(0), 'lastObservedAt': at(1),
            'unavailableSamples': 2, 'lastHttp': None,
            'endedAt': at(2), 'endingState': 'ready-advisory'
        })

    def test_intentional_closure_does_not_start_an_incident(self):
        s = advance(None, sample('closed', 503), at(0))
        self.assertIsNone(s['active'])
        self.assertEqual(s['recent'], [])
        s = advance(s, sample(), at(1))
        self.assertEqual(s['recent'], [])

    def test_closing_admission_is_not_recorded_as_recovery(self):
        s = advance(None, sample('unavailable', 503), at(0))
        s = advance(s, sample('closed', 503), at(1))
        self.assertEqual(s['recent'][0]['endingState'], 'closed')

    def test_gap_is_explicit_and_not_an_invented_duration(self):
        s = advance(None, sample('unavailable', 503), at(0))
        s = advance(s, sample(), at(10))
        self.assertEqual(s['lastGap'], {'after': at(0), 'before': at(10)})
        self.assertEqual(s['recent'][0]['unavailableSamples'], 1)
        self.assertNotIn('duration', s['recent'][0])

    def test_five_recent_windows_bounded_newest_first(self):
        s = None
        for i in range(8):
            s = advance(s, sample('unavailable', 503), at(i * 2))
            s = advance(s, sample(), at(i * 2 + 1))
        self.assertEqual(len(s['recent']), 5)
        self.assertEqual([e['endedAt'] for e in s['recent']], [at(n) for n in [15, 13, 11, 9, 7]])
        self.assertEqual(s['since'], at(0))

    def test_duplicate_observation_does_not_double_count(self):
        s = advance(None, sample('unavailable', 503), at(0))
        self.assertEqual(advance(s, sample('unavailable', 503), at(0)), s)
        with self.assertRaises(ValueError):
            advance(s, sample(), at(-1))

    def test_extra_incoming_fields_are_never_persisted(self):
        s = advance(None, dict(sample(), private='do-not-project'), at(0))
        self.assertNotIn('private', json.dumps(s))

    def test_invalid_time_http_or_state_rejected(self):
        for bad in [sample('paid'), sample(http=True), sample(http=600), sample(http='200')]:
            with self.assertRaises(ValueError):
                advance(None, bad, at(0))
        for bad in ['not-a-time', '2026-11-12T09:00:00', '2026-11-12T09:00:00+02:00']:
            with self.assertRaises(ValueError):
                advance(None, sample(), bad)

    def test_atomic_private_persistence_survives_a_fresh_read(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'observations.json'
            record_checkout_history(path, sample('unavailable', 503), at(0))
            result = record_checkout_history(path, sample(), at(1))
            self.assertEqual(json.loads(path.read_text()), result)
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(result['recent'][0]['endingState'], 'ready-advisory')
            self.assertEqual(sorted(p.name for p in Path(directory).iterdir()), ['observations.json'])

    def test_corrupt_evidence_is_preserved_not_reset(self):
        for text in ['not-json', 'null', '{}', 'x' * 65_537]:
            with self.subTest(text=text[:20]), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / 'observations.json'
                path.write_text(text)
                with self.assertRaises(ValueError):
                    record_checkout_history(path, sample(), at(1))
                self.assertEqual(path.read_text(), text)

    def test_malformed_or_private_history_is_rejected(self):
        s = advance(None, sample('unavailable', 503), at(0))
        s = advance(s, sample(), at(1))
        for mutate in [lambda x: x.update(secret='do-not-project'),
                       lambda x: x['recent'][0].update(private='do-not-project'),
                       lambda x: x['recent'][0].update(endingState='paid'),
                       lambda x: x['recent'][0].update(unavailableSamples=True),
                       lambda x: x.update(currentState='unavailable'),
                       lambda x: x.update(since=at(3))]:
            bad = copy.deepcopy(s)
            mutate(bad)
            with self.assertRaises(ValueError):
                validate(bad)


if __name__ == '__main__':
    unittest.main()
