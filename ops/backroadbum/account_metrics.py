"""Classify one anonymous Orders read; never publish response bodies or credentials."""

def account_metrics(body, status, basic_auth=False):
    result = {'schema': 'backroadbum.account-boundary/v1', 'http': status, 'state': 'unavailable'}
    if status == 401 and basic_auth:
        result['state'] = 'blocked-by-admin-auth'
    elif status == 200 and not basic_auth and isinstance(body, dict):
        payload = body.get('data') if body.get('success') is True else body
        if (isinstance(payload, dict) and payload.get('ok') is False and
                isinstance(payload.get('error'), dict) and payload['error'].get('code') == 'SESSION_DENIED'):
            result['state'] = 'capability-required'
    return result
