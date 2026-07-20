#!/usr/bin/env bash
set -euo pipefail

echo "▶ Minifying bookmarklet..."
# The committed bookmarklet.js carries a placeholder token; the real one lives
# in the gitignored .credentials file and is injected here at build time.
if [[ ! -s .credentials ]]; then
  echo "❌ Missing .credentials — paste your SECRET_TOKEN there (gitignored)" >&2
  exit 1
fi
TOKEN=$(tr -d ' \n\r' < .credentials | sed 's/^[A-Z_]*=//')
# Strip comment header and the javascript:void( ... ); wrapper, inject the
# token, minify the IIFE, strip trailing semicolon, re-wrap in javascript:void()
MINIFIED=$(sed '1,3d' bookmarklet.js \
  | sed '1s/^javascript:void(//' \
  | sed '$s/);$//' \
  | sed "s/YOUR_SECRET_TOKEN_HERE/$TOKEN/" \
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
