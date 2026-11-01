#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app="$project_dir/output/upstream/.tmp/app-builds/linux-unpacked/superproductivity"
profile="$project_dir/output/baseline-profile"

if [[ ! -x "$app" ]]; then
  echo 'Packaged app missing. Run scripts/build-baseline.sh first.' >&2
  exit 1
fi

if [[ -f "$project_dir/output/build-kind" ]] && [[ "$(cat "$project_dir/output/build-kind")" == core ]]; then
  echo 'The package now contains Calm Work. Use scripts/launch-core.sh.' >&2
  exit 1
fi

mkdir -p "$profile/xdg-config" "$profile/xdg-cache" "$profile/xdg-data"
export XDG_CONFIG_HOME="$profile/xdg-config"
export XDG_CACHE_HOME="$profile/xdg-cache"
export XDG_DATA_HOME="$profile/xdg-data"
exec "$app" "--user-data-dir=$profile" "$@"
