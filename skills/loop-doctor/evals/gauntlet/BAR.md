# The bar — loop-doctor review

The gauntlet grades **one artifact**: the review loop-doctor writes for a real
project. The reference is the owner's brief (2026-09-08): *help the user
understand their current autonomous loop setup, benchmark it, and recommend
improvements — remove redundant, sharpen the loop, replace ambiguous tasks,
optimise the run. Explain with diagrams. Score it. Add no overhead to the
project that calls it.*

Every criterion below is measurable on the artifact alone. A critic who has
not seen the build must be able to grade it.

## What every review requires (miss = FAIL)

1. **Diagram before prose.** The first thing after the title is a diagram
   of one tick with the project's *real* file names on the nodes. Prose
   before it: ≤ 60 words.
2. **Scorecard present and evidenced.** Eight dimensions (correctness,
   safety, reliability, cost, maintainability, understandability,
   observability, purpose), each scored 0–5 with a one-line reason that
   cites a file or a number. An overall health label from the fixed set
   (`fit · watch · treat · stop`).
3. **Terse.** Prose outside tables, diagrams and code ≤ 450 words for the
   whole review. Every finding is one table row: id · what · where
   (file:line) · exact fix.
4. **Built vs declared** stated in one sentence in the scorecard block.
5. **Findings classified** Invalid / Redundant / Risk; an empty class is
   omitted, not written as "none".
6. **Recommendations answer findings.** Each prescription names the finding
   or gap it closes and its cost; no pattern is recommended that closes
   nothing.
7. **Do-next ≤ 5 lines**, ordered, each doable in one sitting.
8. **No overhead on the project.** The review process wrote nothing under
   the target repo (verify: `git status --porcelain` clean before and
   after, no new untracked files), ran no project command, installed
   nothing, and the artifact is the only output. Inventory script runtime
   ≤ 2 s on the target.
9. **Cost of the review itself is bounded** and reported in the footer:
   files read, and whether any state file was read whole (it must not be).
10. **Ambiguous tasks named.** If the loop has a queue, the review lists
    the items whose acceptance is unstated or judgement-worded ("improve",
    "look at", "consider") and proposes a sharpened wording for at least
    the top three.
11. **Autonomy plan present and concrete.** A human-input-points table
    (each row: what the human must do today · file:line · what replaces
    it), the stage rows that differ from the blueprint, and an
    empty-queue rule that is **paste-ready for this project** — it names
    the project's real roadmap, intent and gate-log files, not
    placeholders. A plan that would let the loop edit intent, or start
    one-way-door work without a gate entry, is a FAIL.

## Class D — diagnostic report (this artifact)

**Bar: a stranger can explain one tick from the diagram in under a minute,
can say the loop's score and why, and can start the first fix without
reading anything else.**

Pass requires, in addition to the shared list:

1. **Diagram sufficiency test.** Hide everything but the tick diagram and
   the files-by-role table. From those alone the critic can answer: what
   fires it, what it reads, how it picks work, who decides done, where it
   records, when it stops. Any "can't tell" is a FAIL.
2. **Score defensibility.** For two dimensions of the critic's choosing,
   the one-line reason is sufficient to reproduce the score within ±1
   using the anchors in `references/scorecard.md`. If the critic would
   score it differently by more than 1, FAIL.
3. **Every Invalid finding is verifiable** at its cited file:line. The
   critic opens at least three at random; one miss is a FAIL.
4. **Do-next item 1 is the highest-severity Invalid finding**, or the
   review says why not.

## Properties with no instrument yet

- Whether the recommended fixes *work* when applied (needs a follow-up
  run after applying; out of scope for this bar).
- Token cost of the review beyond files-read (the harness reports it; the
  artifact cannot). Report it in ROUNDS.md from the run notification.
