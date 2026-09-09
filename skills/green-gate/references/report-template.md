# The report

What exists, what it would cost to gate with, what the gate should be, and what
the evidence says to change. Prose outside tables and code: **≤ 350 words**.

```markdown
# Gate design — <project>

<≤ 50 words: what checks exist, what runs them today, and the one thing that
would make a gate too slow to keep.>

| | |
|---|---|
| checks available | N (unit, e2e, typecheck, lint, build) |
| test files | N unit · N e2e |
| runs them today | CI workflow / the loop / **nothing** |
| ledger | present (N runs) / **absent** |
| blocked minutes per tick | X — or *not measured yet* |

## The gate

| tier | runs | scope | budget | blocks |
|---|---|---|---|---|
| T0 inner | every attempt | typecheck touched pkg + selected unit tests | 90 s | nothing — it is advice to the builder |
| T1 commit | before commit | touched workspace unit + lint | 5 min | **the commit**, never the loop |
| T2 deep | every N ticks / pre-deploy | e2e, cross-workspace, build | none — asynchronous | a deploy, via green debt |

**Selection:** T1 would run <n> of <total> unit tests for a typical change
(<rate>). <One line on what is unmapped.>

## What the ledger says

| check | runs | catches | median | catches/min | flake | proposal |
|---|---|---|---|---|---|---|
| unit | 30 | 3 | 18 s | 0.33 | 0.00 | **promote** |
| e2e | 24 | 0 | 420 s | 0.00 | 0.00 | **demote** — 168 min spent, nothing caught |
| e2e:checkout | 20 | 0 | 90 s | 0.00 | 0.25 | **quarantine** — owner and expiry required |

<Or: "No ledger yet. The first version of the gate is a guess; here is the
ledger row to start writing, and what to re-run this with in 50 runs.">

## Why this will not become the bottleneck

<≤ 4 bullets, each naming a mechanism: what degrades on budget breach, what is
asynchronous, what happens to a red gate, how deferred work stays visible.>

## Do next (≤ 4)

1. …

---
*Read N package manifests, N test files and a ledger of N runs · no project
command was run · target repo untouched.*
```

## Terminal summary (≤ 8 lines)

What the gate would be, the selection rate, blocked minutes per tick, the one
check the ledger says to demote or quarantine, and the first thing to do.
