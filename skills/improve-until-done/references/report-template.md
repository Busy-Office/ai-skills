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
| <batch> | stop: <the rule> | <the rule that holds, and the evidence for it> | <n>/<cap> rounds · <n>/<cap> agents · <n>/<cap> min | `<file>:<line>` |
| <batch> | go again: <the finding it aims at> | none: <the progress that rules plateau out> | <n>/<cap> · <n>/<cap> · <n>/<cap> | `<file>:<line>` |

## Round records

```text
Round <batch><n> — tried: <the change, one line>
Evidence: <each result with its grade: Ran: <command>, Read: <note>, or Inferred>
Decision: <the decision> — <its report, per the list below>
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
