"""Exact public checkout advisory; HTTP 200 alone is not test-mode readiness or paid proof."""
SCHEMA = 'backroadbum.checkout-health/v1'
def checkout_metrics(body, status):
    result = {'state': 'unavailable', 'healthHttp': status, 'admission': None, 'mode': None}
    if not isinstance(body, dict) or set(body) != {'schema', 'admission', 'readiness', 'mode'} or body['schema'] != SCHEMA:
        return result
    if body['admission'] not in ('open', 'closed') or body['readiness'] not in ('supported', 'unavailable'):
        return result
    result['admission'] = body['admission']
    if status == 200 and body['admission'] == 'open' and body['readiness'] == 'supported' and body['mode'] == 'test':
        result.update(state='ready-advisory', mode='test')
    elif status == 503 and body['admission'] == 'closed' and body['readiness'] == 'unavailable' and body['mode'] is None:
        result['state'] = 'closed'
    return result
