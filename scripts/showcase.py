#!/usr/bin/env -S uv run --quiet --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["playwright>=1.55"]
# ///
"""Capture the README showcase images from docs/showcase/pages/*.html.

    uv run scripts/showcase.py                  # shoot every page
    uv run scripts/showcase.py loop-atlas       # shoot one
    uv run scripts/showcase.py --gif loop-atlas # animated GIF of .flow

Pages are captured from file:// — no login, no publishing, deterministic.
Full page, 2x device pixel ratio, animations frozen on their final frame
(the pages honour prefers-reduced-motion, which is what a still should show).

--gif steps the page's own CSS animations frame by frame through the Web
Animations API rather than screenshotting in real time, so the GIF is
reproducible and its timing is exactly the page's. Encoding needs ImageMagick.

The only dependency is declared above: `uv run` builds the environment on
first use and reuses it after. If Chromium is missing, uv will say so — run
`uv run --with playwright playwright install chromium` once.
"""

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PAGES = ROOT / "docs" / "showcase" / "pages"
OUT = ROOT / "docs" / "showcase"

VIEWPORT = {"width": 1180, "height": 1000}
SCALE = 2
GIF_SELECTOR = ".flow"  # the element --gif records


def shoot(browser, name: str, frames: int = 0) -> bool:
    src = PAGES / f"{name}.html"
    if not src.exists():
        print(f"✗ no such page: {name}", file=sys.stderr)
        return False

    ctx = browser.new_context(
        viewport=VIEWPORT,
        device_scale_factor=1 if frames else SCALE,
        color_scheme="light",
        # A still of an animated page should be its final, complete frame — the
        # pages are authored so reduced-motion lands exactly there.
        reduced_motion="no-preference" if frames else "reduce",
    )
    page = ctx.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(src.as_uri(), wait_until="load")
    page.evaluate("document.fonts && document.fonts.ready")

    if frames:
        target = page.query_selector(GIF_SELECTOR)
        if target is None:
            print(f"✗ {name}: no {GIF_SELECTOR} to record", file=sys.stderr)
            ctx.close()
            return False
        if not shutil.which("magick"):
            print("✗ --gif needs ImageMagick (brew install imagemagick)", file=sys.stderr)
            ctx.close()
            return False

        # Freeze the page's own animations and step them: reproducible timing.
        duration = page.evaluate("""() => {
          const anims = document.getAnimations();
          anims.forEach((a) => a.pause());
          return Math.max(0, ...anims.map((a) => {
            const t = (a.effect && a.effect.getComputedTiming) ? a.effect.getComputedTiming() : {};
            return (t.delay || 0) + (t.activeDuration || 0);
          }));
        }""")
        step = duration / frames
        with tempfile.TemporaryDirectory(prefix=f"showcase-{name}-") as tmp:
            shots = []
            for i in range(frames + 1):
                page.evaluate(
                    "(t) => document.getAnimations().forEach((a) => { a.currentTime = t; })",
                    i * step,
                )
                shot = str(Path(tmp) / f"{i:03d}.png")
                target.screenshot(path=shot)
                shots.append(shot)
            out = OUT / f"{name}.gif"
            subprocess.run(
                ["magick", "-loop", "0", "-delay", str(round(step / 10)), *shots,
                 "-delay", "220", shots[-1],            # hold on the finished picture
                 "-layers", "OptimizeTransparency", "-fuzz", "2%", str(out)],
                check=True,
            )
        print(f"✓ {name}.gif — {frames + 1} frames · {duration / 1000:.1f}s of page time")
    else:
        page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)
        size = page.evaluate("""() => ({
          w: document.documentElement.scrollWidth,
          h: document.documentElement.scrollHeight,
        })""")
        print(f"✓ {name}.png — {size['w'] * SCALE}×{size['h'] * SCALE}")

    ctx.close()
    if errors:
        print(f"  ! page errors: {' | '.join(errors[:3])}", file=sys.stderr)
    return True


def main() -> int:
    args = sys.argv[1:]
    frames = 0
    if "--gif" in args:
        after = args[args.index("--gif") + 1:]
        frames = int(after[0]) if after and after[0].isdigit() else 44
    names = [a for a in args if not a.startswith("--") and not a.isdigit()]
    targets = names or sorted(p.stem for p in PAGES.glob("*.html"))

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ok = all([shoot(browser, n, frames) for n in targets])
        browser.close()
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
