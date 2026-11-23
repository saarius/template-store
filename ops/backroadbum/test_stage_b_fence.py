#!/usr/bin/env python3
"""Exercise the optional fence on an isolated Caddy listener, not the live store."""
import base64
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import shutil
import socket
import subprocess
from tempfile import TemporaryDirectory
from threading import Thread
import time
import unittest

HERE = Path(__file__).resolve().parent
CADDY = shutil.which('caddy')
FIXTURE_LOGIN = 'operator:synthetic-fence-test'


class Upstream(BaseHTTPRequestHandler):
    def send_fixture(self):
        self.server.calls.append((self.command, self.path))
        self.send_response(204)
        self.end_headers()

    do_GET = do_HEAD = do_POST = do_PATCH = do_OPTIONS = send_fixture

    def log_message(self, *_args):
        pass


@unittest.skipUnless(CADDY, 'Caddy is required for the edge integration check')
class StageBFence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        temp = TemporaryDirectory(prefix='stage-b-fence-')
        cls.addClassCleanup(temp.cleanup)
        work = Path(temp.name)
        cls.env = dict(os.environ, XDG_CONFIG_HOME=str(work / 'config'), XDG_DATA_HOME=str(work / 'data'))
        upstream = ThreadingHTTPServer(('127.0.0.1', 0), Upstream)
        upstream.calls = []
        cls.calls = upstream.calls
        cls.addClassCleanup(upstream.server_close)
        Thread(target=upstream.serve_forever, daemon=True).start()
        cls.addClassCleanup(upstream.shutdown)
        with socket.socket() as s:
            s.bind(('127.0.0.1', 0))
            cls.port = s.getsockname()[1]
        digest = subprocess.check_output([CADDY, 'hash-password', '--plaintext',
                                          FIXTURE_LOGIN.split(':', 1)[1]], text=True).strip()
        cls.admin = 'unix/' + str(work / 'admin.sock')
        cls.fenced = work / 'Caddyfile'
        cls.normal = work / 'Caddyfile.normal'
        fence_import = f'  import {HERE / "stage-b-fence.caddy"}\n'
        text = f'''{{
 admin {cls.admin}
 auto_https off
}}
http://:{cls.port} {{
 bind 127.0.0.1
 @private {{
  path /_emdash* /connect-to-dinkuskit /proof /playground-tour /api/operator/*
  import {HERE / 'public-storefront.caddy'}
 }}
 basicauth @private {{
  operator {digest}
 }}
 import {HERE / 'retired-routes.caddy'}
 handle /pr-proof/example.png {{
  respond "static proof placeholder" 200
 }}
 handle {{
{fence_import}  reverse_proxy 127.0.0.1:{upstream.server_port}
 }}
}}
'''
        cls.fenced.write_text(text)
        cls.normal.write_text(text.replace(fence_import, ''))
        log = (work / 'caddy.log').open('w+')
        cls.addClassCleanup(log.close)
        p = subprocess.Popen([CADDY, 'run', '--config', cls.fenced, '--adapter', 'caddyfile'],
                             stdout=log, stderr=log, env=cls.env)

        def stop():
            if p.poll() is None:
                p.terminate()
                try:
                    p.wait(timeout=4)
                except subprocess.TimeoutExpired:
                    p.kill()
                    p.wait(timeout=4)
        cls.addClassCleanup(stop)
        for _ in range(40):
            if p.poll() is not None:
                break
            try:
                with socket.create_connection(('127.0.0.1', cls.port), timeout=0.5):
                    return
            except OSError:
                time.sleep(0.05)
        log.seek(0)
        raise RuntimeError('Fixture Caddy did not start:\n' + log.read())

    def request(self, path, method='GET', *, operator_peer=False, login=False, headers=None):
        # 127.0.0.2 is still confined to loopback but is not the admitted operator peer.
        source = '127.0.0.1' if operator_peer else '127.0.0.2'
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=3, source_address=(source, 0))
        fields = dict(headers or {})
        if login:
            fields['Authorization'] = 'Basic ' + base64.b64encode(FIXTURE_LOGIN.encode()).decode()
        try:
            c.request(method, path, headers=fields)
            r = c.getresponse()
            return r.status, dict(r.getheaders()), r.read()
        finally:
            c.close()

    def closed(self, path, method='GET', **options):
        calls = len(self.calls)
        code, headers, body = self.request(path, method, **options)
        self.assertEqual(code, 503)
        self.assertEqual(headers.get('Cache-Control'), 'no-store')
        self.assertEqual(headers.get('Retry-After'), '300')
        if method == 'HEAD':
            self.assertEqual(body, b'')
        else:
            self.assertIn(b'closed for maintenance', body)
        self.assertEqual(len(self.calls), calls)

    def test_public_routes_cannot_reach_the_store(self):
        commerce = '/_emdash/api/plugins/r_gshdrqaldna3r7sn'
        for method, path in [
            ('GET', '/'), ('GET', '/shop'), ('HEAD', '/feeds/agent-catalog.json'),
            ('GET', '/dashboard/'), ('GET', '/_astro/admin.js'),
            ('POST', '/cart/add'), ('POST', '/cart/change'), ('POST', '/cart/update'),
            ('POST', '/checkout'), ('GET', '/checkout/success'),
            ('GET', '/account'), ('POST', '/account/sign-in'),
            ('POST', commerce + '/checkout/guest/start'), ('POST', commerce + '/account/sign-in/start'),
            ('GET', commerce + '/store-proof'), ('GET', '/_emdash/api/media/file/example'),
            ('OPTIONS', '/api/future-surface'), ('PATCH', '/api/future-surface'),
        ]:
            with self.subTest(method=method, path=path):
                self.closed(path, method)

    def test_admin_requires_authentication_and_operator_peer(self):
        for path, method in [('/_emdash/admin/plugins/registry', 'GET'),
                             ('/_emdash/api/admin/plugins/registry/verify', 'POST'),
                             ('/_emdash/api/admin/plugins/registry/local-fixture/update', 'POST')]:
            with self.subTest(method=method, path=path):
                calls = len(self.calls)
                for operator_peer in (False, True):
                    code, headers, _ = self.request(path, method, operator_peer=operator_peer)
                    self.assertEqual(code, 401)
                    self.assertIn('Www-Authenticate', headers)
                self.assertEqual(len(self.calls), calls)
                self.closed(path, method, login=True, headers={'X-Forwarded-For': '127.0.0.1'})
                code, _, _ = self.request(path, method, operator_peer=True, login=True)
                self.assertEqual(code, 204)
                self.assertEqual(self.calls[calls:], [(method, path)])

    def test_operator_browsing_does_not_reopen_shop_or_public_plugin_writes(self):
        self.assertEqual(self.request('/_astro/admin.js', operator_peer=True)[0], 204)
        self.closed('/_astro/admin.js', 'POST', operator_peer=True, login=True)
        self.closed('/cart/add', 'POST', operator_peer=True, login=True)
        for route in ('checkout/guest/start', 'account/sign-in/start', 'store-proof'):
            path = '/_emdash/api/plugins/r_gshdrqaldna3r7sn/' + route
            # The normal edge's public exceptions do not run Basic Auth. A
            # supplied Authorization header alone is not a verified principal.
            self.closed(path, 'POST', operator_peer=True, login=True)

    def reload(self, config):
        subprocess.run([CADDY, 'reload', '--address', self.admin, '--config', config, '--adapter', 'caddyfile'],
                       check=True, capture_output=True, timeout=5, env=self.env)

    def test_reload_closes_and_reopens_only_the_existing_storefront_handler(self):
        self.addCleanup(self.reload, self.fenced)
        path = '/cart/add'
        self.closed(path, 'POST')
        self.reload(self.normal)
        calls = len(self.calls)
        self.assertEqual(self.request(path, 'POST')[0], 204)
        self.assertEqual(self.calls[calls:], [('POST', path)])
        self.reload(self.fenced)
        self.closed(path, 'POST')
        self.reload(self.normal)
        self.assertEqual(self.request(path, 'POST')[0], 204)
        self.assertEqual(self.request('/_emdash/admin')[0], 401)

    def test_existing_retired_and_external_static_handlers_are_not_app_writes(self):
        calls = len(self.calls)
        for path in ('/v1/webhooks/stripe', '/v1/checkout/wakes', '/v1/checkout/wakes/ack', '/api/ship'):
            for method in ('GET', 'POST'):
                with self.subTest(method=method, path=path):
                    self.assertEqual(self.request(path, method)[0], 404)
        self.assertEqual(self.request('/pr-proof/example.png')[0], 200)
        self.assertEqual(self.request('/proof')[0], 401)
        self.assertEqual(len(self.calls), calls)


if __name__ == '__main__':
    unittest.main()
