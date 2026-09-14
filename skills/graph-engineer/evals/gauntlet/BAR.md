# The bar — graph-engineer graph review

The gauntlet grades **one artifact**: the graph review graph-engineer writes
for a linear agent, an existing Workflow script, or a job of unknown size.
The reference is the owner's brief (2026-09-14): *assist an engineer to do
graph engineering — cut the arrows that carry no data, fan out what is
independent, merge only where the whole set is needed, verify on the edge,
make cycles converge, tier the models, and say what it costs. Produce the
script; never launch it unasked.*

Every criterion is measurable on the artifact alone, or on the artifact plus
the fixture it was drawn from. A critic who has not seen the build must be
able to grade it.

Run `node scripts/graph-lint.mjs <script>` first, on the script inside the
artifact: it settles the mechanical rows (`G` ids — forbidden calls, unfiltered
barriers, agent-as-plumbing, unbounded loops, dedupe against confirmed, phase
inside a stage, silent caps) with line numbers. **A clean lint is not a pass**
— a script can be perfectly shaped and still draw the wrong graph. The
criteria below are what the critic adds.

## What every review requires (miss = FAIL)

1. **Diagram first.** A mermaid graph with an id on every node, ≤ 60 words
   before it. A review that opens with prose, or whose diagram has unnamed
   nodes, is a FAIL.
2. **Every edge names what crosses it.** The edge table gives the variable
   (or `none`) for every arrow in the source chain; an arrow with `none` is
   cut, not kept. An edge described by order ("B after A") is a FAIL.
3. **Every barrier carries its cross-item need, or is removed.** For each
   `parallel()` or awaited full set, the barrier table states the operation
   that needs all prior results at once (cross-set dedupe, early exit on the
   total, a prompt comparing against the others). A barrier justified by
   "cleaner", "separate stages" or nothing is a FAIL; the default is
   `pipeline()`.
4. **No agent-as-plumbing edge.** Flatten, dedupe, filter, sort, count and
   merge are code. An `agent()` whose job is combining results is a FAIL.
5. **Every cycle converges by construction.** A loop in the script has a dry
   counter (K consecutive rounds with nothing new), a `budget.remaining()`
   guard, and dedupes new items against a set of **everything seen** — not
   against confirmed. Any one missing is a FAIL.
6. **Every figure is labelled and derived.** Agent count, critical path and
   token estimates each carry *estimate* and the formula. The caps are stated
   correctly: concurrency `min(16, CPUs − 2)` per workflow, ≤ 4096 items per
   `parallel()`/`pipeline()` call, ≤ 1000 agents per run. "Around your core
   count" or an unlabelled number is a FAIL.
7. **The script is a workflow script.** Plain JS, `export const meta = {…}`
   first and a pure literal (no identifiers, calls, spreads, interpolation),
   no `Date.now()`, `Math.random()`, argless `new Date()`, no filesystem or
   Node API, every `agent()` with a schema where its output is consumed by
   code. TypeScript syntax or a computed `meta` is a FAIL.
8. **Lint rows are closed or disputed.** Every row the lint raised on the
   delivered script is either gone on re-lint or named in the review with the
   reason it is a false positive. A row silently left open is a FAIL.
9. **The verifier is not the producer.** Any node that judges a finding is a
   different `agent()` call with a different prompt from the one that produced
   it. A "check your own work" step counted as verification is a FAIL.
10. **No overhead on the project, and not launched.** Nothing written under
    the target repo (`git -C <target> status --porcelain` identical before and
    after), no project command run, and the Workflow tool not invoked. The
    review says how to run it; running it is a FAIL.
11. **Receipt.** The footer states what was read, lint rows found and closed,
    that the repo is untouched and the workflow was not launched.

## Class D — design from a chain

**Bar: a reader who has never seen the linear agent can say which steps run
at once, which one merges, and where a wrong answer gets caught — from the
diagram alone.**

Pass requires, in addition to the shared list:

1. **The cut arrows are the right ones.** Against the fixture's README, every
   arrow it marks `none` is cut and every arrow it marks as an edge is kept.
   One wrong call is a FAIL.
2. **The diamond is drawn.** Independent readers fan out; exactly one merge
   node needs them all; the merge's cross-item need is in the barrier table.
3. **The plumbing step is code.** The step the fixture marks as plumbing does
   not appear as an `agent()` in the script.
4. **The self-check is replaced or named.** The step where the same actor
   checks its own output becomes a refuting verifier node, or the review
   names the vacancy in the node table and in do-next item 1.
5. **Contracts match the data.** Each node's schema names the fields the next
   node actually reads; a schema with fields nothing consumes, or a consumer
   reading a field no schema provides, is a FAIL.

## Class R — review of an existing script

**Bar: a reader can take the delivered script, run the lint, see zero rows,
and know why each original row was there.**

Pass requires, in addition to the shared list:

1. **Every planted row is found.** Against the fixture's README, every listed
   `G` id appears in the review with the line it fires on. A missed id is a
   FAIL; an extra id not in the README is checked by the critic and is a FAIL
   only if the lint does not raise it.
2. **No false rows against the original.** Ids the README says must not fire
   do not appear as findings.
3. **Each row has its exact change.** Row → the line in the rewrite that
   closes it. "Refactor the loop" is not a change.
4. **The rewrite's topology is justified.** Every barrier removed is named
   with the pipeline that replaced it; every barrier kept has its cross-item
   need.
5. **Re-lint is shown.** The lint's output on the delivered script is in the
   artifact and reports zero rows, or the disputed rows with reasons.

## Class C — cycle design

**Bar: a reader can say when the loop stops, why it cannot spin, and what one
round costs — before running it.**

Pass requires, in addition to the shared list:

1. **Stop condition on the diagram.** The loop-back edge carries the dry
   condition and K; the budget guard is a labelled exit.
2. **Dedupe against seen, with the reason.** The review says in one sentence
   why deduping against confirmed never converges.
3. **Lenses are distinct and separate.** At least three verifier lenses,
   each a different prompt, with a majority rule computed in code; none run
   by the finder that produced the finding.
4. **Tiering has a reason.** Finders on a cheaper tier or lower effort with
   the reason stated; the synthesis node not downgraded.
5. **The round is costed.** Agents per round, expected rounds, critical path
   per round and the concurrency cap, each labelled estimate with its formula;
   the 1000-agent lifetime cap named against the expected total.

## Properties with no instrument yet

- Whether the redrawn graph is actually faster when run (needs a run; out of
  scope for this bar — the artifact is not launched).
- Whether the token estimate is within a factor of two of the bill.
- Whether the chosen verifier lenses are the *right* lenses for the domain —
  `references/verification.md` is a judgement, not a measurement.
- The review's own token cost. The harness reports it; record it in
  ROUNDS.md.
