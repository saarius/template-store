#!/usr/bin/env bash
set -euo pipefail

build_release() { pnpm exec astro build --outDir "$1"; }
snapshot_store() { python3 /var/lib/trialrun/workspace/ops/backup.py; }
restart_store() { sudo systemctl restart backroadbum; }
stop_store() { sudo systemctl stop backroadbum; }

wait_for_store() {
  local status
  for _ in {1..15}; do
    if status=$(curl -fsS --max-time 4 http://127.0.0.1:4321/shop -o /dev/null -w '%{http_code}') && [[ "$status" == 200 ]]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

point_current_at() {
  ln -sfnT -- "$1" "$root/current.next" && mv -Tf -- "$root/current.next" "$root/current"
}

deploy_release() {
  # Main holds the lock. The EXIT handler's state must outlive this function.
  root=$1 previous='' accepted=false
  local repo=$2 stamp=$3 dependencies
  [[ "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || exit 1
  release="$root/releases/$stamp"
  cd "$repo"
  dependencies=$(realpath -e -- node_modules) || exit 1
  if [[ "$dependencies" != "$(pwd -P)/node_modules" || ! -d "$dependencies" ]]; then
    echo 'Expected the installed dependency tree of the build checkout; deploy refused' >&2
    exit 1
  fi
  if [[ -e "$root/current" || -L "$root/current" ]]; then
    previous=$(realpath -e -- "$root/current") || exit 1
    if [[ ! -L "$root/current" || "${previous%/*}" != "$root/releases" || ! -f "$previous/server/entry.mjs" ]]; then
      echo 'Current does not point to a retained storefront release; deploy refused' >&2
      exit 1
    fi
  fi
  mkdir -- "$release"
  trap 'finish_deploy "$?"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  build_release "$release"
  if [[ ! -f "$release/server/entry.mjs" || -L "$release/server" || -L "$release/server/entry.mjs" ]]; then
    echo 'Missing standalone server entry; deploy refused' >&2
    exit 1
  fi
  # Never repoint the legacy shared link: older builds may still rely on it.
  ln -sT -- "$dependencies" "$release/node_modules"
  snapshot_store
  point_current_at "$release"
  if ! restart_store || ! wait_for_store; then
    echo 'New release failed to start or pass the shop check' >&2
    exit 1
  fi
  accepted=true
  prune_releases
  printf 'Deployed %s at %s\n' "$(git describe --always --dirty)" "$release"
}

finish_deploy() {
  local status=$1 keep_failed=false
  trap - EXIT
  if [[ "$accepted" != true && "$(readlink -f -- "$root/current" || true)" == "$release" ]]; then
    if [[ -n "$previous" ]]; then
      if point_current_at "$previous" && restart_store && wait_for_store; then
        echo 'Previous release restored and shop check passed (release pointer only)' >&2
      else
        keep_failed=true
        echo 'Previous release could not be verified; operator recovery required' >&2
      fi
    elif stop_store && rm -- "$root/current"; then
      echo 'No previous release; stopped the first deployment' >&2
    else
      keep_failed=true
      echo 'First deployment could not be stopped or cleared; operator recovery required' >&2
    fi
  fi
  # Preserve a possibly running candidate if recovery failed, even if current moved back.
  if [[ "$accepted" != true && "$keep_failed" != true && "$(readlink -f -- "$root/current" || true)" != "$release" ]]; then
    rm -rf -- "$release" || echo 'Unpromoted release directory could not be removed' >&2
  fi
  exit "$status"
}

prune_releases() {
  # Keep the release we actually replaced, even when an orphan has a newer timestamp.
  local path
  for path in "$root/releases/"*; do
    if [[ "${path##*/}" =~ ^[0-9]{8}T[0-9]{6}Z$ && -d "$path" && ! -L "$path" &&
          "$path" != "$release" && "$path" != "$previous" ]]; then
      rm -rf -- "$path"
    fi
  done
}

main() {
  export PATH=/opt/node/bin:/usr/local/bin:/usr/bin:/bin
  export NODE_OPTIONS=--max-old-space-size=1200
  export EMDASH_SITE_URL=https://backroadbum.com
  export DINKUS_TEMPLATE_DB_URL=file:/var/lib/backroadbum/content.db
  export DINKUS_TEMPLATE_UPLOADS_DIR=/var/lib/backroadbum/uploads
  [[ -r /etc/backroadbum/emdash.env ]] || { echo 'Private EmDash encryption configuration missing; deploy refused'; exit 1; }
  local store_root=/var/lib/backroadbum build_checkout=/var/lib/trialrun/workspace/repos/template-store
  exec 9>"$store_root/deploy.lock"
  flock -n 9 || { echo 'Another deploy is running'; exit 1; }
  # Owner Steer1: real Registry installs and hosted DinkusKit, never local service overlays.
  export DINKUS_PAIRED_COMMERCE_DIR=""
  export BACKROADBUM_HOSTED_REGISTRY=1
  export BACKROADBUM_MERCHANT_PROFILE=1
  unset BACKROADBUM_SHIP_DIR
  export BACKROADBUM_CHECKOUT_ENABLED=1
  deploy_release "$store_root" "$build_checkout" "$(date -u +%Y%m%dT%H%M%SZ)"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main; fi
