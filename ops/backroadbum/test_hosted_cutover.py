import importlib.util
import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location('hosted_cutover', ROOT / 'verify-hosted-cutover.py')
cutover = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cutover)


class HostedCutoverTests(unittest.TestCase):
    def test_every_probed_legacy_route_is_explicitly_denied_without_proxying(self):
        source = (ROOT / 'retired-routes.caddy').read_text()
        matcher = next(line for line in source.splitlines() if line.startswith('@retired_merchant_routes path '))
        paths = matcher.split()[2:]
        for route in cutover.RETIRED:
            self.assertTrue(route in paths or route.startswith('/api/ship/'))
        self.assertIn('respond "" 404', source)
        self.assertNotIn('reverse_proxy', source)
        self.assertNotIn('method ', source)  # All methods close, not just GET.
        self.assertNotIn('/_emdash', source)  # Don't block Registry public proofs.
        self.assertNotIn('/*', [path for path in paths if path != '/api/ship/*'])

    def test_public_account_exceptions_are_exact_and_keep_merchant_routes_private(self):
        source = (ROOT / 'public-storefront.caddy').read_text()
        matcher = next(line for line in source.splitlines() if line.startswith('not path '))
        paths = matcher.split()[2:]
        prefix = '/_emdash/api/plugins/r_gshdrqaldna3r7sn/'
        accounts = {prefix + route for route, _, _ in cutover.ACCOUNT_PROBES}
        self.assertEqual({path for path in paths if '/account/' in path}, accounts)
        self.assertEqual(len(paths), len(set(paths)))
        self.assertEqual({path for path in paths if '*' in path}, {
            '/_emdash/api/media/file/*', '/_emdash/api/plugins/*/store-proof'})
        for route in ['orders', 'admin', 'product-panel', 'account/not-a-route']:
            self.assertNotIn(prefix + route, paths)
        self.assertNotIn('/_emdash/*', paths)
        self.assertNotIn('reverse_proxy', source)

    def test_public_account_probes_never_supply_an_email_code_or_capability(self):
        self.assertEqual({method for _, method, _ in cutover.ACCOUNT_PROBES}, {'GET', 'POST'})
        self.assertTrue(all(code in {'INVALID_INPUT', 'SESSION_DENIED', 'INVALID_PLUGIN_REQUEST'}
                            for _, _, code in cutover.ACCOUNT_PROBES))
        self.assertNotIn(('account/sign-in/start', 'GET', 'INVALID_INPUT'), cutover.ACCOUNT_PROBES)

    def test_digests_keep_row_order_stable_and_detect_saved_fact_changes(self):
        with sqlite3.connect(':memory:') as db:
            db.execute('CREATE TABLE _plugin_storage(plugin_id, collection, id, data)')
            for table in ['ec_products', 'ec_categories', 'ec_pages']:
                db.execute(f'CREATE TABLE {table}(id, data)')
            db.execute("INSERT INTO _plugin_storage VALUES ('commerce','orders','b','second')")
            db.execute("INSERT INTO _plugin_storage VALUES ('commerce','orders','a','first')")
            first = cutover.data_digests(db)
            self.assertEqual(first['orders']['count'], 2)
            self.assertEqual(first['catalog_items']['count'], 0)
            db.execute('DELETE FROM _plugin_storage')
            db.execute("INSERT INTO _plugin_storage VALUES ('commerce','orders','a','first')")
            db.execute("INSERT INTO _plugin_storage VALUES ('commerce','orders','b','second')")
            self.assertEqual(first, cutover.data_digests(db))
            db.execute("UPDATE _plugin_storage SET data='changed' WHERE id='a'")
            self.assertNotEqual(first['orders']['sha256'], cutover.data_digests(db)['orders']['sha256'])

    def test_checkout_health_requires_the_selected_admission_and_never_live_mode(self):
        schema = {'schema': 'backroadbum.checkout-health/v1'}
        closed = {**schema, 'admission': 'closed', 'readiness': 'unavailable', 'mode': None}
        opened = {**schema, 'admission': 'open', 'readiness': 'supported', 'mode': 'test'}
        cutover.verify_checkout_health(503, closed)
        cutover.verify_checkout_health(200, opened, checkout_open=True)
        for code, health, checkout_open in [
            (200, opened, False), (503, closed, True),
            (200, {**opened, 'mode': 'live'}, True),
            (200, {**opened, 'mode': None}, True),
            (200, {**opened, 'readiness': 'unavailable'}, True),
            (200, {**opened, 'schema': 'unknown'}, True),
            (503, {**closed, 'mode': 'test'}, False), (200, None, True),
        ]:
            with self.subTest(code=code, checkout_open=checkout_open, health=health):
                with self.assertRaisesRegex(RuntimeError, '^checkout_gate_changed$'):
                    cutover.verify_checkout_health(code, health, checkout_open)

    def test_failures_use_only_the_callers_fixed_code(self):
        cutover.require(True, 'unused')
        with self.assertRaisesRegex(RuntimeError, '^closed_boundary_required$'):
            cutover.require(False, 'closed_boundary_required')


if __name__ == '__main__':
    unittest.main()
