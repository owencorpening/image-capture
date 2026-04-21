#!/usr/bin/env bash
set -euo pipefail

echo "▶ Minifying bookmarklet..."
# Strip the comment header (lines 1-6) before passing to terser, then re-wrap.
MINIFIED=$(sed '1,6d' bookmarklet.js | npx terser --compress --mangle 2>/dev/null)
echo "javascript:void($MINIFIED)" | xclip -selection clipboard
echo "✅ Bookmarklet copied to clipboard"

echo "▶ Installing watch scripts..."
cp watch-images.py ~/.local/bin/watch-images
cp image-title-server.py ~/.local/bin/image-title-server
chmod +x ~/.local/bin/watch-images ~/.local/bin/image-title-server
echo "✅ Scripts installed to ~/.local/bin/"

echo "▶ Restarting services..."
systemctl --user restart image-watch
systemctl --user restart image-title-server
echo "✅ Services restarted"

echo ""
echo "Done. Paste clipboard into your bookmark URL field."
