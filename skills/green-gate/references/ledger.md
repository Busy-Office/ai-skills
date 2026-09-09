# The ledger — how the gate gets cheaper over time

A gate that is never measured only ever grows: every incident adds a check and
nothing ever removes one. The ledger is what lets the gate *shrink* on
evidence, and it is the difference between a gate that stays proportionate and
one that becomes the project's slowest step.

One append-only JSONL file, one row per check run. `docs/gate-ledger.jsonl` (or
`.claude/gate-ledger.jsonl`) — wherever the loop already keeps its records.

```json
{"ts":"2026-09-09T10:14:02Z","tier":"T1","check":"unit:apps/liff","item":"QA-P2-06",
 "durationMs":18412,"blockedMs":18412,"selected":14,"ofTotal":518,
 "result":"pass","caught":false,"flake":false,"degraded":null}
```

| field | why it is there |
|---|---|
| `check` | the unit of decision — a suite or a named group, not an individual test |
| `durationMs` / `blockedMs` | what it cost, and how much of that the loop waited on. They differ for T2 |
| `selected` / `ofTotal` | proportionality: is the gate running 14 tests or 518? |
| `result` | pass · fail · error · skipped |
| **`caught`** | the field the whole system turns on: did this failure correspond to a real defect that then got fixed? |
| `flake` | failed, then passed with no change to the code |
| `degraded` | what was skipped when a budget was hit |

## `caught` is the hard one, and it must not be guessed

A failing check is not the same as a caught defect. Set `caught: true` only
when the failure led to a change in the code before the item was closed. The
loop can determine this: a red gate, then an edit, then a green gate, on the
same item. A red gate followed by a rerun that passes is a **flake**, not a
catch. Getting this distinction wrong corrupts every decision below it, so
where it cannot be determined, leave it `null` and let the run count for
duration only.

## What the numbers say

For each check over the window:

- **catches per minute** = real catches ÷ total minutes spent running it. The
  ranking number. A check with 0 catches over 20+ runs is buying nothing today.
- **flake rate** = flakes ÷ runs. Above ~0.1 the check is costing more in
  distrust and reruns than it returns.
- **selection rate** = selected ÷ total. Below ~0.2 is a proportionate gate;
  near 1.0 means the gate is not selecting at all.
- **blocked minutes per tick** = the loop's wait. The number the whole design
  is trying to keep near zero.

## The rebalance, and its guard-rails

Run it on a cadence — every 50 gate runs, or monthly. It proposes; a person or
the deploy gate accepts.

| proposal | when | effect |
|---|---|---|
| **promote** | real catches, median under ~30 s | move it earlier — it earns a place in the fast path |
| **keep** | catching things at an acceptable cost | no change |
| **demote** | 20+ runs, 0 catches, slow | move down a tier, or to a nightly batch |
| **quarantine** | flake rate ≥ 0.1 | out of the gate, **with an owner and an expiry date** |

Three rules keep this from eating the safety net:

1. **Never demote on fewer than 20 runs.** Below that the evidence is noise,
   and the collector says `keep — not enough evidence yet` rather than acting.
2. **Never demote a check that guards a one-way door** — money movement, data
   deletion, migrations, auth. Those keep their place regardless of catch rate,
   because the cost of the miss is not measured in minutes. Mark them
   `pinned: true` in the ledger and the rebalance leaves them alone.
3. **Quarantine expires.** An entry without an owner and a date is not a
   quarantine, it is a deletion with extra steps. Expiry turns it back into a
   queue item.

## What this looks like after a month

The gate that started as "run everything" becomes: a 90-second inner loop that
catches most of what is caught, a 5-minute commit gate on the touched
workspace, and an asynchronous deep tier holding the expensive suites that
nothing waits on — with a written record of which checks earned their place.

That is the point. Not a faster gate: a gate whose cost is proportionate to
what it is actually catching, and that keeps getting more proportionate as the
evidence accumulates.
