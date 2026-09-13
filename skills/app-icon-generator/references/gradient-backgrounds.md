# Gradient / "liquid glass" backgrounds

`scripts/generate-icons.sh` only supports a flat `--bg` color by design — a
flat color is the safe default and correct for Android's adaptive icon
layers (see below). Only reach for this recipe when a user explicitly asks
for a gradient, glossy, or "liquid glass" look; don't apply it unprompted,
and don't be surprised if the user tries it and decides they preferred the
flat color — that's a normal outcome, not a sign to push back.

## The recipe (ImageMagick)

Three layers, composited together at your master resolution (e.g. 1536²):

1. **Base gradient** — `magick -size 1536x1536 gradient:'#colorA'-'#colorB' ...`
2. **Bottom vignette** (subtle depth) — a big blurred black ellipse anchored
   near the bottom edge, alpha scaled down (~0.3), multiply-composited onto
   the gradient.
3. **Specular highlight** (the "glass" part) — a big blurred white ellipse
   offset toward one corner (upper-left reads as a natural light source),
   alpha scaled down (~0.35-0.5), screen-composited on top.

Then composite your glyph (resized to the same content fraction `--pad`
would have produced, e.g. 68% of canvas for `pad=0.16`) centered on top with
normal `over` compositing.

```bash
S=1536
magick -size ${S}x${S} gradient:'#7c3aed'-'#3730a3' -distort SRT 0 -gravity center -extent ${S}x${S} grad.png
magick -size ${S}x${S} xc:none -fill black -draw "ellipse $((S/2)),$S $((S*7/10)),$((S*45/100)) 0,360" \
  -blur 0x120 -channel A -evaluate multiply 0.30 +channel vig.png
magick -size ${S}x${S} xc:none -fill white -draw "ellipse $((S*35/100)),$((S*28/100)) $((S*38/100)),$((S*22/100)) 0,360" \
  -blur 0x90 -channel A -evaluate multiply 0.45 +channel hl.png
magick grad.png vig.png -compose multiply -composite hl.png -compose screen -composite master-flat.png
magick master-flat.png glyph.png -gravity center -compose over -composite icon.png
```

## Why this doesn't just plug into the script's `--bg`

The script's Android adaptive-icon path needs the background as its own
**separate flat layer** (`ic_launcher_background.png`) so the OS can mask,
crop, and pan it independently of the foreground glyph during motion
effects (parallax on unlock, icon-shape theming, etc). A highlight blob
baked at a fixed position only looks right if nothing ever moves or crops
it — which is exactly what Android's adaptive icon system doesn't guarantee.
Baking a gradient+highlight into what should be a movable background layer
can produce a visibly wrong result (the "light" appearing to shift or clip
oddly as the OS animates the icon).

**What actually works per platform:**
- **iOS / Web / legacy Android launcher icon**: these are single flat square
  images, so the full gradient+highlight+glyph composite (`icon.png` above)
  is exactly right — feed it straight into the size tables as if it were
  the source image, with `--pad 0` (it's already fully composed).
- **Android adaptive layers**: use the *plain two-color gradient* (skip the
  highlight layer) as `ic_launcher_background.png` per density, and the
  glyph alone (transparent background, safe-zone scaled) as
  `ic_launcher_foreground.png` — same as the flat-color case, just with a
  gradient PNG instead of a solid fill for the background layer.

## Contrast check, every time

A bright highlight sitting directly under a white glyph reduces the
glyph-to-background contrast right where it matters most. Always render the
composited icon at both full size and ~32px before showing it to the user —
a gradient that looks lush at 1024px can turn a cart's top edge into a gray
blur at favicon size. If that happens, either move the highlight's offset
away from where the glyph sits, or lower its opacity further.
