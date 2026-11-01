#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app="$project_dir/output/upstream/.tmp/app-builds/linux-unpacked/superproductivity"
profile="${CALM_WORK_PROFILE:-$project_dir/output/core-profile}"
if [[ ! -x "$app" ]] || [[ ! -f "$project_dir/output/build-kind" ]] || [[ "$(cat "$project_dir/output/build-kind")" != core ]]; then
  echo 'Build missing. Run scripts/build-core.sh first.' >&2
  exit 1
fi
mkdir -p "$profile/xdg-config" "$profile/xdg-cache" "$profile/xdg-data"
export XDG_CONFIG_HOME="$profile/xdg-config"
export XDG_CACHE_HOME="$profile/xdg-cache"
export XDG_DATA_HOME="$profile/xdg-data"
# Hyprland is not detected as GNOME/KDE, so Electron would fall back to plain-text storage; use the keyring.
exec "$app" "--user-data-dir=$profile" "--password-store=gnome-libsecret" "$@"
