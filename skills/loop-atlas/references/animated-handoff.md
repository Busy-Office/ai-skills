# Handoff: a rendered video of the flow

The published page animates itself with inline SVG + CSS and needs
nothing installed. When someone wants an **MP4 / GIF** — a README hero, a
slide, a share — hand off to the `animated-svg` skill
(<https://github.com/omkamal/animated-diagrams-skill>, Apache-2.0):
semantic SVG choreographed with GSAP 3 and rendered deterministically
(headless Chrome → FFmpeg via HyperFrames) to MP4 + GIF + static SVG +
a self-contained interactive HTML player.

**It is optional and it is not cheap to install** — Node ≥ 22, ffmpeg,
Python 3, a one-time Chrome download and a `bash scripts/setup.sh`. Never
install it as a side effect of someone asking for a diagram. Offer it in
one line and let them choose.

## When to offer

| want | do |
|---|---|
| understand the loop, share a link, keep it current | the artifact page — stop here |
| a GIF in the README, a slide, a conference talk | offer `animated-svg` |
| narration synced to the beats | `animated-svg` with an SRT — it fires each beat on its cue and muxes the audio |
| a still for a doc | export the page's SVG; no pipeline needed |

## How to hand off

Check first — `~/.claude/skills/animated-svg/SKILL.md` (or an
`animated-svg` entry in the skill list). If it is absent, say what it is,
link it, and stop; do not clone or install it.

If it is present, invoke it with the flow the atlas already established,
and pass:

1. **The scene**, as the atlas's own SVG — it is already semantic
   (`node-*` / `edge-*` ids per `flow-spec.md`), which is what that
   skill's `svg_prep.py` looks for. That keeps one source of truth: the
   page and the video show the same flow.
2. **Type**: flowchart (a tick), or sequence when the lanes are actors
   handing work to each other.
3. **The beat list** — the item's journey, one beat per stage, in order,
   with the label to show at each: this is the choreography, and it is
   the part only the atlas knows.
4. **The exits**, so the ending is the real one rather than a happy path.
5. Style, aspect and duration only if the person expressed a preference;
   that skill has sensible defaults and 12 presets.

Outputs land in the caller's working directory, not in either skill's
directory. Everything it produces is a *derivative* of the page — when
the loop changes, re-run the atlas first, then re-render.

## What not to do

- Do not redraw the flow by hand for the video. Two drawings of one loop
  drift, and the reader cannot tell which is current.
- Do not let the render decide the content. If a stage is missing
  evidence, it stays a labelled gap in the video too — a polished
  animation of a flow with an invisible hole is worse than a plain
  diagram with a visible one.
- Do not add narration that asserts more than the files support.
