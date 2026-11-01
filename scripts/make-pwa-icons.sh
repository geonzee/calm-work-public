#!/usr/bin/env bash
# Render the Calm Work icon set from the one SVG source. Needs rsvg-convert and ImageMagick.
set -euo pipefail
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/apps/mobile/pwa-icons"
src="$dir/calm-icon.svg"
# Desktop and PWA share the same approved mark.
cp "$dir/../../desktop/linux/calm-work.svg" "$src"
rm -f "$dir"/*.png "$dir"/favicon.ico
for s in 72 96 128 144 192 512; do rsvg-convert -w $s -h $s "$src" -o "$dir/icon-$s.png"; done
# iOS applies its own rounded mask: full-bleed, no transparency.
rsvg-convert -w 180 -h 180 "$src" -o "$dir/apple-touch-icon.png"
magick "$dir/apple-touch-icon.png" -background "#171717" -alpha remove -alpha off "$dir/apple-touch-icon.png"
# Maskable: the artwork already sits inside the central 80% safe circle.
rsvg-convert -w 512 -h 512 "$src" -o "$dir/icon-maskable-512.png"
for s in 16 32 192; do rsvg-convert -w $s -h $s "$src" -o "$dir/favicon-$s.png"; done
magick "$dir/favicon-16.png" "$dir/favicon-32.png" "$dir/favicon.ico"
rsvg-convert -w 1024 -h 1024 "$src" -o "$dir/icon-1024.png"
ls -l "$dir"
# iOS launch images: the mark on the app canvas, one per iPhone screen (width height scale).
splash="$dir/splash"
rm -rf "$splash" && mkdir -p "$splash"
rsvg-convert -w 192 -h 192 "$src" -o "$splash/mark.png"
while read -r w h s; do
  for o in portrait landscape; do
    if [ "$o" = portrait ]; then pw=$((w * s)); ph=$((h * s)); else pw=$((h * s)); ph=$((w * s)); fi
    magick -size "${pw}x${ph}" xc:"#101010" \( "$splash/mark.png" -resize $((64 * s))x$((64 * s)) \) -gravity center -composite -strip "$splash/launch-${w}x${h}@${s}x-$o.png"
  done
done <<'SIZES'
440 956 3
402 874 3
430 932 3
393 852 3
428 926 3
390 844 3
414 896 3
375 812 3
414 896 2
375 667 2
SIZES
rm "$splash/mark.png"
ls -l "$splash"
