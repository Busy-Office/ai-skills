# The bar — loop-economist run review

The gauntlet grades **one artifact**: the run review loop-economist writes for
a real project. The reference is the owner's brief (2026-09-09): *analyse the
engineering loop — efficiency, effectiveness, budget, whether it was well
planned, and whether a suitable agent ran it. Score it. Recommend how to make
the cycle better, including sub-loops or gauntlets for work one run cannot
finish. Add no overhead to the project that calls it.*

Every criterion is measurable on the artifact alone, or on the artifact plus
the target repo. A critic who has not seen the build must be able to grade it.

Run `node evals/bar-check.mjs loop-economist <artifact>` first: it settles
M1–M9 (word budgets, sections, located rows, verdict vocabulary) with numbers.
**A green pre-check is not a pass** — an artifact can be perfectly shaped and
still say nothing true. The criteria below are what the critic adds.

## What every review requires (miss = FAIL)

1. **The pair, not the ratio alone.** Tokens per commit appears with both its
   halves (billable total and commit count) in the first screen. A review that
   quotes a unit cost without the counts behind it is a FAIL.
1b. **The unit cost excludes bookkeeping.** Where any commits touched only the
   loop's own records, the review leads with `tokensPerShippingCommit`, gives
   the record-only count and share, and does not present the diluted figure as
   the unit cost. Quoting the uncorrected number as the headline is a FAIL — on
   real projects it has been wrong by up to 2.3× and has reversed the ranking
   between projects.
2. **Cache reads are outside the bill.** Cache-read tokens are reported
   separately and never summed into the billable figure.
3. **Every rate carries its window and its n.** "0.26 rework (5 of 19
   commits, 14 days)" passes; "rework is high" does not.
4. **Six dimensions scored 0–5**, each with a one-line reason citing a metric
   or a session id, mean → a verdict from the fixed set (`compounding ·
   productive · expensive · spinning`), and the caps applied (nothing shipped
   → *spinning*; > 3 human turns per run → *productive*; rework > 0.4 →
   *expensive*).
5. **Findings classified** Leak / Misroute / No-converge / Ill-formed, one
   table row each: id · class · what · evidence · fix. An empty class is
   omitted, not written as "none".
6. **Every prescription closes a named finding** and states its cost. A
   pattern recommended that closes nothing is a FAIL — including a subloop or
   a gauntlet proposed without thrash, rework or churn evidence behind it.
7. **The binding constraint is named** in one sentence, and it routes: the
   actor (fix here), the input (`requeue`), or the design (`loop-doctor`).
8. **No transcript content.** Sessions are cited by id and by number. Any
   quoted user or assistant text is an immediate FAIL — this is a privacy
   rule, not a style one.
9. **No overhead on the project.** Nothing written under the target repo
   (`git -C <target> status --porcelain` identical before and after), no
   project command run, nothing installed. Collector runtime ≤ 5 s.
10. **Missing evidence is declared, not inferred.** With no transcripts, the
    budget dimensions read `NOT MEASURED` with the reason. Inferring tokens
    from diff sizes is a FAIL.

## Class E — economic review (this artifact)

**Bar: a reader who has never seen the loop can say what a unit of change
costs, which of the six dimensions is the binding one, and start the first fix
— without opening anything else.**

Pass requires, in addition to the shared list:

1. **Arithmetic check.** The critic recomputes tokens-per-commit and one other
   derived rate from the collector's JSON. A mismatch beyond rounding is a
   FAIL.
2. **Score defensibility.** For two dimensions of the critic's choosing, the
   one-line reason reproduces the score within ±1 using the anchors in
   `references/scorecard.md`. A larger gap is a FAIL.
3. **Budget table sums.** The "where the budget went" buckets account for the
   billable total within 10%, and the largest line that bought nothing is
   named.
4. **The crew diagram shows the edges that should not exist** — rework, thrash
   and any lane that both builds and verifies — or the review states there are
   none, with the numbers.
5. **Do-next item 1 closes the lowest-scoring dimension**, or the review says
   why not.
6. **A prescribed verifier is wired or withheld.** Where the review prescribes
   the verifier seam, it names the project's actual check command and where the
   acceptance test lives, or it states that no runnable check could be
   established and withholds the agent. Prescribing a verifier without a command
   is a FAIL: it reads as a fix while installing a rubber stamp.
7. **Convergence prescriptions are bounded.** Any subloop names its round cap
   and the rule that each round must change the approach; any gauntlet names
   k, where the bar is written, and that the judge wrote none of the attempts.

One prescription may state its parts across two tables (the finding row and the
non-converging-runs row) provided each part is present and they agree; the bar
is on the parts, not on their location.

## Properties with no instrument yet

- Whether the prescriptions actually reduce cost when applied (needs a second
  window after the change; out of scope for this bar).
- Whether the model mix was *right* rather than merely reported — the routing
  table in `references/agent-fit.md` is a judgement, not a measurement.
- The review's own token cost. The harness reports it; record it in ROUNDS.md.
- Whether a churn file was *reworked* specifically: the collector exposes rework
  commits by subject and churn by file, but does not join them. A claim that "4
  of those commits were rework" is NOT MEASURED until it does.
