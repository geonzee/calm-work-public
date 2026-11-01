#!/usr/bin/env bash
# Calm Work launcher: installed copy + stable profile. Installed by scripts/install-linux-launcher.py.
set -euo pipefail
app="${CALM_WORK_APP:-$HOME/.local/opt/calm-work/current}/superproductivity"
profile="${CALM_WORK_PROFILE:-$HOME/.local/share/calm-work}"
if [[ ! -x "$app" ]]; then
  notify-send -a "Calm Work" "Calm Work is not installed" "Run scripts/install-app.sh in the calm-work checkout." 2>/dev/null || true
  echo "Calm Work not installed at $app" >&2
  exit 1
fi
mkdir -p "$profile/xdg-config" "$profile/xdg-cache" "$profile/xdg-data"
chmod 700 "$profile"
# Keep the real values so the app can open the user's browser for sign-in.
export CALM_WORK_HOST_XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export CALM_WORK_HOST_XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
export XDG_CONFIG_HOME="$profile/xdg-config"
export XDG_CACHE_HOME="$profile/xdg-cache"
export XDG_DATA_HOME="$profile/xdg-data"
# Hyprland is not detected as GNOME/KDE, so Electron would fall back to plain-text storage; use the keyring.
exec "$app" "--user-data-dir=$profile" "--password-store=gnome-libsecret" "$@"
