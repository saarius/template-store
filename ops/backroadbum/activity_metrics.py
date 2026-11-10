"""Aggregate allowlisted metadata from read-only Pi records; never return message text."""
import datetime as dt
import json
import math
import pathlib
import re

MAX_LINE = 8 * 1024 * 1024
TOKEN_FIELDS = ('input', 'output', 'cacheRead', 'cacheWrite', 'reasoning', 'totalTokens')
LEVELS = {'off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'}
PROVIDERS = {'openai', 'anthropic', 'google', 'google-gemini-cli', 'openai-codex'}


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and 0 <= value <= 2**53 and math.isfinite(value)


def timestamp(value):
    try:
        parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
        return parsed if parsed.tzinfo else None
    except (AttributeError, TypeError, ValueError):
        return None


def state_metadata(path):
    """Do not source controller shell state or copy unknown fields."""
    try:
        if path.is_symlink() or path.stat().st_size > 16384:
            return {}
        return dict(line.split('=', 1) for line in path.read_text().splitlines() if '=' in line)
    except (OSError, UnicodeError, ValueError):
        return {}


def activity_metrics(sessions=pathlib.Path('/var/lib/trialrun/sessions'), state=pathlib.Path('/var/lib/trialrun/state')):
    try:
        files = sorted(path for path in sessions.glob('*.jsonl') if path.is_file() and not path.is_symlink())
    except OSError:
        return None
    if not files:
        return None
    tokens = dict.fromkeys(TOKEN_FIELDS, 0)
    token_counts = dict.fromkeys(TOKEN_FIELDS, 0)
    costs = []
    durations = []
    windows = []
    latest = None
    sessions_seen = set()
    assistants = compactions = usage_records = prompts = finals = invalid = incomplete = oversized = unreadable = 0

    def finish_cycle(cycle):
        nonlocal finals
        if cycle and cycle[1] is not None:
            finals += 1
            if cycle[0] is not None and cycle[1] >= cycle[0]:
                windows.append((cycle[1] - cycle[0]).total_seconds())

    def usage(raw):
        nonlocal usage_records
        if not isinstance(raw, dict):
            return
        usage_records += 1
        for key in TOKEN_FIELDS:
            value = raw.get(key)
            if isinstance(value, int) and number(value):
                tokens[key] += value
                token_counts[key] += 1
        cost = raw.get('cost')
        if isinstance(cost, dict) and number(cost.get('total')):
            costs.append(cost['total'])

    for path in files:
        cycle = None
        record_ids = set()
        try:
            with path.open('rb') as source:
                first = True
                while line := source.readline(MAX_LINE + 1):
                    if len(line) > MAX_LINE:
                        oversized += 1
                        while line and not line.endswith(b'\n'):
                            line = source.readline(MAX_LINE + 1)
                        continue
                    if not line.endswith(b'\n'):
                        incomplete += 1  # The active writer may still be appending this record.
                        continue
                    try:
                        record = json.loads(line)
                        if not isinstance(record, dict):
                            raise ValueError('record')
                    except (ValueError, UnicodeError):
                        invalid += 1
                        continue
                    if first:
                        first = False
                        session_id = record.get('id')
                        if record.get('type') != 'session' or not isinstance(session_id, str):
                            invalid += 1
                            break
                        if session_id in sessions_seen:
                            break
                        sessions_seen.add(session_id)
                        continue
                    record_id = record.get('id')
                    if isinstance(record_id, str):
                        if record_id in record_ids:
                            continue
                        record_ids.add(record_id)
                    kind = record.get('type')
                    if kind == 'compaction':
                        compactions += 1
                        usage(record.get('usage'))
                        continue
                    message = record.get('message')
                    if kind != 'message' or not isinstance(message, dict):
                        continue
                    when = timestamp(record.get('timestamp'))
                    role = message.get('role')
                    if role == 'user':
                        finish_cycle(cycle)
                        cycle = None
                        content = message.get('content')
                        text = content if isinstance(content, str) else next((part.get('text', '') for part in content if isinstance(part, dict) and part.get('type') == 'text'), '') if isinstance(content, list) else ''
                        if isinstance(text, str) and text.startswith('Autonomous execution cycle active.'):
                            prompts += 1
                            cycle = [when, None]
                    elif role == 'assistant':
                        assistants += 1
                        usage(message.get('usage'))
                        duration = message.get('durationMs')
                        if number(duration):
                            durations.append(duration)
                        if cycle and message.get('stopReason') == 'stop':
                            cycle[1] = when
                        if when and (latest is None or when > latest[0]):
                            provider, model, level = message.get('provider'), message.get('model'), message.get('thinkingLevel')
                            safe_model = model if isinstance(model, str) and re.fullmatch(r'(?:gpt-[0-9][a-zA-Z0-9.-]{0,63}|claude-[a-z]+-[0-9][a-zA-Z0-9.-]{0,63}|gemini-[0-9][a-zA-Z0-9.-]{0,63})', model) else None
                            latest = (when, provider if isinstance(provider, str) and provider in PROVIDERS else None, safe_model, level if isinstance(level, str) and level in LEVELS else None)
            finish_cycle(cycle)
        except OSError:
            unreadable += 1
    if not sessions_seen:
        return None
    last = state_metadata(state / 'last_run.state')
    active = state_metadata(state / 'active_run.state')
    successful = last.get('total_successful_runs', '')
    completed_at = timestamp(last.get('completed_at'))
    expected_usage = assistants + compactions
    return {
        'schema': 'backroadbum.activity/v1',
        'sessions': len(sessions_seen), 'cyclePrompts': prompts, 'cyclesWithFinalResponse': finals,
        'averagePromptToFinalSeconds': round(sum(windows) / len(windows), 1) if windows else None,
        'compactions': compactions, 'assistantMessages': assistants, 'usageRecords': usage_records,
        'tokens': {key: tokens[key] if token_counts[key] else None for key in TOKEN_FIELDS},
        'usageComplete': expected_usage > 0 and usage_records == expected_usage and all(token_counts[key] == expected_usage for key in TOKEN_FIELDS if key != 'reasoning') and not (invalid or incomplete or oversized or unreadable),
        'apiEquivalentUSD': round(sum(costs), 6) if costs else None,
        'costRecords': len(costs), 'costComplete': expected_usage > 0 and len(costs) == expected_usage and not (invalid or incomplete or oversized or unreadable),
        'recordedModelSeconds': round(sum(durations) / 1000, 1) if durations else None,
        'latestModel': {'provider': latest[1], 'model': latest[2], 'reasoning': latest[3]} if latest else None,
        'controller': {
            'successfulRuns': int(successful) if re.fullmatch(r'\d{1,10}', successful) else None,
            'lastResult': last.get('result') if last.get('result') in {'success', 'failed', 'failure', 'timeout', 'interrupted', 'quota_exhausted'} else None,
            'lastCompletedAt': completed_at.isoformat() if completed_at else None,
            'running': active.get('phase') == 'running' if active else None,
        },
        'coverage': {'invalidRecords': invalid, 'incompleteRecords': incomplete, 'oversizedRecords': oversized, 'unreadableFiles': unreadable},
    }
