# iOS icon sizes — where this table comes from and how to re-verify it

The sizes baked into `scripts/generate-icons.sh` are the classic full
`AppIcon.appiconset` table (per-idiom, per-scale PNGs) that Xcode has used
since asset catalogs were introduced. It still works today and is the safest
choice for a script to emit because it doesn't depend on the version of
Xcode the user has.

Since Xcode 14, Apple also accepts a **single 1024×1024 "App Store" icon**
and generates every other size itself at build time ("single size" app icon
mode in the target's asset catalog settings). If the user is on a recent
Xcode and just wants the simplest path, mention this option — it means they
only need `icon-1024@1x-ios-marketing.png` from the generated set and can
delete the rest, or you can re-run the script with a trimmed entry list.

Because Apple has changed this more than once (and could again), **verify
against the current guidance before relying on this table for a
production submission**:
- https://developer.apple.com/design/human-interface-guidelines/app-icons
- https://developer.apple.com/design/Human-Interface-Guidelines/app-icons (asset catalog reference)

## Table baked into the script (point size → pixels by scale)

| Idiom  | Purpose      | Point size | @1x | @2x | @3x |
|--------|-------------|-----------:|----:|----:|----:|
| iphone | Notification | 20pt       | —   | 40  | 60  |
| iphone | Settings     | 29pt       | —   | 58  | 87  |
| iphone | Spotlight    | 40pt       | —   | 80  | 120 |
| iphone | App          | 60pt       | —   | 120 | 180 |
| ipad   | Notification | 20pt       | 20  | 40  | —   |
| ipad   | Settings     | 29pt       | 29  | 58  | —   |
| ipad   | Spotlight    | 40pt       | 40  | 80  | —   |
| ipad   | App          | 76pt       | 76  | 152 | —   |
| ipad   | App (Pro)    | 83.5pt     | —   | 167 | —   |
| ios-marketing | App Store | 1024pt | 1024 | —  | —   |

All iOS icons must be **flattened, opaque PNGs with square corners** — Apple
applies the rounded-corner mask itself, and any alpha channel or pre-rounded
corners will be rejected or look wrong. The script flattens onto the
`--bg` color for exactly this reason; don't skip `--bg` for a logo that has a
transparent background.
