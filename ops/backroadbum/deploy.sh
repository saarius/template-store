#!/usr/bin/env bash
set -euo pipefail
export PATH=/opt/node/bin:/usr/local/bin:/usr/bin:/bin
export NODE_OPTIONS=--max-old-space-size=1200
export EMDASH_SITE_URL=https://backroadbum.com
export DINKUS_TEMPLATE_DB_URL=file:/var/lib/backroadbum/content.db
export DINKUS_TEMPLATE_UPLOADS_DIR=/var/lib/backroadbum/uploads
root=/var/lib/backroadbum
[[ -r /etc/backroadbum/emdash.env ]] || { echo 'Private EmDash encryption configuration missing; deploy refused'; exit 1; }
repo=/var/lib/trialrun/workspace/repos/template-store
exec 9>"$root/deploy.lock"
flock -n 9 || { echo 'Another deploy is running'; exit 1; }
release="$root/releases/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$release"
# An interrupted build must never become a retained or promoted release.
trap 'if [[ "$(readlink -f "$root/current" || true)" != "$release" ]]; then rm -rf -- "$release"; fi' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
cd "$repo"
# Owner Steer1: real Registry installs and hosted DinkusKit, never local service overlays.
export DINKUS_PAIRED_COMMERCE_DIR=""
export BACKROADBUM_HOSTED_REGISTRY=1
export BACKROADBUM_MERCHANT_PROFILE=1
unset BACKROADBUM_SHIP_DIR
export BACKROADBUM_CHECKOUT_ENABLED=1
pnpm exec astro build --outDir "$release"
# External Node dependencies resolve from this parent of every release.
ln -sfn "$repo/node_modules" "$root/node_modules"
python3 /var/lib/trialrun/workspace/ops/backup.py
old=$(readlink -f "$root/current" || true)
ln -sfn "$release" "$root/current.next"
mv -Tf "$root/current.next" "$root/current"
sudo systemctl restart backroadbum
healthy=false
for _ in {1..15}; do
  if curl -fsS --max-time 4 http://127.0.0.1:4321/shop -o /dev/null; then healthy=true; break; fi
  sleep 1
done
if [[ "$healthy" != true ]]; then
  if [[ -n "$old" ]]; then ln -sfn "$old" "$root/current"; sudo systemctl restart backroadbum; fi
  echo 'New release failed health check; restored previous release where available' >&2
  exit 1
fi
# Keep the active release and one previous release, independently of the three data backups.
find "$root/releases" -mindepth 1 -maxdepth 1 -type d | sort -r | tail -n +3 | while read -r path; do rm -rf -- "$path"; done
printf 'Deployed %s at %s\n' "$(git describe --always --dirty)" "$release"
