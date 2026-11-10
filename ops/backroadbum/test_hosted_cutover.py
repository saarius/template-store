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

    def test_failures_use_only_the_callers_fixed_code(self):
        cutover.require(True, 'unused')
        with self.assertRaisesRegex(RuntimeError, '^closed_boundary_required$'):
            cutover.require(False, 'closed_boundary_required')


if __name__ == '__main__':
    unittest.main()
