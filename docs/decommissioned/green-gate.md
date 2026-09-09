# green-gate — decommissioned 2026-09-10

A skill that designed a project's verification gate: three tiers by what a
change touches, budgets that degrade rather than hang, and a ledger that made
the gate cheaper over time by demoting checks that caught nothing.

**Kept:** the load-bearing 20% now lives in `loop-economist`'s
[`references/patterns.md`](../../skills/loop-economist/references/patterns.md),
under *Verifier seam* — the blocking rule, the two-tier split, selection as a
fraction, degradation on breach, pinned one-way doors, and mirroring existing
CI.

**Dropped:** the ledger and the rebalance (promote / keep / demote /
quarantine, ranked by catches per minute), per-change test selection from an
import-name scan, and polyglot check discovery across package.json, Makefile,
pyproject.toml, go.mod, Cargo.toml, Gradle/Maven, Gemfile and composer.json.

## Why

Not because the model was wrong. Across **five blind-critic rounds the design
was never faulted** — the tiering, the blocking rule, budgets-with-degradation,
`caught`-versus-flake and the rebalance guard-rails passed every time. What
failed, five times out of five, was the **artifact**: numbers the skill left to
whoever was writing the report.

| round | target | failed on |
|---|---|---|
| 1 | private project | a selection fraction that described a tier the design forbids |
| 2 | private project | T1 scoped to "the touched workspace's tests" ran no unit suite for the two workspaces holding 88 of 134 unit files |
| 3 | private project | a migration count inflated 3.7× by git-worktree copies — the same duplication the artifact excluded elsewhere |
| 4 | private project | a **fabricated cadence**: "every 30-minute tick", which nothing in that repo declares, used as the denominator of the opening cost argument |
| 5 | public fixture | first test of the ledger path: a quarantine with no owner and no expiry, **falsely self-certified** as carrying both; an asynchrony claim contradicted by 168 blocked minutes in the ledger it cited |

Each fix was the same shape — move a figure out of the writer's hands and into
the collector or the instrument. That worked (`bar-check` gained `--collector`
cross-checks, a caps rule, and a cadence-sourcing rule, all of which now protect
every other skill), but the skill still could not reliably produce a correct
report, and shipping one that cannot is worse than not shipping it.

## If you rebuild it

Two things would have to be true first:

1. **The collector emits the draft.** Tier table, placement with its sum, ledger
   table, and rebalance rows with owner and expiry as required slots that fail
   loudly when blank. The writer contributes judgement and prose, never
   arithmetic. Every round-5 finding was mechanically preventable.
2. **`bar-check` gains two rules the round-5 critic specified:** compare any
   "asynchronous / nothing waits" claim against the ledger's `blockedMs`, and
   require a quarantine row to carry a date and an owner token.

Then the ledger is worth having: it is the only mechanism that makes a gate
*shrink* on evidence rather than ratchet up after every incident. That is the
half of this that a prescription cannot replace, and the reason to come back to
it when a real gate is running and someone is waiting on it.
