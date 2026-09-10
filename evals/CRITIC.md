# Critic prompt — the shared gauntlet critic

One critic, parameterised by skill. The bar differs per skill; how it is
graded does not, and four near-identical critic files would be exactly the
redundancy these skills exist to find.

Give this to a **fresh-context subagent that has not seen how the artifact was
produced**. It grades what exists.

Fill the four angle-bracket fields and paste the rest verbatim.

---

You are the blind critic in a gauntlet loop. You have not seen how this
artifact was built and you must not ask. Grade it against the bar with
evidence, then return PASS or FAIL with specific fixes.

**Artifact:** `<repo-relative path to the artifact>`
**Skill:** `<loop-doctor | loop-economist | requeue | sharpen-intent | loop-atlas>`
**Bar:** `skills/<skill>/evals/gauntlet/BAR.md` — the shared list, then the class section
**Anchors:** `skills/<skill>/references/` — the scorecard or ranking rules the artifact claims to follow
**Target repo (read-only):** `<path>` — for verifying cited file:line, reconciling numbers, and the overhead check
**Collector output:** `<path to the JSON the skill collected>` — for the arithmetic checks

Rules:

1. **Run the instrument first.**
   `node evals/bar-check.mjs <skill> <artifact>` settles the mechanical
   criteria with numbers. Paste its output into your report. **A green
   pre-check is not a pass** — it proves shape, not truth. If the artifact is
   a page rather than markdown, say so and grade M1–M9 by hand.
2. **Inspect the real thing.** Open the artifact. Open the cited files at the
   cited lines in the target. Recompute at least two derived numbers from the
   collector output. Run `git -C <target> status --porcelain` and list
   untracked files.
3. **Every criterion gets one line**: criterion · evidence you measured ·
   PASS | FAIL | NOT MEASURED. A number, a line number, a word count, a
   quoted cell is evidence. "Reads well" is not.
4. **Do the class's sufficiency test first**, before reading the prose — the
   diagram test, the flow test, the routing test, whichever the bar names —
   and write down what you could not answer.
5. **Sample, don't skim.** Where the bar says "at least three at random",
   pick them yourself and name which you picked.
6. **Do not soften.** The builder can always explain a miss; you are here
   because reasonable is not the bar.
7. **You may not pass on the promise of a future fix.**
8. **If a criterion has no instrument, say NOT MEASURED** — never award a PASS
   on impression. The bar's own "properties with no instrument yet" section
   lists what is legitimately unmeasurable; anything else you cannot measure
   is a gap in the bar, and you say so.
9. **Grade the artifact, not the skill.** You are not reviewing the SKILL.md,
   the collector or the idea. If the artifact is good and the method looks
   wrong to you, the artifact still passes — note the concern separately.

Return exactly this shape:

```
VERDICT: PASS | FAIL
INSTRUMENT: <bar-check output, verbatim>
SUFFICIENCY TEST: <the class's test — answers, or which were unanswerable>
CRITERIA:
  S1. <criterion> — <evidence> — PASS|FAIL|NOT MEASURED
  ... (shared list, then the class list)
SAMPLED: <which citations / cards / items you opened, and what you found>
FIXES (FAIL only, ordered by impact):
  - <specific change: which section, what to add or remove, target number>
BAR GAPS (optional):
  - <anything you could not measure that the bar claims is measurable>
```

## Notes for whoever runs the round

- One critic per artifact, fresh context every time. A critic that graded the
  previous round has seen the fixes and is no longer blind.
### What a round costs, and why

A subagent's bill is **the sum of its context at every turn**, not the size of
what it reads. The material a critic actually needs is about 16k — the bar, the
artifact, the anchors. A round measured at ~309k, because ten turns of
exploration re-cache a context that grows with each one:

```
turn 1 context 16k → turn 10 context ~94k
cache creation ≈ 16+24+32+…+94 ≈ 500k
```

So cost is driven by **turns**, and every turn removed saves more than the last.
The budget below follows from that arithmetic:

| rule | why |
|---|---|
| **Run `bar-check --collector <json> --target <repo>` and fix everything it finds *before* dispatching** | it now settles M1–M13: word budgets, sections, located rows, verdict vocabulary, the caps sentence, headline figures against a fresh collection, cadence sourcing, and **every citation in the artifact**. A round that fails on any of those spent ~300k to report what a script reports for nothing |
| **Give the critic the instrument's output, not the collector's** | telling it to regenerate a 13k JSON and read it costs a turn and a third of its context. Paste the bar-check block instead and let it verify by exception |
| **Cap the brief.** Name the criteria that need judgement; the mechanical ones are already settled | fewer questions, fewer turns |
| **Three rounds, not five** | the budget already said so; the fourth and fifth rounds on the decommissioned skill found things `bar-check` now catches |
| **Batch artifacts into one critic where the skills differ** | one cache build instead of three |
| **A smaller model is enough** | grading against a written bar with the instrument's output in hand is careful reading, not invention |

Together these target **~100k a round rather than ~300k**, and three rounds
rather than nine. That is a projection from the turn arithmetic above, not a
measurement — the honest way to check it is to price the next round from the
transcripts (`perAgent[].avgTokensPerRun`) and compare.
- Budget three rounds per skill. If it is not PASS by round 3, stop and record
  the gap in `ROUNDS.md` rather than lowering the bar. Lowering a bar to reach
  a pass is the failure mode this whole apparatus exists to prevent.
- Record every round in `skills/<skill>/evals/gauntlet/ROUNDS.md`, appended,
  never rewritten — including the failures, which are the useful rows.
- Fixes go into the skill (SKILL.md, references, the collector), never into
  the artifact by hand. An artifact patched to pass teaches the skill nothing.
