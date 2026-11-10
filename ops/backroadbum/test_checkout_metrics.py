import unittest
from checkout_metrics import checkout_metrics, SCHEMA
class CheckoutMetricsTests(unittest.TestCase):
    def test_ready_is_only_exact_test_advisory(self):
        body = dict(schema=SCHEMA, admission='open', readiness='supported', mode='test')
        self.assertEqual(checkout_metrics(body, 200)['state'], 'ready-advisory')
        for changed in [dict(body, mode='live'), dict(body, schema='other'), dict(body, admission='closed'), dict(body, secret='do not project')]:
            self.assertEqual(checkout_metrics(changed, 200)['state'], 'unavailable')
        self.assertEqual(checkout_metrics(body, 503)['state'], 'unavailable')
    def test_closed_is_not_payment_failure(self):
        result = checkout_metrics(dict(schema=SCHEMA, admission='closed', readiness='unavailable', mode=None), 503)
        self.assertEqual(result['state'], 'closed')
        self.assertNotIn('lastPaidTestAt', result)
    def test_missing_is_unavailable(self):
        for value in [None, {}, [], 'invalid']:
            self.assertEqual(checkout_metrics(value, None)['state'], 'unavailable')
if __name__ == '__main__': unittest.main()
