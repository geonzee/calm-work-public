#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
upstream_commit="$(git -C "$project_dir/output/upstream" rev-parse HEAD)"
CALM_VERIFIED_UPSTREAM_COMMIT="$upstream_commit" mise exec node@22.18.0 -- node "$project_dir/scripts/prepare-core.cjs"
cd "$project_dir/output/upstream"
# Bundle SP's own calendar providers (Google, CalDAV); Calm Work reuses their
# OAuth, token storage and polling instead of a parallel stack.
for plugin in google-calendar-provider caldav-calendar-provider; do
  (cd "packages/plugin-dev/$plugin" && mise exec node@22.18.0 -- node ../scripts/build-with-esbuild.js >/dev/null)
  rm -rf "src/assets/bundled-plugins/$plugin"
  mkdir -p "src/assets/bundled-plugins/$plugin"
  cp -R "packages/plugin-dev/$plugin/dist/." "src/assets/bundled-plugins/$plugin/"
done
mise exec node@22.18.0 -- npm run buildFrontend:dev
mise exec node@22.18.0 -- npm run electron:build
SP_SKIP_WAYLAND_IDLE_HELPER_BUILD=1 mise exec node@22.18.0 -- npm run pack

printf 'core\n' > "$project_dir/output/build-kind"
