#!/usr/bin/env bash
# Rollout switch only. Never changes Stripe mode, credentials or admin protection.
set -euo pipefail
case "${1:-}" in
  open) value=1 ;;
  close) value=0 ;;
  *) echo 'Usage: checkout-gate.sh open|close' >&2; exit 2 ;;
esac
sudo install -d -m755 /etc/systemd/system/backroadbum.service.d
printf '[Service]\nEnvironment=BACKROADBUM_CHECKOUT_ENABLED=%s\n' "$value" |
  sudo tee /etc/systemd/system/backroadbum.service.d/checkout.conf >/dev/null
sudo systemctl daemon-reload
sudo systemctl restart backroadbum
printf 'Merchant checkout gate: %s. Check /api/checkout/health; readiness is not paid proof.\n' "$1"
