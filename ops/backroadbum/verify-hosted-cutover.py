#!/usr/bin/env python3
"""Read-only boundaries for the hosted store; --checkout-open requires TEST readiness."""
import argparse
import datetime
import hashlib
import json
import pathlib
import socket
import sqlite3
import subprocess
import urllib.error
import urllib.request

ORIGIN = 'https://backroadbum.com'
PLUGINS = {
    'r_gshdrqaldna3r7sn': '0.8.0',
    'r_3brsc2on3bu673rn': '0.5.0',
    'r_ehdlg5cxkb3ffqvr': '0.3.1',
}
# These public routes authorize in Commerce, not with the merchant's Basic Auth.
# Empty bodies deliberately cannot send mail or create a shopper session.
ACCOUNT_PROBES = [
    ('account/sign-in/start', 'POST', 'INVALID_INPUT'),
    ('account/sign-in/verify', 'POST', 'INVALID_INPUT'),
    ('account/sign-out', 'POST', 'SESSION_DENIED'),
    ('account/orders', 'GET', 'SESSION_DENIED'),
    # Commerce 0.8.0's GET declaration is fixed upstream (#257), not yet released here.
    ('account/profile', 'GET', 'INVALID_PLUGIN_REQUEST'),
    ('account/profile', 'POST', 'SESSION_DENIED'),
]
RETIRED = [
    '/.well-known/jwks.json', '/api/store-passes', '/api/commerce-settings',
    '/api/commerce-ship', '/v1/checkout-binding', '/v1/existing-binding',
    '/v1/checkout/session', '/v1/checkout/lookup', '/v1/checkout/wakes',
    '/v1/checkout/wakes/ack', '/v1/webhooks/stripe', '/api/ship',
    '/api/ship/v1/admin/status', '/api/ship/v1/admin/orders',
    '/api/ship/v1/admin/practice-order', '/api/ship/v1/admin/practice-settings',
    '/api/ship/v1/admin/practice-label', '/api/ship/print/not-a-capability',
    '/api/ship/v1/orders', '/api/ship/not-a-route',
]


def require(condition, code):
    if not condition:
        raise RuntimeError(code)


def request(path, method='GET', *, empty_json=False, read_json=False):
    req = urllib.request.Request(ORIGIN + path, method=method,
                                 data=b'{}' if empty_json else None,
                                 headers={'User-Agent': 'BackroadBum-SelfCheck/1.0',
                                          'Origin': ORIGIN, 'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        body = json.load(response) if read_json or path == '/api/checkout/health' else None
        return response.status, bool(response.headers.get('WWW-Authenticate')), body


def data_digests(db):
    result = {}
    for name in ['orders', 'order_numbers', 'catalog_items', 'ec_products', 'ec_categories', 'ec_pages']:
        rows = list(db.execute(f'SELECT * FROM {name} ORDER BY id')) if name.startswith('ec_') else list(db.execute(
            'SELECT * FROM _plugin_storage WHERE collection=? ORDER BY plugin_id,id', (name,)))
        result[name] = {'count': len(rows), 'sha256': hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()}
    return result


def verify_checkout_health(code, health, checkout_open=False):
    require(isinstance(health, dict) and health.get('schema') == 'backroadbum.checkout-health/v1', 'checkout_gate_changed')
    expected = (200, 'open', 'supported', 'test') if checkout_open else (503, 'closed', 'unavailable', None)
    require((code, health.get('admission'), health.get('readiness'), health.get('mode')) == expected, 'checkout_gate_changed')


def verify(before=None, checkout_open=False):
    result = {'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'legacyServices': {}}
    for service, port in [('backroadbum-payments', 8787), ('backroadbum-ship', 8788)]:
        active = subprocess.run(['systemctl', 'is-active', service], capture_output=True, text=True).stdout.strip()
        enabled = subprocess.run(['systemctl', 'is-enabled', service], capture_output=True, text=True).stdout.strip()
        require(active == 'inactive' and enabled == 'disabled', 'legacy_service_not_retired')
        with socket.socket() as connection:
            connection.settimeout(1)
            require(connection.connect_ex(('127.0.0.1', port)) != 0, 'legacy_listener_open')
        result['legacyServices'][service] = {'active': active, 'enabled': enabled, 'listenerClosed': True}
    # Only probe former POST routes after verifying no legacy listener is running.
    result['retiredRoutes'] = {}
    for path in RETIRED:
        for method in ['GET', 'POST', 'OPTIONS']:
            code, challenge, _ = request(path, method)
            require(code == 404 and not challenge, 'retired_route_not_closed')
        result['retiredRoutes'][path] = {'GET': 404, 'POST': 404, 'OPTIONS': 404}
    result['http'] = {}
    for path, expected in [('/', 200), ('/shop', 200), ('/dashboard/', 200), ('/_emdash/admin', 401)]:
        code, _, _ = request(path)
        require(code == expected, 'store_boundary_changed')
        result['http'][path] = code
    for plugin in PLUGINS:
        code, challenge, _ = request(f'/_emdash/api/plugins/{plugin}/store-proof')
        require(code == 400 and not challenge, 'public_store_proof_blocked')
    result['publicProofsAnonymous'] = True
    result['publicAccounts'] = []
    prefix = '/_emdash/api/plugins/r_gshdrqaldna3r7sn/'
    for route, method, expected in ACCOUNT_PROBES:
        code, challenge, body = request(prefix + route, method, empty_json=method == 'POST', read_json=True)
        payload = body.get('data', body) if body.get('success') is True else body
        require(not challenge and code in (200, 400) and payload.get('ok') is not True and
                payload.get('error', {}).get('code') == expected, 'public_account_boundary_changed')
        result['publicAccounts'].append({'route': route, 'method': method, 'http': code, 'code': expected})
    for route in ['orders', 'admin', 'account/not-a-route']:
        code, challenge, _ = request(prefix + route, 'POST', empty_json=True)
        require(code == 401 and challenge, 'private_commerce_route_exposed')
    result['privateCommerceProtected'] = True
    code, _, health = request('/api/checkout/health')
    verify_checkout_health(code, health, checkout_open)
    result['checkout'] = health
    with sqlite3.connect('file:/var/lib/backroadbum/content.db?mode=ro', uri=True) as db:
        for plugin, version in PLUGINS.items():
            row = db.execute('SELECT version, status, source FROM _plugin_state WHERE plugin_id=?', (plugin,)).fetchone()
            require(row == (version, 'active', 'registry'), 'signed_installation_changed')
        result['collections'] = data_digests(db)
    result['registryVersions'] = PLUGINS
    if before:
        require(result['collections'] == json.loads(pathlib.Path(before).read_text())['collections'], 'canonical_data_changed')
        result['canonicalDataUnchanged'] = True
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--before-state', type=pathlib.Path)
    parser.add_argument('--checkout-open', action='store_true', help='Require open TEST checkout, never live mode.')
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.before_state, args.checkout_open), indent=2))
    except Exception:
        raise SystemExit('Hosted cutover verification failed; no private response or configuration emitted.') from None
