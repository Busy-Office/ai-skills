# Android and web icon sizes

## Android

Density buckets and their scale factor relative to `mdpi` (1x) have been
stable for years — this is not the kind of table that goes stale the way
per-OS-version App Store requirements can:

| Density  | Scale | Legacy launcher (px) | Adaptive layer, 108dp (px) |
|----------|------:|----------------------:|-----------------------------:|
| mdpi     | 1x    | 48                     | 108                           |
| hdpi     | 1.5x  | 72                     | 162                           |
| xhdpi    | 2x    | 96                     | 216                           |
| xxhdpi   | 3x    | 144                    | 324                           |
| xxxhdpi  | 4x    | 192                    | 432                           |

**Adaptive icons** (API 26+, required by Play Store since 2018) are two
layers — `ic_launcher_foreground` and `ic_launcher_background` — each a full
108dp square, wired together by `res/mipmap-anydpi-v26/ic_launcher.xml`. The
system masks this pair into a circle, squircle, rounded square, etc.
depending on the device's launcher, and can apply parallax between the two
layers. Only the inner 72dp is guaranteed visible, and Google's own guidance
is to keep the actual mark inside a 66dp-diameter circle so it survives every
mask shape — the script approximates this with a ~61% content fraction of
the 108dp canvas (see `generate-icons.sh`'s `safe_px` calculation).

The **Play Store listing icon** is a flat 512×512 PNG, no alpha, uploaded
separately in Play Console — not bundled into the APK.

Re-verify at: https://developer.android.com/develop/ui/views/launch/icon_design_adaptive

## Web / PWA

There's no single spec here — this is a de facto convention followed by
`realfavicongenerator.net`, Chrome, and most site scaffolding tools:

| File                          | Size    | Purpose |
|-------------------------------|--------:|---------|
| favicon.ico                   | 16/32/48 (multi-res) | Legacy browser tab icon |
| favicon-16x16.png              | 16×16   | Modern browsers, small |
| favicon-32x32.png              | 32×32   | Modern browsers, retina tab |
| apple-touch-icon.png           | 180×180 | iOS home-screen bookmark |
| android-chrome-192x192.png     | 192×192 | Android home screen / manifest |
| android-chrome-512x512.png     | 512×512 | Android splash screen / manifest |
| maskable-icon-512x512.png      | 512×512 | PWA maskable icon (`purpose: maskable`) — needs the same safe-zone padding as an Android adaptive foreground, since Android/Chrome will crop it the same way |

`site.webmanifest` ties the last three together. The generated one has empty
`name`/`short_name` — fill those in before shipping, and set `theme_color`/
`background_color` to match the app's actual palette if `--bg` was just a
placeholder.
