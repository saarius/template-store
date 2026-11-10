"""Allowlisted Payments liveness facts; never publish provider payloads."""

def payments_metrics(value, http_status):
    if not isinstance(value, dict) or value.get('service') != 'backroadbum-payments':
        return None
    def flag(key):
        field = value.get(key)
        return field if isinstance(field, bool) else None
    def count(key):
        field = value.get(key)
        return field if type(field) is int and 0 <= field <= 2**53 - 1 else None
    return {
        'http': http_status,
        'mode': value.get('mode') if value.get('mode') in ['test', 'live'] else None,
        'storefrontConnected': flag('storefrontConnected'),
        'webhookConfigured': flag('webhookConfigured'),
        'webhookConnected': flag('webhookConnected'),
        'pendingWakes': count('pendingWakes'),
        'acknowledgedWakes': count('acknowledgedWakes'),
        'lastWebhookAt': count('lastWebhookAt'),
    }
