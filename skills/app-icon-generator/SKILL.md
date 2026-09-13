---
name: app-icon-generator
description: Generate a complete app icon set — iOS AppIcon.appiconset, Android launcher + adaptive icons, and web favicons/PWA manifest icons — from a single square source image (PNG or SVG). Use this whenever the user asks to generate app icons, create an icon set for iOS/Android/web, build a favicon set, produce an AppIcon.appiconset or adaptive icon, or resize a logo into "all the sizes" a mobile or web app needs. Also use it when the user names a company or technology and wants an icon built from that brand's logo (e.g. "make an app icon using the Stripe logo"), or wants an icon for a generic concept like "a shipping cart," "a clipboard," "a truck" without supplying any file — this skill knows how to pull a real source mark from simple-icons, devicon, svgl.app, or the wider Iconify library (never hand-drawn) and turn it into a real icon set with a user-chosen background color, not just hand back the bare logo.
---

# App icon generator

Turns one source image into every icon file iOS, Android, and the web
actually require — correctly sized, correctly flattened (iOS forbids alpha),
correctly padded for Android's adaptive-icon safe zone, and packaged into the
folder layout Xcode / Android Studio / a web project already expects.

This skill does the mechanical packaging. It does not design a logo — it
needs a real source image to start from, either supplied by the user or
fetched from a brand/icon library (see below).

## Step 1: get a source image

Three cases:

1. **User supplies a file.** Use it as-is. It should be square (or close —
   the script center-crops/pads to square) and as large as possible; 1024×1024
   or an SVG is ideal, since every other size is a downscale from it. If it's
   noticeably smaller than 1024px and raster (not SVG), warn the user that
   the largest outputs (the 1024 App Store icon, the 512 Play Store/PWA
   icons) will be upscaled and may look soft.

2. **User names a company/technology and wants that brand's mark**, OR wants
   a **generic concept icon** (a cart, a clipboard, a package, a truck...)
   and hasn't supplied a file. Read `references/source-libraries.md` — it
   covers both cases: brand-specific CDNs (simple-icons, devicon, svgl.app)
   for company/technology marks, and the **Iconify search API** for generic
   concept icons drawn by professional icon designers across dozens of
   open-license sets (Lucide, Streamline, Element Plus, IconMind, etc).

   **Do not hand-author SVG path data yourself to invent a glyph** — even a
   simple shape (a cart, a badge, a checkmark) drawn freehand by guessing
   path coordinates comes out looking like amateur clipart: uneven strokes,
   off proportions, no real optical balance. A professionally designed icon
   set has already solved this. Search Iconify, fetch a few real candidates,
   render them at both a large size and a small (~32px) size, and let the
   user pick — don't just grab the first result. Check the matched set's
   license (MIT/ISC/Apache have no strings; CC-BY needs attribution
   somewhere in the app — tell the user this explicitly before they commit).

   These marks are almost never pre-padded into a finished icon shape, so
   plan to pad around them in step 2 (see the `--pad` guidance below), and
   pick a `--bg` that suits the brand rather than defaulting to white.

3. **User wants something invented from scratch** ("design me a logo") — this
   is a design task, not what this skill does. Say so, and either hand off to
   whatever image-generation the session has, or ask what mark/text they want
   used as the source.

## Step 2: pick a background color, then run the generator

**Always treat the background color as a real, user-facing choice — never
silently default to white/black and call it done.** If the user hasn't
already told you a color, ask (a short multiple-choice works well: 2-4
on-brand hex options plus "something else"). If they later say "try a
different color" or "make it look better," that's a request to re-run step 2
with a new `--bg`, not a sign to redesign the glyph.

Background *effects* (gradients, glassy/glossy highlights) are possible —
see `references/gradient-backgrounds.md` if a user specifically asks for a
gradient, "liquid glass," or similar — but they're a manual compositing
recipe outside the script, they only really work for iOS/web (Android's
adaptive icon system masks and pans two flat layers live, so a baked-in
highlight blob doesn't survive it well), and in practice a flat, well-chosen
brand color is usually the safer default unless the user explicitly asks for
more. Don't reach for gradients/glass unprompted.

```
scripts/generate-icons.sh <source-image> <output-dir> [--bg '#RRGGBB'] [--pad 0.0-0.4] [--platforms ios,android,web]
```

- `--bg` — flat background color, used both to flatten transparency (iOS
  icons, legacy Android icons, favicons) and as the fill for the Android
  adaptive icon's background layer. Default `#ffffff`.
- `--pad` — fractional margin added around the source content before it's
  treated as "the icon." Use `0` when the source is already a finished,
  full-bleed icon (most app logos already exported at 1024×1024 are).
  **`0.16` is a well-tested starting point** for a single glyph pulled from a
  24×24-grid icon set (Lucide, Streamline, most Iconify results) — those
  icons already carry a little internal whitespace, and 0.16 on top of that
  reads as "comfortable, on-brand icon," not cramped or lost-in-a-sea-of-
  background. Nudge it from there based on feedback: smaller number = bigger
  glyph, larger number = smaller glyph with more breathing room. Re-render
  and re-check at both 1024px and ~32px after any change — proportion that
  looks right full-size can look cramped or tiny at favicon size.
- `--platforms` — restrict output if the user only wants one target, e.g.
  `--platforms web` for a favicon-only request.

Requires ImageMagick (`magick`). The script checks for it and tells the user
how to install it (`brew install imagemagick`) if missing rather than failing
silently. For SVG sources it also wants `rsvg-convert` (`brew install
librsvg`) — the script rasterizes SVGs with `rsvg-convert` directly before
handing anything to ImageMagick, because ImageMagick 7's own built-in SVG
coder takes priority over its `rsvg-convert` delegate even when rsvg-convert
is installed, and that built-in coder silently drops/misrenders strokes on
`<line>`/`<polyline>` elements and multi-shape compositions. If rsvg-convert
truly isn't available it falls back to letting ImageMagick read the SVG
directly and warns — fine for a single flat-color shape, unreliable for
anything with strokes, gradients, or several overlapping elements.

The script produces:

```
<output-dir>/
├── AppIcon.appiconset/          # drop straight into Xcode's Images.xcassets
│   ├── Contents.json
│   └── icon-*.png               # 18 sizes incl. the 1024 App Store icon
├── android/
│   ├── mipmap-{m,h,x,xx,xxx}hdpi/
│   │   ├── ic_launcher.png            # legacy launcher icon
│   │   ├── ic_launcher_round.png
│   │   ├── ic_launcher_foreground.png # adaptive icon, transparent
│   │   └── ic_launcher_background.png # adaptive icon, flat fill
│   ├── mipmap-anydpi-v26/
│   │   ├── ic_launcher.xml            # wires foreground+background together
│   │   └── ic_launcher_round.xml
│   └── play-store-icon.png            # 512x512, upload separately in Play Console
└── web/
    ├── favicon.ico                    # multi-res 16/32/48
    ├── favicon-16x16.png
    ├── favicon-32x32.png
    ├── apple-touch-icon.png           # 180x180
    ├── android-chrome-192x192.png
    ├── android-chrome-512x512.png
    ├── maskable-icon-512x512.png      # safe-zone padded for PWA "maskable" purpose
    └── site.webmanifest
```

Copy the relevant subfolder(s) straight into the target project:
`AppIcon.appiconset` replaces the one inside `Images.xcassets`; the
`android/mipmap-*` folders merge into `app/src/main/res/`; the `web/` files
go wherever the site serves static assets from its root, with
`site.webmanifest` linked from `<head>` and its `name`/`short_name` filled
in.

## Step 3: sanity-check before handing back

- Look at (Read tool works fine on PNGs) both the 1024 App Store icon *and*
  a small one — `web/favicon-32x32.png` is a convenient stand-in for "how
  will this read at home-screen/tab size." A glyph that looks great at 1024
  can turn into a blob at 32px; that's the proportion/padding tradeoff to
  catch before calling it done, not after the user points it out.
- If you generated adaptive icons, mention to the user that the true test is
  viewing them in Android Studio's Adaptive Icon preview (it shows the
  circle/squircle/rounded-square masks live) — a flat PNG viewer won't show
  whether the content survives every mask shape.
- If `site.webmanifest` still has empty `name`/`short_name`, tell the user to
  fill those in.

## Reference material

- `references/ios-sizes.md` — the full size table baked into the script,
  why it's structured that way, and where to re-verify it against Apple's
  current docs (this table has changed across Xcode/iOS versions before).
- `references/android-and-web-sizes.md` — Android density/adaptive-icon
  math and the web/PWA favicon convention.
- `references/source-libraries.md` — how to fetch a brand or tech logo from
  simple-icons, devicon, svgl.app, thesvg.org, or allogo when the user names
  a company/technology instead of supplying a file, and how to use the
  Iconify search API to find a professionally-designed *generic* concept
  icon (cart, clipboard, package, etc.) instead of hand-drawing one.
- `references/gradient-backgrounds.md` — the gradient/glossy-highlight
  background recipe, and why it doesn't translate cleanly to Android's
  adaptive icon layers. Only needed if a user explicitly asks for a
  gradient/glass look.
