#!/usr/bin/env bash
# setimage <series> [part]
# Updates ~/.image-watch-config and ~/.image-watch-title.
#
# Usage:
#   setimage water 09        → routes images + writes post title to ~/.image-watch-title
#   setimage cng 06
#   setimage water           → series-level title, no part routing

set -euo pipefail

CONFIG="$HOME/.image-watch-config"
TITLE_FILE="$HOME/.image-watch-title"

if [[ $# -lt 1 ]]; then
  echo "Usage: setimage <series> [part]"
  echo "  e.g. setimage water 09"
  echo "  e.g. setimage cng"
  exit 1
fi

SERIES="$1"
PART="${2:-}"

# Zero-pad single-digit part numbers
if [[ "$PART" =~ ^[0-9]$ ]]; then
  PART="0${PART}"
fi

# --- TITLE MAPPING ---

get_title() {
  local series="$1" part="$2"
  case "${series}_${part}" in
    # Water series
    water_01) echo "Part I — Middle East Water Resilience Plan: Foundation and Recovery" ;;
    water_02) echo "Part II — Replumbing the Region: The Last Mile" ;;
    water_03) echo "Part III — Water Neutrality and Governance Substrate" ;;
    water_04) echo "Part IV — Conflicts in Asia's Watersheds: The Battle for Cross-Border Rivers" ;;
    water_05) echo "Part V — Prioritizing Watersheds: Engineering Triage for 400,000 Lives" ;;
    water_06) echo "Part VI — Sensitivity, Velocity, and the Cost of Delay" ;;
    water_07) echo "Part VII — Integrated Infrastructure Surge for Middle East Water Resilience" ;;
    water_08) echo "Part VIII — Proving the Surge — When Regional Becomes Replicable" ;;
    water_09) echo "Part IX — The Global Water–Energy–Transport Corridors" ;;
    water_10) echo "Part X — The 1900 AD Baseline: Geophysical Restoration and the Biological Surge" ;;
    water_11) echo "Part XI — The Corridor Already Exists" ;;
    water_)   echo "Water Series" ;;

    # CNG series
    cng_01) echo "Part I — The Natural Gas Vehicle Conversion Nobody's Talking About" ;;
    cng_02) echo "Part II — The Ultimate Geopolitical Shield" ;;
    cng_03) echo "Part III — The Year America Breathed Again" ;;
    cng_04) echo "Part IV — The Decade of Restoration: 2025–2035" ;;
    cng_05) echo "Part V — The Unintended Casualties of Clean Combustion" ;;
    cng_06) echo "Part VI — California Could Have the Lowest Transportation Fuel Cost on the Planet" ;;
    cng_)   echo "CNG Series" ;;

    # Fallback
    *) echo "${series} ${part}" ;;
  esac
}

TITLE="$(get_title "$SERIES" "$PART")"

# --- WRITE CONFIG ---

if [[ -n "$PART" ]]; then
  SECTION="${SERIES}-series/part-${PART}"
else
  SECTION="${SERIES}-series"
fi

echo "SECTION=$SECTION" > "$CONFIG"
echo "$TITLE" > "$TITLE_FILE"

# --- CONFIRM ---

DEST="$HOME/dev/oat-assets/$SECTION"
echo "✅ Section: $SECTION"
echo "   Title:   $TITLE"
echo "   Dest:    $DEST"
