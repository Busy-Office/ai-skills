# The bar — sharpen-intent review and draft

The gauntlet grades **one artifact**: the intent review plus draft that
sharpen-intent writes for a real project. The reference is the owner's brief
(2026-09-09): *sharpen intent.md, the objectives and the key focus, so the
thing the loop is ranked against can actually decide an argument.*

Run `node evals/bar-check.mjs sharpen-intent <artifact>` first for M1–M9. A
green pre-check is not a pass.

## What every artifact requires (miss = FAIL)

1. **Nothing invented.** Every sentence of the draft traces to a source
   document, the code, or an answer the user gave in this session. The critic
   picks three sentences at random and asks *where did this come from* — the
   artifact must make it findable. An unsourced claim about who the user is,
   what they sell, or why they built it is an immediate FAIL.
2. **Gaps stay gaps.** What the sources do not answer appears as `TO DECIDE —
   <question>`, visibly, in the draft. A plausible sentence written over a gap
   is the failure this bar exists to catch.
3. **Nothing written to the target repo.** `git -C <target> status
   --porcelain` identical before and after; the draft lives in the artifact.
4. **Canonicity decided by who loads it.** The review names the canonical
   document and states whether a *rules* file (`CLAUDE.md`, `LOOPS.md`, a loop
   `SKILL.md`) references it. An intent nothing loads scores `canonicity` 0
   and caps the verdict at *decorative*, however good the prose.
5. **Six dimensions scored 0–5** with one-line cited reasons, mean → a verdict
   from the fixed set (`steering · usable · decorative · absent`), caps
   applied.
6. **Traceability reported as a fraction with both halves** ("7 of 17 open
   items"), and every untraced item read as exactly one of: off-purpose,
   intent-out-of-date, wording-only.
7. **The draft has all six parts** — for whom · the change · the bet · the
   measure with a horizon · the falsifier · non-goals — plus at most three
   objectives and exactly one key focus with what it waits until.
8. **The change is an outcome, not an output.** The draft's headline change
   describes what a named person stops doing or can now do. A draft whose
   change is a thing to build is a FAIL.
9. **At least one non-goal costs something** — it excludes work a reasonable
   person on the team keeps proposing. "We are not building a spaceship" is a
   FAIL.
10. **Questions are bounded and optioned.** At most five, each with options or
    a binary, each naming what it blocks. Open-ended homework ("how will you
    measure success?") is a FAIL.

## Class I — intent review (this artifact)

**Bar: the owner can adopt the draft as-is or answer at most five questions to
finish it, and can see which of today's work would stop being justified.**

Pass requires, in addition to the shared list:

1. **The falsifier is falsifiable.** The critic can describe an observation
   that would satisfy it. A falsifier no evidence could ever trigger is a
   FAIL.
2. **The measure has a unit and a horizon** and is not restated from an
   objective — the headline measure and the objective measures are distinct.
3. **Every source in the "where purpose is stated" table exists** at its path,
   and the outcome/output-only counts are within ±1 of the critic's own count
   on two of the sources.
4. **Untraced items are checkable**: each cited at file:line, each still open
   in the target.
5. **Do-next includes pointing a rules file at the draft.** A sharpened intent
   nothing loads changes nothing; if that step is absent, FAIL.
6. **"This already steers" is an allowed verdict**, with the two or three
   things worth fixing — the skill is not required to produce a rewrite to
   justify itself.

## Properties with no instrument yet

- Whether the intent is *right* — the bar checks form, sourcing and honesty,
  never whether the bet is a good one. That judgement is the owner's and the
  skill must not pretend otherwise.
- Whether ranking against the new intent changes the queue usefully; that is
  `requeue`'s artifact, graded by its own bar.
