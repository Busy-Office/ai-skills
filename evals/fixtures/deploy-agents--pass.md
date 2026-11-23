# Batch 7 — seven defects, J5 already right

Four agents were set to start at once, money code sat on a cheap model, and two briefs had no way
to stop cleanly. Fixed below; J5 stands as written.

## Defects

| defect | where | rule it breaks | fix |
|---|---|---|---|
| 4 agents in flight | `PLAN.md:13` | limit: 3 agents at once | waves below |
| refund posting on a cheap model, low effort | `PLAN.md:17` | job table: money is the strongest model, high effort | strongest model, high effort |
| decision paraphrased | `PLAN.md:22` | Decisions (verbatim) | quote the user's refund sentence |
| may push | `PLAN.md:21` | Do not touch: never push, merge or land | add it |
| no Goal; "until it is good" | `PLAN.md:26` | Goal: what is true when done | goal below |
| full suite in a subagent | `PLAN.md:45` | Test: targeted only; the coordinator runs the suite | `node --test test/filter.test.js` |
| reviewer is the builder | `PLAN.md:50` | review: fresh context or another model | fresh reviewer, diff + goal + decision |

## Fixed briefs

```
J1 Model: strongest, high effort
Decisions (verbatim): "Refunds post to 4100 Sales Returns, never netted against 4000 Sales."
Do not touch: migrations/; never push, merge or land
J2 Goal: column order unchanged; done when node --test test/export.test.js passes
J3 Test: node --test test/filter.test.js; never the full suite (the coordinator runs it)
J4 Model: a fresh context on another model, given J2's diff, its goal and the decision
```

## Launch order

1. Wave 1: J1, J2, J3.
2. Wave 2: J4 once J2 returns, with J5.
3. The coordinator runs `npm test` once, alone, after both waves.

---
*Read 1 file (PLAN.md) · nothing spawned · target repo untouched.*
