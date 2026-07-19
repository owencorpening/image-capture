#!/usr/bin/env bash
# setpublished — append a published article row to the content inventory
# Usage: setpublished "<title>" "<url-or-slug>" [series] [part] [date]
# Example: setpublished "Part I – Foundation" "https://owensappliedthinking.substack.com/p/part-i-foundation" "water" "01" "2026-04-21"

set -euo pipefail

INDEX="$HOME/dev/oat-content/content-inventory.md"

TITLE="${1:-}"
URL="${2:-}"
SERIES="${3:-standalone}"
PART="${4:-—}"
DATE="${5:-$(date +%Y-%m-%d)}"

if [[ -z "$TITLE" || -z "$URL" ]]; then
  echo "Usage: setpublished \"<title>\" \"<url-or-slug>\" [series] [part] [date]"
  exit 1
fi

# Reduce a full Substack URL to its slug (last path segment); pass slugs through.
SLUG="/${URL##*/}"

ROW="| $DATE | $TITLE | $SERIES | $PART | \`$SLUG\` | — | — | — | published |"

echo "$ROW" >> "$INDEX"
echo "✅ Added to $INDEX"
echo "   $ROW"
