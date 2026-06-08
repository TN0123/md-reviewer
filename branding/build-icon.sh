#!/usr/bin/env bash
# Regenerate the macOS app icon (build/icon.icns) from the SVG source.
# Source of truth: branding/concept1-ink.svg
# Requires: rsvg-convert (brew install librsvg), iconutil (macOS built-in).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SVG="$ROOT/branding/concept1-ink.svg"
ISET="$ROOT/branding/icon.iconset"
OUT="$ROOT/build/icon.icns"

command -v rsvg-convert >/dev/null || { echo "error: rsvg-convert not found (brew install librsvg)"; exit 1; }

rm -rf "$ISET"; mkdir -p "$ISET" "$ROOT/build"

render() { rsvg-convert -w "$2" -h "$2" "$SVG" -o "$ISET/$1"; }
render icon_16x16.png        16
render icon_16x16@2x.png     32
render icon_32x32.png        32
render icon_32x32@2x.png     64
render icon_128x128.png     128
render icon_128x128@2x.png  256
render icon_256x256.png     256
render icon_256x256@2x.png  512
render icon_512x512.png     512
render icon_512x512@2x.png 1024

iconutil -c icns "$ISET" -o "$OUT"
rm -rf "$ISET"
echo "wrote $OUT"
