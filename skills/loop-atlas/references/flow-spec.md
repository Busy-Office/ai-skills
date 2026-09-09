# The complete flow

One picture of one whole tick, from the thing that fires it to the thing
that re-arms or stops it — with the actor on every step and the file name
under every claim. If a reader has to ask "and then what happens?", the
picture failed.

## What must be on it

| element | shown as | source |
|---|---|---|
| **trigger** | the entry, labelled with the real cadence | `flow.stages.trigger` |
| **stages** | trigger → wake → select → act → verify → gate → record → re-arm/stop | `flow.stages` |
| **actor per stage** | the card name on the stage, or `main actor` | roster + `observed.summons` |
| **artifact per stage** | the file it reads or writes, by name | the evidence lines |
| **the loop-back edge** | re-arm, drawn as an edge that returns | trigger + stop |
| **the exits** | every way a tick ends: done, gate, budget, error, stop sentinel | `stages.stop`, gate evidence |
| **the empty stages** | drawn as a **gap**, dashed and labelled *no evidence* | `emptyStages` |

The gaps are the point. A flow drawn only from what exists looks
healthy; a flow that shows `gate — no evidence in any file` tells the
reader something they can act on today.

## Layout

Left-to-right for the tick; the re-arm edge returns underneath. Actors as
horizontal lanes when there is more than one, so the hand-offs cross lanes
visibly — a stage where the same lane both builds and verifies is a
picture of the verifier problem, and needs no caption.

Keep it to one screen. If the tick has more than ten stages, the extra
detail belongs in the row table under the picture, not in the diagram.

## Animation, and when it is worth it

Animate the **journey of one item** through one tick: the item enters at
select, moves stage to stage, the edge it travels lights up, and the exit
it takes at the end is the one the files actually produce. Nothing else
moves. One pass, 8–14 seconds, then it holds on the finished picture.

Rules:

- **The static frame must be complete.** The animation adds sequence, not
  information. A reader with motion disabled loses nothing — honour
  `prefers-reduced-motion` by jumping to the final frame.
- **One moving thing at a time.** Two pulses on two edges cannot be read.
- **Time is not to scale**, so do not imply it is. If stage durations are
  known from run evidence, put the numbers in the table, not in the
  timing of the animation.
- **Loop it, but pause between passes.** A continuously cycling diagram
  is unreadable and exhausting on a page someone keeps open.

Skip the animation entirely when the flow has fewer than four stages, or
when the reader asked for a reference picture rather than an explanation.

## Technique for the published page

Self-contained inline SVG, animated with CSS — no library, nothing
fetched:

- Author the SVG semantically: `id="stage-verify"`, `class="edge"`,
  `class="pulse"`. The ids are what make the page editable later, and
  they are what the `animated-svg` handoff needs.
- Draw-on edges: `stroke-dasharray` + `stroke-dashoffset` animated to 0.
- The item pulse: a small circle on `<animateMotion>` along the edge
  path, or a CSS `offset-path` on the same `d`.
- Stage entrances: staggered `opacity`/`transform` with per-stage
  `animation-delay`.
- Theme: define colours as CSS custom properties on `:root`, redefine
  under `@media (prefers-color-scheme: dark)` and `:root[data-theme=…]`.
  Stroke and text must both flip; a diagram that vanishes in dark mode is
  the most common artifact defect.
- Wide diagrams scroll inside their own `overflow-x:auto` container; the
  page body never scrolls sideways.

```css
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; }
  .edge { stroke-dashoffset: 0 !important; }
  .stage { opacity: 1 !important; transform: none !important; }
}
```

For a video or GIF of the same flow, see `animated-handoff.md` — the
semantic ids above are exactly what that pipeline expects.
