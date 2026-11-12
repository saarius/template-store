"""One non-creating checkout probe; retain only status, timing and fixed categories."""
import json
import socket
import time
import urllib.error
import urllib.request
from checkout_metrics import checkout_metrics

MAX_BODY = 4096
PROBE_SCHEMA = 'backroadbum.checkout-probe/v1'


def probe_checkout(opener=urllib.request.urlopen, clock=time.monotonic):
    """No retries, response/exception text, credentials or provider requests."""
    start = clock()
    status = None
    body = None
    outcome = 'network-error'
    try:
        request = urllib.request.Request('https://backroadbum.com/api/checkout/health',
                                         headers={'User-Agent': 'BackroadBum-SelfCheck/1.0'})
        try:
            response = opener(request, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response as stream:
            status = stream.status
            raw = stream.read(MAX_BODY + 1)
            if len(raw) > MAX_BODY:
                outcome = 'body-too-large'
            else:
                try:
                    body = json.loads(raw)
                    outcome = 'contract-rejected'
                except (ValueError, UnicodeError):
                    outcome = 'invalid-json'
    except (TimeoutError, socket.timeout):
        outcome = 'timeout'
    except urllib.error.URLError as error:
        outcome = 'timeout' if isinstance(error.reason, (TimeoutError, socket.timeout)) else 'network-error'
    except Exception:
        outcome = 'read-error' if status is not None else 'probe-error'
    health = checkout_metrics(body, status)
    if health['state'] == 'ready-advisory':
        outcome = 'ready-advisory'
    elif health['state'] == 'closed':
        outcome = 'admission-closed'
    elif isinstance(body, dict) and set(body) == {'schema', 'admission', 'readiness', 'mode'} and (
        body['schema'] == 'backroadbum.checkout-health/v1' and body['admission'] == 'open' and
        body['readiness'] == 'unavailable' and body['mode'] is None and status == 503
    ):
        outcome = 'readiness-unavailable'
    diagnostic = {'schema': PROBE_SCHEMA, 'outcome': outcome,
                  'elapsedMs': max(0, round((clock() - start) * 1000)), 'http': status}
    return health, diagnostic


def failure_event(diagnostic, observed_at):
    """Called only for actual independent samples, never injected test failures."""
    if diagnostic['outcome'] in ('ready-advisory', 'admission-closed'):
        return None
    return {'event': 'checkout-probe-unavailable', 'observedAt': observed_at, **diagnostic}
