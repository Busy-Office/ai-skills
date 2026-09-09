# The report

Numbers first, then where they go, then the cuts. Prose outside tables and
code: **≤ 300 words**.

```markdown
# Wake weight — <project>

<≤ 40 words: what a run pays before it starts, across how many ticks, and the
one file responsible.>

| | |
|---|---|
| files loaded at wake | N |
| **per tick** | **~Xk tokens** (estimated from characters) |
| across the window | ~X.XM over N ticks |
| share of measured spend | 0.XX — *only when loop-economist has run the same window* |
| projected in 90 days | ~Xk per tick at current growth |

## What is loaded

| file | lines | ~tokens | share | class | why it is loaded | grew |
|---|---|---|---|---|---|---|
| docs/DESIGN-GRAPH.md | 1 539 | 69k | 0.40 | map | named in CLAUDE.md:47 | +0 |
| docs/LOOP-STATUS.md | 496 | 50k | 0.29 | record | named in loop.ps1 | +166 in 84 commits |

Sorted by weight. Every row says **why** it is in the wake — the file and line
that pulls it in — because that is where the cut is made.

## The cuts

| # | cut | file | saves / tick | saves / window | cost | risk |
|---|---|---|---|---|---|---|
| 1 | archive done items past 500 lines | docs/BACKLOG.md | ~34k | ~1.8M | one rule | none |
| 2 | read the last 30 lines | docs/LOOP-STATUS.md | ~47k | ~2.5M | one rules line | a sentinel grep would break — check first |

Ordered by saving. Each names its cost and its risk; a cut with no stated risk
has not been thought about.

## What not to cut

<≤ 3 bullets: what is small and load-bearing, and anything whose absence turns
into re-derivation — with the tool-calls-per-edit number if it is known.>

## Do next (≤ 3)

1. …

---
*Read N files · token figures estimated from character counts · target repo untouched.*
```

## Terminal summary (≤ 6 lines)

Per-tick weight and the window total, the one file responsible, the top cut
with its saving, and the projection if nothing changes.
