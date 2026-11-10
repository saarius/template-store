import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch
from activity_metrics import activity_metrics

PROMPT = 'Autonomous execution cycle active.'
SECRET = 'sk_test_DO_NOT_PUBLISH_OR_EXECUTE'


def header(id='session-one'):
    return {'type': 'session', 'id': id, 'timestamp': '2026-11-10T20:00:00Z', 'cwd': '/private/' + SECRET}


def message(id, role='assistant', seconds=10, **extra):
    return {'type': 'message', 'id': id, 'timestamp': f'2026-11-10T20:00:{seconds:02d}Z', 'message': {
        'role': role, 'content': [{'type': 'text', 'text': SECRET}], **extra}}


def usage(**extra):
    return {'input': 10, 'output': 5, 'cacheRead': 100, 'cacheWrite': 0,
            'reasoning': 3, 'totalTokens': 115, 'cost': {'total': .012, 'totalFromProvider': False}, **extra}


class ActivityMetricsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = pathlib.Path(self.tmp.name)
        self.sessions = self.root / 'sessions'
        self.state = self.root / 'state'
        self.sessions.mkdir()
        self.state.mkdir()

    def write(self, records, name='trialrun-one.jsonl'):
        path = self.sessions / name
        path.write_text(''.join(json.dumps(record) + '\n' for record in records))
        return path

    def collect(self):
        return activity_metrics(self.sessions, self.state)

    def test_missing_empty_or_unrecognized_sources_are_unavailable(self):
        self.assertIsNone(self.collect())
        self.write([{'type': 'message', 'message': {'role': 'assistant', 'usage': usage()}}])
        self.assertIsNone(self.collect())
        self.assertIsNone(activity_metrics(self.root / 'missing', self.state))

    def test_aggregates_assistant_and_compaction_usage_without_adding_reasoning_twice(self):
        self.write([header(), message('u', role='user', seconds=0, content=PROMPT),
                    message('a', usage=usage(), durationMs=1500, stopReason='stop', provider='openai', model='gpt-6.1-sol', thinkingLevel='high'),
                    {'type': 'compaction', 'id': 'c', 'summary': SECRET, 'usage': usage()}])
        result = self.collect()
        self.assertEqual(result['sessions'], 1)
        self.assertEqual(result['cyclePrompts'], 1)
        self.assertEqual(result['cyclesWithFinalResponse'], 1)
        self.assertEqual(result['averagePromptToFinalSeconds'], 10)
        self.assertEqual(result['compactions'], 1)
        self.assertEqual(result['tokens']['totalTokens'], 230)
        self.assertEqual(result['tokens']['reasoning'], 6)
        self.assertEqual(result['apiEquivalentUSD'], .024)
        self.assertEqual(result['recordedModelSeconds'], 1.5)
        self.assertEqual(result['latestModel'], {'provider': 'openai', 'model': 'gpt-6.1-sol', 'reasoning': 'high'})
        self.assertTrue(result['usageComplete'])
        self.assertTrue(result['costComplete'])
        self.assertNotIn(SECRET, json.dumps(result))
        self.assertNotIn('/private/', json.dumps(result))

    def test_absent_cost_and_usage_are_not_zero(self):
        self.write([header(), message('a')])
        result = self.collect()
        self.assertIsNone(result['tokens']['totalTokens'])
        self.assertIsNone(result['apiEquivalentUSD'])
        self.assertFalse(result['usageComplete'])
        self.assertFalse(result['costComplete'])
        self.assertIsNone(result['controller']['successfulRuns'])

    def test_recorded_zero_is_valid_and_missing_reasoning_does_not_erase_other_usage(self):
        zero = {key: 0 for key in ['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens']}
        zero['cost'] = {'total': 0}
        self.write([header(), message('a', usage=zero)])
        result = self.collect()
        self.assertEqual(result['tokens']['totalTokens'], 0)
        self.assertIsNone(result['tokens']['reasoning'])
        self.assertEqual(result['apiEquivalentUSD'], 0)
        self.assertTrue(result['usageComplete'])

    def test_partial_corrupt_and_oversized_records_do_not_publish_text_or_claim_completeness(self):
        path = self.write([header(), message('a', usage=usage())])
        with path.open('ab') as stream:
            stream.write(b'not-json\n' + b'x' * 600 + b'\n' + b'{"unfinished":')
        with patch('activity_metrics.MAX_LINE', 512):
            result = self.collect()
        self.assertFalse(result['usageComplete'])
        self.assertFalse(result['costComplete'])
        self.assertEqual(result['coverage'], {'invalidRecords': 1, 'incompleteRecords': 1, 'oversizedRecords': 1, 'unreadableFiles': 0})
        self.assertEqual(result['tokens']['totalTokens'], 115)

    def test_duplicate_sessions_and_record_ids_do_not_double_count(self):
        records = [header(), message('a', usage=usage()), message('a', usage=usage())]
        self.write(records)
        self.write(records, 'copy.jsonl')
        result = self.collect()
        self.assertEqual(result['sessions'], 1)
        self.assertEqual(result['assistantMessages'], 1)
        self.assertEqual(result['tokens']['totalTokens'], 115)

    def test_symlinks_are_not_followed(self):
        path = self.root / 'outside.jsonl'
        path.write_text(json.dumps(header()) + '\n')
        (self.sessions / 'link.jsonl').symlink_to(path)
        self.assertIsNone(self.collect())

    def test_controller_values_are_allowlisted_and_never_executed(self):
        self.write([header()])
        self.state.joinpath('last_run.state').write_text('total_successful_runs=32\nresult=success\ncompleted_at=2026-11-10T22:00:11Z\nsecret=' + SECRET)
        self.state.joinpath('active_run.state').write_text('phase=running\npid=' + SECRET)
        result = self.collect()
        self.assertEqual(result['controller']['successfulRuns'], 32)
        self.assertEqual(result['controller']['lastResult'], 'success')
        self.assertTrue(result['controller']['running'])
        self.assertNotIn(SECRET, json.dumps(result))
        self.state.joinpath('last_run.state').write_text('total_successful_runs=$(touch ' + str(self.root / 'bad') + ')\nresult=' + SECRET)
        result = self.collect()
        self.assertIsNone(result['controller']['successfulRuns'])
        self.assertIsNone(result['controller']['lastResult'])
        self.assertFalse((self.root / 'bad').exists())

    def test_malformed_metadata_is_omitted(self):
        self.write([header(), message('a', usage=usage(input=True, totalTokens=-1, cost={'total': float('inf')}),
                                     provider={}, model='gpt-' + SECRET, thinkingLevel=[])])
        result = self.collect()
        self.assertIsNone(result['tokens']['input'])
        self.assertIsNone(result['tokens']['totalTokens'])
        self.assertIsNone(result['apiEquivalentUSD'])
        self.assertIsNone(result['latestModel']['model'])
        self.assertNotIn(SECRET, json.dumps(result))

    def test_open_or_noncycle_messages_are_not_failed_cycles(self):
        self.write([header(), message('u', role='user', content=[{'type': 'text', 'text': PROMPT}]),
                    message('a', stopReason='error'),
                    message('followup', role='user', content='An unrelated follow-up'),
                    message('final', stopReason='stop')])
        result = self.collect()
        self.assertEqual(result['cyclePrompts'], 1)
        self.assertEqual(result['cyclesWithFinalResponse'], 0)
        self.assertIsNone(result['averagePromptToFinalSeconds'])


if __name__ == '__main__':
    unittest.main()
