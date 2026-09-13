#!/usr/bin/env bash
# Generate a full iOS + Android + Web app icon set from one square source image.
# Requires ImageMagick (`magick`). For SVG sources, also requires rsvg-convert
# (`brew install librsvg`) for correct rendering — ImageMagick's built-in SVG
# reader is a fallback that mishandles some SVG features (gradients, filters).
#
# Usage:
#   generate-icons.sh <source-image> <output-dir> [--bg #RRGGBB] [--pad 0.0-0.4] [--platforms ios,android,web]
#
# --bg       Background color used to flatten transparency for iOS icons and
#            legacy Android icons (iOS forbids alpha; Play Store strongly
#            discourages it). Default: #ffffff.
# --pad      Fractional padding (0.0 = edge-to-edge, 0.1 = 10% margin on each
#            side) applied when the source looks like a bare logo mark rather
#            than a pre-composed icon. Default: 0 (no padding — assumes the
#            source is already a finished square icon).
# --platforms  Comma-separated subset of ios,android,web. Default: all three.

set -euo pipefail

SRC=""
OUTDIR=""
BG="#ffffff"
PAD="0"
PLATFORMS="ios,android,web"

usage() { grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bg) BG="$2"; shift 2 ;;
    --pad) PAD="$2"; shift 2 ;;
    --platforms) PLATFORMS="$2"; shift 2 ;;
    -h|--help) usage ;;
    *)
      if [[ -z "$SRC" ]]; then SRC="$1";
      elif [[ -z "$OUTDIR" ]]; then OUTDIR="$1";
      else echo "Unexpected argument: $1" >&2; usage; fi
      shift ;;
  esac
done

[[ -n "$SRC" && -n "$OUTDIR" ]] || usage
[[ -f "$SRC" ]] || { echo "Source image not found: $SRC" >&2; exit 1; }

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick ('magick') is required but not found." >&2
  echo "Install it with: brew install imagemagick" >&2
  exit 1
fi

mkdir -p "$OUTDIR"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# --- Step 1: build two master rasters at high resolution ---------------------
# MASTER_TRANSPARENT: padded, alpha preserved (source for Android layers, web maskable).
# MASTER_OPAQUE:      padded, flattened onto $BG (source for iOS + legacy Android + favicons).
MASTER_SIZE=1536
pad_pct=$(awk -v p="$PAD" 'BEGIN{printf "%.4f", p}')
content_pct=$(awk -v p="$pad_pct" 'BEGIN{printf "%.4f", 1-2*p}')
content_px=$(awk -v s="$MASTER_SIZE" -v c="$content_pct" 'BEGIN{printf "%d", s*c}')

# ImageMagick 7 tries its own built-in "MSVG" SVG coder before ever reaching
# the rsvg-convert delegate, even when rsvg-convert is installed and on PATH —
# and the built-in coder mishandles strokes/gradients/nested shapes. So for
# SVG sources, rasterize with rsvg-convert directly (if available) and hand
# ImageMagick a PNG from then on; only fall back to letting magick read the
# SVG itself if rsvg-convert is missing.
RASTER_SRC="$SRC"
if [[ "$SRC" == *.svg || "$SRC" == *.SVG ]]; then
  if command -v rsvg-convert >/dev/null 2>&1; then
    rsvg-convert -w "$MASTER_SIZE" -h "$MASTER_SIZE" --keep-aspect-ratio \
      -o "$WORK/source-rasterized.png" "$SRC"
    RASTER_SRC="$WORK/source-rasterized.png"
  else
    echo "Warning: rsvg-convert not found. Falling back to ImageMagick's" >&2
    echo "built-in SVG renderer, which can mishandle gradients/filters/text." >&2
    echo "For reliable results: brew install librsvg" >&2
  fi
fi

# Render/resize the source to a square content tile, preserving aspect ratio
# inside that tile (extent centers it), then pad out to MASTER_SIZE canvas.
magick "$RASTER_SRC" -background none -resize "${content_px}x${content_px}" \
  -gravity center -extent "${content_px}x${content_px}" \
  -background none -gravity center -extent "${MASTER_SIZE}x${MASTER_SIZE}" \
  "$WORK/master-transparent.png"

magick "$WORK/master-transparent.png" -background "$BG" -flatten \
  "$WORK/master-opaque.png"

resize_from() {
  # resize_from <master> <size> <outfile>
  magick "$1" -resize "${2}x${2}" -gravity center -extent "${2}x${2}" "$3"
}

want() { [[ ",$PLATFORMS," == *",$1,"* ]]; }

# --- iOS ----------------------------------------------------------------------
if want ios; then
  IOS_DIR="$OUTDIR/AppIcon.appiconset"
  mkdir -p "$IOS_DIR"

  # size(px) idiom scale filename
  # See references/ios-sizes.md for what each row is for and how to verify
  # against Apple's current docs if this list is ever in question.
  ios_entries=(
    "40 iphone 2x 20"
    "60 iphone 3x 20"
    "58 iphone 2x 29"
    "87 iphone 3x 29"
    "80 iphone 2x 40"
    "120 iphone 3x 40"
    "120 iphone 2x 60"
    "180 iphone 3x 60"
    "20 ipad 1x 20"
    "40 ipad 2x 20"
    "29 ipad 1x 29"
    "58 ipad 2x 29"
    "40 ipad 1x 40"
    "80 ipad 2x 40"
    "76 ipad 1x 76"
    "152 ipad 2x 76"
    "167 ipad 2x 83.5"
    "1024 ios-marketing 1x 1024"
  )

  contents_images="[]"
  images_json="["
  first=true
  for entry in "${ios_entries[@]}"; do
    read -r px idiom scale pt <<< "$entry"
    fname="icon-${pt}@${scale}-${idiom}.png"
    resize_from "$WORK/master-opaque.png" "$px" "$IOS_DIR/$fname"
    $first || images_json+=","
    first=false
    images_json+=$(cat <<JSON
{"size":"${pt}x${pt}","idiom":"${idiom}","filename":"${fname}","scale":"${scale}"}
JSON
)
  done
  images_json+="]"

  cat > "$IOS_DIR/Contents.json" <<JSON
{
  "images" : $images_json,
  "info" : { "author" : "generate-icons.sh", "version" : 1 }
}
JSON
  echo "iOS: wrote $IOS_DIR ($(ls "$IOS_DIR" | grep -c png) PNGs)"
fi

# --- Android --------------------------------------------------------------
if want android; then
  ANDROID_DIR="$OUTDIR/android"
  mkdir -p "$ANDROID_DIR/mipmap-anydpi-v26"

  # density legacy_px adaptive_layer_px  (adaptive layer = 108dp scaled by density)
  densities=(
    "mdpi 48 108"
    "hdpi 72 162"
    "xhdpi 96 216"
    "xxhdpi 144 324"
    "xxxhdpi 192 432"
  )

  for d in "${densities[@]}"; do
    read -r name legacy_px layer_px <<< "$d"
    mkdir -p "$ANDROID_DIR/mipmap-$name"
    # Legacy launcher icon: flattened, square, no transparency expectations relaxed
    # (legacy icons may keep alpha, but a flattened icon is safest across launchers).
    resize_from "$WORK/master-opaque.png" "$legacy_px" "$ANDROID_DIR/mipmap-$name/ic_launcher.png"
    resize_from "$WORK/master-opaque.png" "$legacy_px" "$ANDROID_DIR/mipmap-$name/ic_launcher_round.png"

    # Adaptive icon foreground: transparent background, content kept inside the
    # 72dp safe zone (66dp circle) of the 108dp canvas — i.e. content occupies
    # roughly the middle 61% of the layer, matched here via an inner extent.
    safe_px=$(awk -v l="$layer_px" 'BEGIN{printf "%d", l*0.61}')
    magick "$WORK/master-transparent.png" -resize "${safe_px}x${safe_px}" \
      -background none -gravity center -extent "${layer_px}x${layer_px}" \
      "$ANDROID_DIR/mipmap-$name/ic_launcher_foreground.png"

    # Adaptive icon background: flat fill of the whole 108dp canvas.
    magick -size "${layer_px}x${layer_px}" "xc:$BG" \
      "$ANDROID_DIR/mipmap-$name/ic_launcher_background.png"
  done

  cat > "$ANDROID_DIR/mipmap-anydpi-v26/ic_launcher.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
XML
  cp "$ANDROID_DIR/mipmap-anydpi-v26/ic_launcher.xml" "$ANDROID_DIR/mipmap-anydpi-v26/ic_launcher_round.xml"

  resize_from "$WORK/master-opaque.png" 512 "$ANDROID_DIR/play-store-icon.png"
  echo "Android: wrote $ANDROID_DIR (5 densities + adaptive layers + Play Store icon)"
fi

# --- Web --------------------------------------------------------------------
if want web; then
  WEB_DIR="$OUTDIR/web"
  mkdir -p "$WEB_DIR"

  resize_from "$WORK/master-opaque.png" 16 "$WEB_DIR/favicon-16x16.png"
  resize_from "$WORK/master-opaque.png" 32 "$WEB_DIR/favicon-32x32.png"
  resize_from "$WORK/master-opaque.png" 48 "$WEB_DIR/favicon-48x48.png"
  magick "$WEB_DIR/favicon-16x16.png" "$WEB_DIR/favicon-32x32.png" "$WEB_DIR/favicon-48x48.png" \
    "$WEB_DIR/favicon.ico"

  resize_from "$WORK/master-opaque.png" 180 "$WEB_DIR/apple-touch-icon.png"
  resize_from "$WORK/master-opaque.png" 192 "$WEB_DIR/android-chrome-192x192.png"
  resize_from "$WORK/master-opaque.png" 512 "$WEB_DIR/android-chrome-512x512.png"

  # Maskable icon: browsers/OSes may crop to a circle, so keep content inside
  # the same ~61% safe zone used for the Android adaptive foreground.
  magick "$WORK/master-transparent.png" -resize "312x312" \
    -background "$BG" -gravity center -extent "512x512" \
    "$WEB_DIR/maskable-icon-512x512.png"

  cat > "$WEB_DIR/site.webmanifest" <<JSON
{
  "name": "",
  "short_name": "",
  "icons": [
    { "src": "/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/maskable-icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "theme_color": "$BG",
  "background_color": "$BG",
  "display": "standalone"
}
JSON
  echo "Web: wrote $WEB_DIR (favicons, touch icon, PWA icons, manifest)"
fi

echo "Done. Output: $OUTDIR"
