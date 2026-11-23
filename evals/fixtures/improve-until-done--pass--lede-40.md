# Batches A–F — 2 go again, 4 stop or ask

B and D each get one more round. A stops on a plateau and C stops on its minutes cap. E asks before adding a package and F runs its gate again alone. The stop rules were checked in order.

## Decisions

| batch | decision | first rule that holds | budget (used / cap) | evidence |
|---|---|---|---|---|
| A cache | stop: plateau | plateau: R1 fixed in round 2, back in round 3 | 3/3 rounds · 6/8 agents · 80/120 min | `cases.md:20` |
| B migration | go again: run 0042 down and up on real rows | none: not done, the reversible claim is Inferred; first round, so no plateau | 1/3 · 3/6 · 35/90 | `cases.md:29` |
| C filters | stop: budget | budget: 67 minutes against a cap of 60 (R1, R2 fixed, so no plateau) | 2/3 · 4/6 · 67/60 | `cases.md:44` |
| D retry | go again: fix R3 | none: R1 and R2 fixed last round | 2/3 · 3/6 · 40/90 | `cases.md:55` |
| E PDF | ask: scope growth (add the `pdf-font-embed` package) | scope growth: R1 needs a package not in package.json | 1/3 · 2/6 · 25/90 | `cases.md:66` |
| F index | cannot verify: re-run `npm run check` alone | cannot verify: the gate exited 137 with no summary beside another full suite | 2/3 · 3/6 · 30/90 | `cases.md:77` |

## Round records

```text
Round A3 — tried: release the lock in finally; drop the lock on the read path
Evidence: gate green (Ran: npm run check), R3 fixed, R1 back (Read: review note)
Decision: stop: plateau — stuck: stale read after a concurrent write; spent: drop-on-write, lock around read-then-write, lock on write only

Round B1 — tried: migration 0042 splits name, with a down step
Evidence: gate green (Ran: npm run check), 0 should-fix (Read: review note), "0042 is reversible without data loss" Inferred
Decision: go again — run 0042 down then up on a copy with real rows and compare; unproven until it runs

Round C2 — tried: exclusive end date; empty list means none; range in the account's zone
Evidence: gate green (Ran: npm run check), R1 and R2 fixed, R3 left (Read: review note)
Decision: stop: budget — open: R3, a daylight-saving day drops an hour; one more round costs about 2 agents and 30 minutes, with 2 agents and no minutes left

Round D2 — tried: exponential backoff; retry only 5xx and timeouts
Evidence: gate green (Ran: npm run check), R1 and R2 fixed, R3 left (Read: review note)
Decision: go again — fix R3, a log line per retry

Round E1 — tried: export the invoice view to PDF with the built-in renderer
Evidence: gate green (Ran: npm run check), R1 left: non-Latin names render as boxes (Read: review note)
Decision: ask: scope growth (a new package, pdf-font-embed) — may it be added?

Round F2 — tried: debounce the rebuild
Evidence: gate did not finish: exit 137 after 4 minutes, no test summary, a second full suite running (Ran: npm run check)
Decision: cannot verify — re-run npm run check alone; still cannot run, ask the user
```

---
*Read 1 file (`cases.md`) · nothing written.*
