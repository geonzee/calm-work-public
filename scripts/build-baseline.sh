#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
checkout="$project_dir/output/upstream"

if ! command -v mise >/dev/null 2>&1; then
  echo 'Install mise, then rerun this script (Node 22.18.0 is required).' >&2
  exit 1
fi
mise install node@22.18.0
pin="$(mise exec node@22.18.0 -- node -p 'require(process.argv[1]).commit' "$project_dir/upstream.json")"

if [[ ! -d "$checkout/.git" ]]; then
  mkdir -p "$project_dir/output"
  git clone --filter=blob:none https://github.com/super-productivity/super-productivity.git "$checkout"
  git -C "$checkout" checkout --detach "$pin"
fi

actual="$(git -C "$checkout" rev-parse HEAD)"
if [[ "$actual" != "$pin" ]]; then
  echo "Upstream checkout is at $actual, expected $pin; inspect it before building." >&2
  exit 1
fi

if rg -q "path: 'calm'" "$checkout/src/app/app.routes.ts"; then
  echo 'Core overlay is present. Use scripts/build-core.sh; baseline rebuilding requires a clean pinned checkout.' >&2
  exit 1
fi

cd "$checkout"
mise exec node@22.18.0 -- npm ci
mise exec node@22.18.0 -- npm run buildFrontend:dev
mise exec node@22.18.0 -- npm run electron:build
SP_SKIP_WAYLAND_IDLE_HELPER_BUILD=1 mise exec node@22.18.0 -- npm run pack

printf 'baseline\n' > "$project_dir/output/build-kind"

echo "Packaged app: $checkout/.tmp/app-builds/linux-unpacked/superproductivity"
echo 'Wayland idle helper is omitted because Cargo is not installed on this machine.'
