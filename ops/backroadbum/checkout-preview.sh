#!/usr/bin/env bash
# A private guest-checkout preview; never changes the public service or proxy.
set -euo pipefail
export PATH=/opt/node/bin:/usr/local/bin:/usr/bin:/bin
repo=/var/lib/trialrun/workspace/repos/template-store
unit=backroadbum-checkout-preview
case "${1:-}" in
  stop) sudo systemctl stop "$unit"; exit ;;
  start) ;;
  *) echo 'Usage: checkout-preview.sh start|stop'; exit 2 ;;
esac
# Never mistake an already-public checkout for this controlled preview.
code=$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' -X POST https://backroadbum.com/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/prepare)
[[ "$code" == 503 ]] || { echo 'Public gate is not closed; preview refused'; exit 1; }
cd "$repo"
mkdir -p /var/lib/backroadbum/checkout-preview
chmod 700 /var/lib/backroadbum/checkout-preview
# This EmDash version hardcodes its sandbox nanoservice ports. Bind-mount a
# private copy with only the base port changed, in this unit's mount namespace.
# Plugin code, host grants, network policy and the public runner stay unchanged.
runner=$(node --input-type=module <<'JS'
import { realpathSync, readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';
const files = globSync('node_modules/@emdash-cms/sandbox-workerd/dist/runner-*.mjs');
if (files.length !== 1) throw Error('Unexpected sandbox runner layout');
const path = realpathSync(files[0]);
const source = readFileSync(path, 'utf8');
const marker = 'nextPluginPort = 18788;';
if (source.split(marker).length !== 2) throw Error('Sandbox port marker changed; review before previewing');
writeFileSync('/var/lib/backroadbum/checkout-preview/runner.mjs', source.replace(marker, 'nextPluginPort = 19788;'), { mode: 0o600 });
console.log(path);
JS
)
sudo systemd-run --unit="$unit" --uid=agent --gid=agent \
  --property=WorkingDirectory="$repo" \
  --property=EnvironmentFile=/etc/backroadbum/emdash.env \
  --property=BindReadOnlyPaths=/var/lib/backroadbum/checkout-preview/runner.mjs:"$runner" \
  --property=TimeoutStopSec=10 --property=UMask=0077 --property=NoNewPrivileges=true \
  --setenv=NODE_ENV=production --setenv=HOST=127.0.0.1 --setenv=PORT=4322 \
  --setenv=EMDASH_SITE_URL=https://backroadbum.com \
  --setenv=BACKROADBUM_MERCHANT_PROFILE=1 --setenv=BACKROADBUM_CHECKOUT_ENABLED=1 \
  --setenv=DINKUS_TEMPLATE_DB_URL=file:/var/lib/backroadbum/content.db \
  --setenv=DINKUS_TEMPLATE_UPLOADS_DIR=/var/lib/backroadbum/uploads \
  /opt/node/bin/node /var/lib/backroadbum/current/server/entry.mjs
for _ in {1..15}; do
  if curl -fsS --max-time 4 -H 'Host: backroadbum.com' -H 'X-Forwarded-Proto: https' http://127.0.0.1:4322/cart -o /dev/null; then
    echo 'Private preview on 127.0.0.1:4322; public checkout unchanged. Stop after verification.'; exit
  fi
  sleep 1
done
sudo systemctl stop "$unit"
echo 'Private preview failed its health check' >&2
exit 1
