# The page

One published artifact, two views, in this order. First screen: the flow.
The deck is below it. Prose on the whole page ≤ 400 words.

```
# <project> — the loop and its crew          <window · collected date>

<one sentence: what fires it, what one tick does, how it ends.>

[ THE FLOW ]                                   ← inline animated SVG
  trigger → wake → select → act → verify → gate → record → re-arm/stop
  actor lanes · file names · gaps drawn as gaps
  ▸ replay      (a button, not an autoplaying loop)

| stage | actor | reads / writes | evidence |
|---|---|---|---|
| select | main actor | docs/BACKLOG.md | CLAUDE.md:6 |
| verify | — vacant — | — | no evidence in any file |

[ THE CREW ]                                   ← card grid, 3 across
  <card> <card> <card>
  <card> <card> <vacancy card>

| in the window | |
|---|---|
| summons | scout 12 · verifier 3 · <none> |
| skills invoked | tdd 4 · requeue 1 |
| subagent tokens | X of Y total |
| never summoned | <agents defined but unused> |

## What the picture shows
<≤ 5 bullets. Each names something visible in the diagram or the deck:
a vacancy, a lane that both builds and verifies, an agent defined but
never summoned, a stage with no file behind it.>

---
*Read N files and M transcripts · target repo untouched.*
```

## Rules

- **The table under the diagram is not optional.** The picture carries
  the shape; the table carries the file names, and the file names are
  what make it checkable.
- **Draw what is there, then what is missing.** Vacancies and evidence-
  free stages are rendered, labelled, and listed. A tidy diagram of a
  loop with a hole in it is a lie told in a nice font.
- **No autoplay loop.** Play once on load, then a replay control.
- **Theme-aware and reduced-motion-safe**, per `flow-spec.md`.
- **The deck is ordered by observed use**, most-summoned first, with
  never-summoned and vacancies last — so the page ranks the crew by what
  the loop actually does rather than by what was written down.
- **Footer receipt** — files read, transcripts read, window, repo
  untouched.

## Terminal summary (≤ 8 lines)

The flow in one sentence, the count of stages with no evidence, the crew
size and the most-summoned agent, any vacancy, and the page URL.
