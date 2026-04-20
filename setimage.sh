#!/usr/bin/env bash
# setimage [series] [part]
# Updates ~/.image-watch-config and confirms the new routing target.
#
# Usage:
#   setimage baja-water-spine 03
#   setimage global-water-engineering-surge 02

set -euo pipefail

CONFIG="$HOME/.image-watch-config"

if [[ $# -lt 2 ]]; then
  echo "Usage: setimage <series> <part>"
  echo "  e.g. setimage baja-water-spine 03"
  exit 1
fi

SERIES="$1"
PART="$2"

# Zero-pad single-digit part numbers
if [[ "$PART" =~ ^[0-9]$ ]]; then
  PART="0${PART}"
fi

cat > "$CONFIG" <<EOF
SERIES=$SERIES
PART=$PART
EOF

DEST="$HOME/dev/wraith/substack-ideas/series-${SERIES}/images"
echo "✅ Now routing images to series-${SERIES} / part ${PART}"
echo "   Destination: $DEST"
