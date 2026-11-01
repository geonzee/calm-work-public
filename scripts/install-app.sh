#!/usr/bin/env bash
# Install (or update) a fixed copy of the current core build outside the checkout.
# Rebuilding the checkout never changes the installed app; run this again to update.
#   ~/.local/opt/calm-work/releases/<stamp>/  installed app copies
#   ~/.local/opt/calm-work/current            symlink to the active release
#   ~/.local/share/calm-work                  live profile (never touched here)
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build="$project_dir/output/upstream/.tmp/app-builds/linux-unpacked"
prefix="${CALM_WORK_PREFIX:-$HOME/.local/opt/calm-work}"
keep="${CALM_WORK_KEEP_RELEASES:-3}"
if [[ -e "$prefix/current" && "${CALM_WORK_REPLACE_DAILY:-}" != 1 ]]; then
  echo "An install already exists at $prefix/current." >&2
  echo "Set CALM_WORK_REPLACE_DAILY=1 to replace that build. The profile is left where it is." >&2
  exit 1
fi
case "$prefix" in
  "$HOME/.local/share/calm-work")
    echo "Refusing to use the profile directory as an install prefix." >&2
    exit 1
    ;;
esac
if [[ ! -x "$build/superproductivity" ]] || [[ "$(cat "$project_dir/output/build-kind" 2>/dev/null)" != core ]]; then
  echo 'Core build missing. Run scripts/build-core.sh first.' >&2
  exit 1
fi
stamp="$(date +%Y%m%d-%H%M%S)-$(git -C "$project_dir" rev-parse --short HEAD 2>/dev/null || echo nogit)"
releases="$prefix/releases"
mkdir -p "$releases"
tmp="$releases/.incoming-$stamp"
rm -rf "$tmp"
cp -a "$build" "$tmp"
mv "$tmp" "$releases/$stamp"
ln -sfn "releases/$stamp" "$prefix/current.new"
mv -T "$prefix/current.new" "$prefix/current"
echo "Installed $stamp to $prefix/current"
# Prune old releases, never the active one.
active="$(readlink "$prefix/current")"
mapfile -t old < <(cd "$releases" && /usr/bin/ls -1d -- */ 2>/dev/null | sed 's#/$##' | sort -r | tail -n +"$((keep + 1))")
for r in "${old[@]}"; do
  [[ "releases/$r" == "$active" ]] && continue
  rm -rf -- "${releases:?}/$r"
done
echo 'Restart Calm Work (tray Quit, then open it) to use the new version.'
# The launcher must keep Electron on the system keyring; without it Hyprland
# falls back to basic_text and calendar sign-ins cannot be stored.
launcher="$HOME/.local/bin/calm-work"
if [[ -f "$launcher" ]] && ! grep -q -- '--password-store=gnome-libsecret' "$launcher"; then
  echo "Warning: $launcher lacks --password-store=gnome-libsecret; re-run scripts/install-linux-launcher.py." >&2
fi
if ! grep -q -- '--password-store=gnome-libsecret' "$project_dir/apps/desktop/linux/calm-work-launcher.sh"; then
  echo 'Launcher template lost --password-store=gnome-libsecret.' >&2
  exit 1
fi
