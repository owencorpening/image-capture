#!/usr/bin/env bash
set -euo pipefail

echo "▶ Minifying bookmarklet..."
# Strip comment header and the javascript:void( ... ); wrapper, minify the IIFE,
# strip trailing semicolon, re-wrap in javascript:void()
MINIFIED=$(sed '1,3d' bookmarklet.js \
  | sed '1s/^javascript:void(//' \
  | sed '$s/);$//' \
  | npx terser --compress --mangle --format quote_style=1 \
  | sed 's/;$//')
if [[ -z "$MINIFIED" ]]; then
  echo "❌ Minification produced empty output" >&2
  exit 1
fi
BOOKMARKLET="javascript:void($MINIFIED)"
if [[ -n "${DISPLAY:-}" ]] && command -v xclip >/dev/null && echo "$BOOKMARKLET" | xclip -selection clipboard >/dev/null 2>&1; then
  echo "$BOOKMARKLET" | xclip -selection primary >/dev/null 2>&1 || true
  echo "✅ Bookmarklet copied to clipboard"
else
  echo "$BOOKMARKLET" > /tmp/bookmarklet.txt
  echo "⚠️  No clipboard available — bookmarklet written to /tmp/bookmarklet.txt"
fi

echo "▶ Installing watch scripts..."
cp watch-images.py ~/.local/bin/watch-images
cp image-title-server.py ~/.local/bin/image-title-server
cp setpublished.sh ~/.local/bin/setpublished
chmod +x ~/.local/bin/watch-images ~/.local/bin/image-title-server ~/.local/bin/setpublished
echo "✅ Scripts installed to ~/.local/bin/"

echo "▶ Restarting services..."
systemctl --user restart image-watch
systemctl --user restart image-title-server
echo "✅ Services restarted"

echo ""
echo "Done. Paste clipboard into your bookmark URL field."
