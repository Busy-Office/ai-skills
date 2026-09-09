# The bar — requeue proposal

The gauntlet grades **one artifact**: the reprioritisation proposal requeue
writes for a real project. The reference is the owner's brief (2026-09-09):
*review and adjust the roadmap so the loop is fed the right priorities —
re-rank, split what only a human can do, and sharpen items that are not tasks
yet. Propose; do not rewrite the repo.*

Run `node evals/bar-check.mjs requeue <artifact>` first for M1–M9. A green
pre-check is not a pass.

## What every proposal requires (miss = FAIL)

1. **Nothing was written to the target repo.** `git -C <target> status
   --porcelain` is identical before and after, and no queue file was edited.
   The proposal says so in the footer. Any edit without an explicit ask is an
   immediate FAIL — reordering someone's roadmap unasked is the one thing this
   skill must never do.
2. **The anchor is stated.** The first screen names the intent document the
   ranking is against, or states plainly that none exists and that the ranking
   is therefore unanchored (unblocking and readiness only).
3. **Every ranked item has a reason naming the deciding factor** from the five
   (unblocks · intent · readiness · decay · cost), and where two factors
   disagreed, the reason says which won.
4. **Precedence holds.** No item ranked above one that unblocks strictly more
   open items, unless the reason explains the exception. The critic checks the
   top five.
5. **Readiness caps rank.** No item without a stated acceptance test sits at
   rank 1. An unready item either drops or is sharpened first.
6. **Lanes assigned**: `loop` · `loop, subloop` · `loop, gauntlet` · `human` ·
   `blocked`. Every human-only item — credential, account, decision, signature
   — has left the loop's lane and carries an ask a person can act on today.
7. **Hygiene resolved before ranking.** Duplicates, contradictions, ghosts and
   stale items appear as rows with file:line and a proposal. A contradiction
   is resolved from the repo (code, commit, test), not from whichever file was
   edited last, and the resolution says which evidence decided it.
8. **Sharpened rewrites are object · test · bound.** At least the top three
   ambiguous items are rewritten so an actor who has not seen the conversation
   could start and know when to stop.
9. **Where no test can be written**, the item becomes a question for a person,
   a bounded spike with its own exit, or a deletion candidate — one of those
   three, stated. Handing an untestable item to the loop is a FAIL.
10. **Deletions are proposed, never assumed.** A ghost is proposed for
    deletion with its evidence (traces to no intent, nothing waits on it, age)
    and stays in the artifact as a proposal.

## Class Q — queue proposal (this artifact)

**Bar: the loop's owner can accept the top three, hand the human lane to the
right people, and know what the next tick will pick up — without re-reading
the backlog.**

Pass requires, in addition to the shared list:

1. **Ranking is reproducible.** For the top five, the critic applies the five
   factors from `references/ranking.md` to the collector's JSON and lands on
   the same order, or on an order the artifact's reasons explain. Two or more
   unexplained inversions is a FAIL.
2. **Every cited item exists** at its file:line and has the status claimed.
   The critic opens at least four at random; one miss is a FAIL.
3. **The unblocking claim is checkable.** "Unblocks 5 items" names them or
   points at where they are, so the count can be verified.
4. **Sharpened rewrites carry a test a machine or a person could run** — a
   command, a status code, a number with a unit, a rendered state. "Better
   performance" as a rewrite is a FAIL.
5. **Do-next item 1 is the rank-1 item or the hygiene fix that blocks it.**
6. **"The order is already right" is an allowed verdict** — and when the
   proposal reorders nothing, it says so plainly rather than manufacturing
   churn to look useful.

## Properties with no instrument yet

- Whether the proposed order actually produces more shipped work (needs a
  window of runs after adoption — that is `loop-economist`'s measurement, not
  this one).
- Whether an item's value estimate is correct; the bar checks precedence and
  reasoning, not business judgement.
