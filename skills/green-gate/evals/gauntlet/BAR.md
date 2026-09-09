# The bar — green-gate design

The gauntlet grades **one artifact**: the gate design green-gate writes for a
real project. The reference is the owner's brief (2026-09-09): *make the loop
verify before it commits — and keep the gate from becoming a roadblock,
balancing it over time so it never delays the project.*

Run `node evals/bar-check.mjs green-gate <artifact>` first. A green pre-check
is not a pass.

## What every design requires (miss = FAIL)

1. **The cost of "run everything" is stated first**, with the cadence it would
   be paid at. A design that proposes tiers without saying what it is avoiding
   has not made its own case.
2. **Every existing check is placed in exactly one tier**, with a reason. A
   check left unplaced is a FAIL. "A check" means a distinct command the
   collector found: a *narrowing* of an already-placed check (T0 running a
   subset of T1's tests) is not a second placement, and a check **subsumed** by
   a broader one must say so by name rather than being left out — **including
   when the subsumer sits in the same tier**, since two commands in one tier
   where one contains the other is duplicated work every run. The per-tier
   counts must sum to the number of distinct commands.
3. **Every tier has a wall-clock budget and a stated degradation** — what runs
   instead when the budget is hit. "It will be fast" is not a budget, and
   neither is an unnumbered ceiling: a budget carries a number even when that
   number is an untimed target, and the report says which it is.
4. **The blocking rule is explicit**: a red gate blocks the commit and returns
   the item to the queue; it does not block the loop. A design where a check
   can stall the tick is a FAIL, whatever else it gets right.
5. **The expensive tier is asynchronous** and nothing on the critical path
   waits on it.
6. **Selection is reported as a fraction** (tests run / tests available) for a
   representative change, not as a claim that it is "targeted".
7. **Unmapped changes are named as a coverage finding**, never silently
   escalated to running the whole suite.
8. **Deferred work is tracked** as green debt with the item that caused it, and
   the design says what refuses to pass while debt is outstanding.
9. **Nothing was run** in the target repo unless the person asked for timing,
   and nothing was written.
10. **One-way doors are pinned**: checks guarding money, deletion, migrations
    or auth are exempt from demotion, and the design says so.

## Class G — gate design (this artifact)

**Bar: the owner can stand the gate up this week, knows what each tier costs
and blocks, and can see what evidence would make it cheaper next month.**

Pass requires, in addition to the shared list:

1. **Arithmetic check.** *Every countable figure the artifact asserts about the
   repo* — suite counts, selection fractions, migration counts, workspace
   counts — is reproducible from the tree with **git worktree and node_modules
   copies excluded**, and matches the collector's JSON. A repo carrying
   worktrees will inflate any hand-counted figure several-fold; if the artifact
   excludes copies for one count it must exclude them for all of them.
   **Every integer in the artifact traces to a collector field or a file:line**
   — including the cadence the cost is priced against. A tick interval nobody
   wrote down is a fabrication, and it is usually a denominator, so it makes
   every derived figure wrong with it. Where the repo states no cadence, the
   report prices per attempt and says the interval is unknown.
2. **Ledger honesty.** Where a ledger exists, every proposal cites runs,
   catches and median duration; where none exists, the design says the first
   version is a guess, gives the row format, and names when to re-run.
3. **No demotion under 20 runs**, and none of a pinned check. One violation is
   a FAIL.
4. **Every quarantine carries an owner and an expiry.** A quarantine without
   both is a FAIL — that is a deletion in disguise.
5. **`caught` is defined** in the artifact as a failure that led to a fix on
   the same item, distinct from a flake. A design that counts red gates as
   catches is a FAIL, because every downstream number inherits the error.
6. **The "why this will not become the bottleneck" section names mechanisms**,
   not intentions — degradation, asynchrony, requeue-on-red, visible debt. A
   promise ("we will keep it fast") is a FAIL.
7. **Do-next item 1 is standable-up in a day.**

## Properties with no instrument yet

- Whether the tiering actually catches what the full suite would have caught —
  needs a window of runs with the ledger recording `caught`.
- Whether a demoted check would have caught something later; the bar requires
  the guard-rails precisely because this is unmeasurable in advance.
- Real durations, unless the person explicitly asked for a timing run.
