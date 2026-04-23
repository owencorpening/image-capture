#!/usr/bin/env bash
# setpublished — append a published article row to the index
# Usage: setpublished "<title>" "<url>" "<series>" [date]
# Example: setpublished "Part I – Foundation" "https://substack.com/..." "water" "2026-04-21"

set -euo pipefail

INDEX="$HOME/dev/wraith/substack-ideas/published-index.md"

TITLE="${1:-}"
URL="${2:-}"
SERIES="${3:-standalone}"
DATE="${4:-$(date +%Y-%m-%d)}"

if [[ -z "$TITLE" || -z "$URL" ]]; then
  echo "Usage: setpublished \"<title>\" \"<url>\" [series] [date]"
  exit 1
fi

ROW="| $DATE | $TITLE | $SERIES | — | $URL | published |"

echo "$ROW" >> "$INDEX"
echo "✅ Added to $INDEX"
echo "   $ROW"
