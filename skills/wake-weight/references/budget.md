# Reading the weight

## The three numbers

1. **Per tick** — what the preamble costs before any work starts.
2. **Across the window** — per tick × ticks. This is the number that decides
   whether anyone acts.
3. **Projected** — at the current growth rate, what it will cost in 90 days.
   Growth is the argument for acting now rather than later.

Say all three, and say the estimate is an estimate: token figures come from
character counts (~4 chars/token for markdown), not from a bill. Where
`loop-economist` has run on the same window, quote the preamble as a share of
measured billable spend instead — that is a real number and far more persuasive.

## Bands

Per tick, for a loop that runs unattended:

| preamble | reads as |
|---|---|
| < 10k | lean — nothing to do here |
| 10–30k | normal for a project with rules, a queue and a map |
| 30–80k | heavy: one file is usually doing it; name that file |
| > 80k | the preamble is the project's main expense — it will exceed the work itself on short ticks |

These are orientation, not law. What matters is the **share**: preamble ÷
measured spend for the window. Above ~0.25, the loop pays more to prepare than
a re-read of the codebase would cost, and the cuts pay for themselves in days.

## What each class means when it dominates

| class | dominating means |
|---|---|
| **queue** | the loop reads its whole backlog to pick one item — archive, or read the top section only |
| **record** | history is being re-read as if it were state — split the resume from the log |
| **map** | a design graph or architecture doc is loaded every tick — check how often it is actually used before cutting |
| **rules** | rare, and usually duplication rather than size — look for the same rule in three files |
| **playbook** | a handbook read every tick — almost always on-demand material |

## Growth is the finding

A file that grows every tick charges its growth to every future run. Report
`net lines added` in the window and the commits that added them; a record file
with 84 commits and +166 lines is a loop appending to its own read cost.

The projection is deliberately crude — current growth, extrapolated. It is not
a forecast; it is an argument for a threshold rule.

## Honesty

- Estimated tokens are labelled as estimates, every time.
- A file loaded conditionally is not part of the wake; say which files you
  could not prove are read every tick, rather than counting them silently.
- The collector infers "read at wake" from rules that name a file on a line
  with a read verb. That is a heuristic. If the loop's driver reads something
  the rules never mention, this misses it — say so in the receipt.
