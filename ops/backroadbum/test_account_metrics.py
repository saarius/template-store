import unittest
from account_metrics import account_metrics


class AccountMetricsTests(unittest.TestCase):
    def test_anonymous_denial_proves_the_application_boundary_not_email_delivery(self):
        domain = {'ok': False, 'error': {'code': 'SESSION_DENIED', 'message': 'private details'}}
        for body in [domain, {'success': True, 'data': domain}]:
            self.assertEqual(account_metrics(body, 200), {
                'schema': 'backroadbum.account-boundary/v1', 'http': 200, 'state': 'capability-required'})

    def test_admin_challenge_is_not_shop_access(self):
        self.assertEqual(account_metrics(None, 401, True)['state'], 'blocked-by-admin-auth')
        self.assertEqual(account_metrics(None, 401, False)['state'], 'unavailable')

    def test_absent_malformed_or_unexpected_success_never_implies_protection(self):
        for body, status in [(None, None), ({}, 200), ([], 200), ({'success': True}, 200),
                             ({'ok': True, 'orders': ['private']}, 200),
                             ({'ok': False, 'error': {'code': 'UNAVAILABLE'}}, 200),
                             ({'ok': False, 'error': {'code': 'SESSION_DENIED'}}, 503)]:
            self.assertEqual(account_metrics(body, status)['state'], 'unavailable')
        self.assertNotIn('orders', account_metrics({'ok': True, 'orders': ['private']}, 200))


if __name__ == '__main__':
    unittest.main()
