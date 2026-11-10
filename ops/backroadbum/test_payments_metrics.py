import json
import unittest
from payments_metrics import payments_metrics

class PaymentsMetricsTest(unittest.TestCase):
    def test_whitelists_counts_and_flags_without_exposing_private_fields(self):
        result = payments_metrics({'service': 'backroadbum-payments', 'mode': 'test',
            'webhookConfigured': True, 'webhookConnected': True, 'pendingWakes': 0,
            'acknowledgedWakes': 2, 'lastWebhookAt': 1794271027713,
            'secret': 'sk_test_do_not_publish', 'event': {'customer_email': 'private@example.test'}}, 200)
        self.assertEqual(result['pendingWakes'], 0)
        self.assertEqual(result['acknowledgedWakes'], 2)
        self.assertIsNone(result['storefrontConnected'])
        self.assertNotIn('private', json.dumps(result))
        self.assertNotIn('sk_test_', json.dumps(result))

    def test_missing_or_invalid_data_stays_unavailable_not_zero(self):
        for value in [None, [], {}, {'service': 'unexpected'}]:
            self.assertIsNone(payments_metrics(value, 200))
        for value in [None, True, -1, 1.5, '0', 2**53]:
            result = payments_metrics({'service': 'backroadbum-payments', 'pendingWakes': value,
                'acknowledgedWakes': value, 'lastWebhookAt': value, 'webhookConnected': 'true'}, 200)
            self.assertIsNone(result['pendingWakes'])
            self.assertIsNone(result['acknowledgedWakes'])
            self.assertIsNone(result['lastWebhookAt'])
            self.assertIsNone(result['webhookConnected'])

if __name__ == '__main__':
    unittest.main()
