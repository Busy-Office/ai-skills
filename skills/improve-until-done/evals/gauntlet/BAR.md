# The bar — improve-until-done decisions

The gauntlet grades **one artifact**: the decisions improve-until-done writes for batches at their
Decide step, each with its round record. The reference is the skill's own stop rules
(`principle-stop-on-a-rule`): checked in order, the first that holds decides, and a round that hits
none goes again.

Run `node evals/bar-check.mjs improve-until-done <artifact>` first for the mechanical rows. A green
pre-check is not a pass. The answer key is the fixture's
[`README.md`](../../fixtures/six-decides/README.md); the run under test reads only `cases.md`.

## What every decision requires (miss = FAIL)

1. **The stop rules in order.** The reason names the first rule that holds: done, plateau, budget,
   scope growth, cannot verify. A later rule cited while an earlier one holds is a FAIL.
2. **The budget in counted units.** Rounds, agents spawned and minutes from the `date` shown, each
   against its cap. "Within budget" with no numbers is a FAIL.
3. **Done means all three.** Gate green, no should-fix finding, every claim Ran or Read. A clean
   review resting on an Inferred claim is not done: it goes again to run or read the claim, or stops
   with the claim reported **unproven**.
4. **Each stop carries its report.** Plateau: what is stuck and the approaches spent. Budget: what
   is open and what one more round would cost. Scope growth: the contract, package or permission,
   asked about, not built. Cannot verify: the check re-run alone before anything is judged red.
5. **Go again aims at a finding** and changes the approach where the last try failed.
6. **One three-line record per decision**: `tried:`, `Evidence:` with each claim graded,
   `Decision:`.
7. **Nothing else written or opened.** Only the artifact is written; the receipt names the files
   read, and the fixture's README (the answer key) is not among them.

## Class X — a set of Decides (the six-decides fixture)

**Bar: the owner can read each case's line and know whether one more round will be paid for, and
why, without reading the rounds.**

Pass requires, in addition to the shared list:

1. **Every case lands on the README's decision.** One miss is a FAIL. Case D is the control: a run
   that stops it fails, however careful its other stops.
2. **Every decision row cites its case line** (`cases.md:<line>`), and the line holds the evidence
   the decision rests on. The critic opens three at random.
3. **Plateau is told from slow progress.** Case A's plateau names the finding that came back; case
   D's go-again names the progress that rules plateau out.
4. **Minutes are computed, not eyeballed.** Case C's stop shows the start time, the `date`, and the
   cap.

## Properties with no instrument yet

- Whether the stop rules pick the cheapest path on real batches: that needs rounds logged across
  many batches (`loop-economist`'s measurement).
- Whether a go-again's "changed approach" is really different: a judgement the critic records but
  cannot measure.
