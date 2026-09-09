# Tiers — a gate that cannot become the bottleneck

A gate exists to stop bad work landing. The moment it also stops *good* work
landing, it has become the thing it was meant to prevent. Everything here is
built around one rule:

> **The gate blocks the commit. It never blocks the loop.**

A red gate means *this item goes back to the queue with the failure text
attached*, and the next tick picks up different work. A loop that sits waiting
on a check has been converted into a queue of one.

## Read the CI before designing anything

If the project already has CI, it has already made tiering decisions — and
under real pressure, which makes them better evidence than anything you can
reason out. Read it first and **mirror it**:

- Which checks run in a fast job, and which are separated out because they are
  slow? That separation *is* the T1/T2 line, already drawn by someone who knew
  the codebase.
- Is the slow suite **sharded**? Then the project has already met the
  wall-clock problem, and the shard count tells you what it costs.
- What gates the deploy? That is the one place blocking is already accepted.

A gate design that ignores existing CI creates a second, competing definition
of "green" — and when the two disagree, people believe neither. The right
output is usually **the same tiers CI already has, brought forward to the
tick**, plus the ledger CI does not keep.

## The three tiers

| tier | when | scope | budget | on breach |
|---|---|---|---|---|
| **T0 · inner** | every attempt, before the diff is even complete | typecheck the touched package + the unit tests that name the changed modules | **90 s** | drop the typecheck of untouched packages; never skip the selected tests |
| **T1 · commit** | before the commit lands | the touched workspace's unit suite + lint | **5 min** | fall back to T0's selection, record `gate-degraded`, and commit with the degradation named in the message |
| **T2 · deep** | off the critical path — every N ticks, before a deploy, or on a cadence | end-to-end, cross-workspace, build | **no budget, because nothing waits on it** | a failure opens a follow-up item; it does not roll back the tick that caused it |

T0 and T1 are synchronous and small. **T2 is asynchronous and is the only place
the expensive things live.** That split is what keeps a 284-spec end-to-end
suite from turning a 30-minute tick into a three-hour one.

## Choosing what runs, per change

Selection beats scheduling. A change to one module should run the tests that
name that module, not the suite that contains them:

1. Map changed files → tests that reference them (`selection.md`).
2. Add the touched workspace's own fast checks.
3. Anything a change *cannot* be mapped to runs in T2, not T1 — an unmapped
   change is a coverage gap, and the report says so rather than paying for the
   whole suite to cover it up.

Report the selection rate honestly: "T1 ran 14 of 518 unit tests" is the
number that says whether the gate is proportionate.

## Budgets, and what happens when they are hit

Every tier has a wall-clock ceiling. When it is hit the gate **degrades, it
does not hang**:

- record the outcome as `gate-degraded` with what was skipped,
- run the cheaper tier and let the commit proceed on that basis,
- put the skipped check into T2's next batch.

A degradation is a fact in the ledger, not a failure. Three degradations in a
row on the same check is the signal to re-tier it, and the rebalance does that
automatically (`ledger.md`).

## Deferred work is debt, and debt is visible

Anything T2 deferred goes on a **green-debt** list with the item that caused
it. The list is read at the deploy gate. Debt that nobody ever pays turns the
gate into theatre, so the rule is: **a deploy gate refuses to pass with green
debt older than one cycle**, and that refusal is the one place a check is
allowed to block.

## The two numbers to watch

- **time-to-signal** — change → verdict. This is what a person feels. Optimise
  T0 for it.
- **blocked-minutes per tick** — how long the loop waited on a check. The
  target is near zero; if it is not, the tiering is wrong, not the tests.

Both go in the ledger every run, because a gate that is not measured drifts
back to running everything.

## Failure modes this design is avoiding

| failure | what it looks like | what prevents it here |
|---|---|---|
| **the stall** | 284 e2e specs on every tick | T2 is asynchronous and unbudgeted, off the critical path |
| **the rubber stamp** | gate always green, catches nothing | catches-per-minute in the ledger; a check with none gets demoted |
| **the flake tax** | reruns, distrust, "just merge it" | flaky checks are quarantined with an owner *and an expiry* |
| **the graveyard** | quarantine list grows forever | quarantine entries expire and become queue items |
| **the ratchet** | every incident adds a check, none is ever removed | the rebalance can demote, and is expected to |
