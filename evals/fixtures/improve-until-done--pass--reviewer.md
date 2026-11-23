# Six batches — the next decision for each

Stop rules checked in order (done, plateau, budget, scope growth, cannot verify); the first that holds decides.

## Decisions

| batch | decision | first rule that holds | budget (used / cap) | evidence |
|---|---|---|---|---|
| A cache invalidation | stop: plateau | R1 fixed in round 2, back in round 3 | 3/3 rounds · 6/8 agents · 80/120 min | `cases.md:20` |
| B reversible migration | go again: run the down step on a copy | done fails: "0042 is reversible" is Inferred | 1/3 · 3/6 · 35/90 | `cases.md:29` |
| C report filters | stop: budget | 14:00 to 15:07 is 67 min, cap 60 | 2/3 · 4/6 · 67/60 | `cases.md:44` |
| D retry on upload | go again: fix R3 | none: R1 and R2 fixed last round | 2/3 · 3/6 · 40/90 | `cases.md:57` |
| E PDF export | ask: scope growth (pdf-font-embed) | the fix needs a package not in package.json | 1/3 · 2/6 · 25/90 | `cases.md:66` |
| F search index | cannot verify: re-run the gate alone | exit 137, no summary, a second suite running | 2/3 · 3/6 · 30/90 | `cases.md:77` |

## Round records

Round 3 — tried: release the lock in finally; drop the lock on the read path
Evidence: gate green (Ran: npm run check), R3 fixed, R1 back (Read: review note, cases.md:20)
Decision: stop: plateau — R1 was fixed in round 2 and came back; spent: drop on write, lock, unlocked read. Budget 3/3 rounds, 6/8 agents, 80/120 min.

Round 1 — tried: migration 0042 with a down step
Evidence: gate green (Ran: npm run check), 0 should-fix (Read: review note), "0042 is reversible" Inferred (cases.md:29)
Decision: go again — run the down step on a copy and compare the data; not done while the claim is Inferred. Budget 1/3, 3/6, 35/90 min.

Round 2 — tried: exclusive end date; empty list means none; account zone
Evidence: gate green (Ran: npm run check), R3 left (Read: review note)
Decision: stop: budget — 14:00 to 15:07 is 67 min against a 60-minute cap (cases.md:44); R3 open; one more round costs about 2 agents and 30 min.

Round 2 — tried: exponential backoff; retry only 5xx and timeouts
Evidence: gate green (Ran: npm run check), R1 and R2 fixed, R3 left (Read: review note)
Decision: go again — fix R3. Progress last round, 2/3 rounds, 3/6 agents, 40/90 min (cases.md:57).

Round 1 — tried: export with the built-in renderer
Evidence: gate green (Ran: npm run check), R1 left (Read: review note)
Decision: ask: scope growth (a font-embedding package, pdf-font-embed, not in package.json; cases.md:66). 1/3, 2/6, 25/90 min.

Round 2 — tried: debounce the rebuild
Evidence: gate exited 137 with no summary while another suite ran (Ran: npm run check; cases.md:77)
Decision: cannot verify — re-run the gate alone before judging it red; still cannot run, ask. 2/3, 3/6, 30/90 min.

---
*Read 1 file (cases.md) · nothing else written.*
