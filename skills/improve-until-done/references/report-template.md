# The decisions

The reply at a Decide, for one batch or several: one table row per batch, then its round record.
Prose outside tables and code: **≤ 400 words**, so six round records fit even written as plain
lines.

````markdown
# <the batches> — <N go again, N stop or ask>

<≤ 40 words: which batches get one more round, which stop, and that the stop rules were checked in
order.>

## Decisions

| batch | decision | first rule that holds | budget (used / cap) | evidence |
|---|---|---|---|---|
| A cache | stop: plateau | R1 fixed in round 2, back in round 3 | 3/3 rounds · 6/8 agents · 80/120 min | `cases.md:20` |
| D retry | go again: fix R3 | none: R1 and R2 fixed last round | 2/3 · 3/6 · 40/90 | `cases.md:57` |

## Round records

```text
Round A3 — tried: <the change, one line>
Evidence: gate green (Ran: <command>), R1 back (Read: review note), <claim> Inferred
Decision: stop: plateau — <what is stuck; the approaches spent>
```

---
*Read N files (<names>) · <what was written, or: nothing written>.*
````

- **decision** is one of: `go again: <the finding it aims at>`, `stop: done`, `stop: plateau`,
  `stop: budget`, `ask: scope growth (<what>)`, `cannot verify: <the re-run>`.
- **first rule that holds**: the stop rules checked in order; `none` for a go-again, with the
  progress that rules plateau out.
- **budget**: rounds, agents spawned and minutes from the `date` shown, each against its cap.
- **evidence**: the `file:line` the decision rests on.
- **Round records**: one three-line record per row, in the table's order. Each stop's record
  carries its report: plateau, what is stuck and the approaches spent; budget, what is open and
  what one more round costs; scope growth, what is asked; cannot verify, the re-run alone.
- **Receipt**: every file read, by name.
