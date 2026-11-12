"""Bounded readiness observations, not payment outcomes or continuous uptime."""
import datetime as dt
import json
import os
from pathlib import Path
import tempfile

SCHEMA = 'backroadbum.checkout-observations/v1'
STATES = ('ready-advisory', 'closed', 'unavailable')
LIMIT = 5


def timestamp(value):
    if not isinstance(value, str) or len(value) > 40:
        raise ValueError('Invalid observation time')
    parsed = dt.datetime.fromisoformat(value)
    if parsed.tzinfo is None or parsed.utcoffset() != dt.timedelta():
        raise ValueError('Observation time must be UTC')
    return parsed


def http_status(value):
    return value is None or type(value) is int and 100 <= value <= 599


def validate(state):
    """Reject malformed history rather than silently discarding it or exporting extras."""
    if not isinstance(state, dict) or set(state) != {
        'schema', 'since', 'lastObservedAt', 'currentState', 'active', 'recent', 'lastGap'
    } or state['schema'] != SCHEMA or state['currentState'] not in STATES:
        raise ValueError('Invalid observation history')
    since, last = timestamp(state['since']), timestamp(state['lastObservedAt'])
    if since > last or not isinstance(state['recent'], list) or len(state['recent']) > LIMIT:
        raise ValueError('Invalid observation range')
    if (state['active'] is not None) != (state['currentState'] == 'unavailable'):
        raise ValueError('Invalid active observation')
    previous_end = last
    for event, active in [(state['active'], True)] + [(e, False) for e in state['recent']]:
        if event is None and active:
            continue
        keys = {'firstObservedAt', 'lastObservedAt', 'unavailableSamples', 'lastHttp'}
        if not active:
            keys |= {'endedAt', 'endingState'}
        if not isinstance(event, dict) or set(event) != keys:
            raise ValueError('Invalid observation event')
        first, end = timestamp(event['firstObservedAt']), timestamp(event['lastObservedAt'])
        if not since <= first <= end <= last or type(event['unavailableSamples']) is not int or not 1 <= event['unavailableSamples'] <= 1_000_000_000 or not http_status(event['lastHttp']):
            raise ValueError('Invalid observation values')
        if active:
            if end != last:
                raise ValueError('Invalid active sample time')
        else:
            closed = timestamp(event['endedAt'])
            if not end <= closed <= previous_end or event['endingState'] not in ('ready-advisory', 'closed'):
                raise ValueError('Invalid ending observation')
            previous_end = closed
    gap = state['lastGap']
    if gap is not None:
        if not isinstance(gap, dict) or set(gap) != {'after', 'before'} or not since <= timestamp(gap['after']) < timestamp(gap['before']) <= last or (timestamp(gap['before']) - timestamp(gap['after'])).total_seconds() <= 180:
            raise ValueError('Invalid observation gap')
    return state


def advance(previous, checkout, now):
    """One independently collected sample; intentional closure is not a failure."""
    at = timestamp(now)
    if not isinstance(checkout, dict) or checkout.get('state') not in STATES or not http_status(checkout.get('healthHttp')):
        raise ValueError('Invalid readiness sample')
    state = json.loads(json.dumps(validate(previous))) if previous is not None else {
        'schema': SCHEMA, 'since': now, 'lastObservedAt': now,
        'currentState': checkout['state'], 'active': None, 'recent': [], 'lastGap': None
    }
    if previous is not None:
        before = timestamp(state['lastObservedAt'])
        if at < before:
            raise ValueError('Observation clock moved backwards')
        if at == before:
            return state
        if (at - before).total_seconds() > 180:
            state['lastGap'] = {'after': state['lastObservedAt'], 'before': now}
    event = state['active']
    if checkout['state'] == 'unavailable':
        if event is None:
            event = {'firstObservedAt': now, 'lastObservedAt': now,
                     'unavailableSamples': 0, 'lastHttp': None}
        event.update(lastObservedAt=now, unavailableSamples=event['unavailableSamples'] + 1,
                     lastHttp=checkout.get('healthHttp'))
        state['active'] = event
    elif event is not None:
        state['recent'] = [dict(event, endedAt=now, endingState=checkout['state']), *state['recent']][:LIMIT]
        state['active'] = None
    state.update(lastObservedAt=now, currentState=checkout['state'])
    return validate(state)


def record_checkout_history(path, checkout, now):
    """Private atomic file; corrupt/unreadable existing evidence is never reset."""
    path = Path(path)
    previous = None
    try:
        with path.open() as stream:
            raw = stream.read(65_537)
        if len(raw) > 65_536:
            raise ValueError('History exceeds bound')
        previous = json.loads(raw)
        # An existing JSON null is corruption, not a new monitoring epoch.
        validate(previous)
    except FileNotFoundError:
        pass
    state = advance(previous, checkout, now)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, prefix='.checkout-observations-', delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(state, stream, separators=(',', ':'))
            stream.flush()
            os.fsync(stream.fileno())
        temporary.replace(path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return state
