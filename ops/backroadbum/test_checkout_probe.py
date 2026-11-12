import io
import json
import unittest
import urllib.error
from checkout_probe import MAX_BODY, failure_event, probe_checkout

SECRET = 'never-export-this-private-body-or-exception'


class Response(io.BytesIO):
    def __init__(self, body, status=200):
        super().__init__(body)
        self.status = status
        self.read_sizes = []

    def read(self, size=-1):
        self.read_sizes.append(size)
        return super().read(size)


class ProbeTests(unittest.TestCase):
    def sample(self, response=None, error=None):
        ticks = iter([10, 10.125])
        calls = []

        def opener(request, **options):
            calls.append((request, options))
            if error is not None:
                raise error
            return response

        health, diagnostic = probe_checkout(opener, lambda: next(ticks))
        self.assertEqual(len(calls), 1)
        request, options = calls[0]
        self.assertEqual(request.full_url, 'https://backroadbum.com/api/checkout/health')
        self.assertEqual(request.get_method(), 'GET')
        self.assertEqual(options, {'timeout': 10})
        self.assertIsNone(request.data)
        self.assertEqual(diagnostic['elapsedMs'], 125)
        self.assertNotIn(SECRET, json.dumps((health, diagnostic)))
        return health, diagnostic

    def body(self, admission='open', readiness='supported', mode='test'):
        return json.dumps({'schema': 'backroadbum.checkout-health/v1', 'admission': admission,
                           'readiness': readiness, 'mode': mode}).encode()

    def test_ready(self):
        health, diagnostic = self.sample(Response(self.body()))
        self.assertEqual(health['state'], 'ready-advisory')
        self.assertEqual(diagnostic['outcome'], 'ready-advisory')
        self.assertIsNone(failure_event(diagnostic, '2026-11-12T12:00:00+00:00'))

    def test_closed_is_not_failure(self):
        health, diagnostic = self.sample(Response(self.body('closed', 'unavailable', None), 503))
        self.assertEqual(health['state'], 'closed')
        self.assertEqual(diagnostic['outcome'], 'admission-closed')
        self.assertIsNone(failure_event(diagnostic, '2026-11-12T12:00:00+00:00'))

    def test_exact_unavailable_http_error(self):
        error = urllib.error.HTTPError('https://private.invalid/' + SECRET, 503, SECRET, {},
                                       io.BytesIO(self.body(readiness='unavailable', mode=None)))
        health, diagnostic = self.sample(error=error)
        self.assertEqual(health['healthHttp'], 503)
        self.assertEqual(diagnostic['outcome'], 'readiness-unavailable')
        event = failure_event(diagnostic, '2026-11-12T12:00:00+00:00')
        self.assertEqual(set(event), {'event', 'observedAt', 'schema', 'outcome', 'elapsedMs', 'http'})
        self.assertNotIn(SECRET, json.dumps(event))

    def test_timeout_direct_and_wrapped(self):
        for error in [TimeoutError(SECRET), urllib.error.URLError(TimeoutError(SECRET))]:
            with self.subTest(error=type(error)):
                health, diagnostic = self.sample(error=error)
                self.assertIsNone(health['healthHttp'])
                self.assertEqual(diagnostic['outcome'], 'timeout')

    def test_network_failure(self):
        _, diagnostic = self.sample(error=urllib.error.URLError(SECRET))
        self.assertEqual(diagnostic['outcome'], 'network-error')

    def test_invalid_json_preserves_http(self):
        for raw in [SECRET.encode(), b'\xff']:
            health, diagnostic = self.sample(Response(raw, 502))
            self.assertEqual(health['healthHttp'], 502)
            self.assertEqual(diagnostic['outcome'], 'invalid-json')

    def test_bounded_read(self):
        response = Response(b'x' * (MAX_BODY + 100), 503)
        health, diagnostic = self.sample(response)
        self.assertEqual(response.read_sizes, [MAX_BODY + 1])
        self.assertEqual(health['healthHttp'], 503)
        self.assertEqual(diagnostic['outcome'], 'body-too-large')

    def test_contract_refusals(self):
        bodies = [self.body(mode='live'), b'null', b'[]', b'{}',
                  self.body().replace(b'"mode": "test"', b'"extra": "' + SECRET.encode() + b'", "mode": "test"')]
        for raw in bodies:
            health, diagnostic = self.sample(Response(raw))
            self.assertEqual(health['state'], 'unavailable')
            self.assertEqual(diagnostic['outcome'], 'contract-rejected')

    def test_unexpected_error_does_not_export_text(self):
        _, diagnostic = self.sample(error=RuntimeError(SECRET))
        self.assertEqual(diagnostic['outcome'], 'probe-error')

    def test_read_error_keeps_status(self):
        class BrokenResponse(Response):
            def read(self, _size=-1):
                raise ConnectionResetError(SECRET)
        health, diagnostic = self.sample(BrokenResponse(b'', 200))
        self.assertEqual(health['healthHttp'], 200)
        self.assertEqual(diagnostic['outcome'], 'read-error')


if __name__ == '__main__':
    unittest.main()
