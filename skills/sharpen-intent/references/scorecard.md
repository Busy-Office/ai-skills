# Scorecard — can this intent steer anything?

Six dimensions, 0–5, one-line reason each citing a file, a statement or a
number from the collector. The score is a summary of the findings, never a
substitute for them.

| dimension | asks | evidence |
|---|---|---|
| **clarity** | is the change stated as an outcome for a named person? | `outcomeStatements` vs `outputOnlyStatements`, `audienceStatements`, hedge list |
| **falsifiability** | could this be shown to be wrong? | `measurableStatements`, a stated horizon, a written falsifier |
| **focus** | is there one thing now? | count of objectives; whether one is marked as the current focus; how many are "in progress" at once |
| **boundaries** | is anything deliberately excluded? | `hasNonGoals`, and whether any non-goal is tempting rather than absurd |
| **canonicity** | is there one copy, and does the actor load it? | `sources` count, `inRules`, `referencedBy` — a rules file pointing at it or not |
| **traceability** | does the work trace back to it? | `traceability.share`, and the untraced items by name |

## Anchors

| score | meaning |
|---|---|
| **5** | the dimension holds throughout, with evidence |
| **4** | holds, with one exception named |
| **3** | half the statements hold; the rest are output-only, unmeasured or duplicated |
| **2** | the dimension is present in name only (a heading with prose under it that settles nothing) |
| **1** | contradicted — two sources disagree, or the stated focus is not what the work does |
| **0** | absent: no audience, no measure, no non-goals, no canonical file, or nothing traces |

## Verdict

| mean | verdict | means |
|---|---|---|
| ≥ 4.0 | **steering** | rank against it; nothing to fix here |
| 3.0 – 3.9 | **usable** | it decides most arguments; sharpen the weakest dimension |
| 2.0 – 2.9 | **decorative** | it reads well and settles nothing; the draft rewrite is the deliverable |
| < 2.0 | **absent** | the project has no stated why; anything ranked "by priority" today is ranked by mood |

Caps: `canonicity` 0 (no file, or nothing points at it) caps at
**decorative** however well written it is — an intent no actor loads
steers nothing. `traceability.share < 0.4` caps at **usable**: the queue
is being filled from somewhere else, and that somewhere is the real
intent.

## The untraced list is the finding

Items that share no distinctive term with the intent are the honest
output of this skill. Each is one of three things, and you say which:

- the item is off-purpose → it goes to `requeue` for deletion or deferral,
- the intent is out of date and the item is right → the intent needs the
  sentence that covers it,
- the wording differs but the purpose matches → say so, and let it go.

Term overlap is a prompt, not a verdict. Never delete an item on it.
