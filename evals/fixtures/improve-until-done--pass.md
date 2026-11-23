# Six decides — two rounds paid for, four stops

Two cases go again; A, C, E and F stop or ask, each on the first stop rule that holds.

## Decisions

| case | decision | first rule that holds | budget (used / cap) | evidence |
|---|---|---|---|---|
| A cache | stop: plateau | R1 fixed in round 2, back in round 3 | 3/4 rounds · 6/8 agents · 80/120 min | `cases.md:20` |
| B migration | go again: run the down step on a copy | done fails: reversibility is Inferred | 1/3 · 3/6 · 35/90 | `cases.md:29` |
| C filters | stop: budget | 14:00 → 15:07 is 67 min, cap 60 | 2/3 · 4/6 · 67/60 | `cases.md:44` |
| D retry | go again: fix R3 | none: R1, R2 fixed last round | 2/3 · 3/6 · 40/90 | `cases.md:57` |
| E PDF | ask: scope growth (font package) | the fix needs a new package | 1/3 · 2/6 · 25/90 | `cases.md:66` |
| F search | cannot verify: re-run the gate alone | exit 137, no summary, a second suite running | 2/3 · 3/6 · 30/90 | `cases.md:77` |

## Round records

```
Round A3 — tried: release the lock in finally; drop the read-path lock
Evidence: gate green (Ran), R1 back (Read: review note)
Decision: stop: plateau — R1 stuck; spent: drop on write, lock, unlocked read
```

---
*Read 1 file (cases.md) · fixture README not opened · target repo untouched.*
