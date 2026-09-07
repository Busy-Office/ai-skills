# Scorecard

Eight dimensions, each 0–5, each with a one-line reason that cites a file
or a number. The score is a summary of the findings, never a substitute
for them: a reader should be able to go from the score line to the rows
that produced it.

## Anchors (apply to every dimension)

| score | meaning |
|---|---|
| **5** | every check in this dimension passes with cited evidence |
| **4** | passes; at most one *Risk*, nothing Invalid |
| **3** | two or more *Risk*, nothing Invalid |
| **2** | one *Invalid* finding |
| **1** | two or more *Invalid* findings |
| **0** | the dimension has no mechanism at all (e.g. no verifier exists, no state file, no intent) |

Where a dimension's checks cannot be assessed from the files (no
instrument), score it and mark the reason `NOT MEASURED — <why>`; don't
guess upward.

The anchors are a ceiling, not a suggestion: if the one-line reason
cites an Invalid finding, the score is at most 2; if it cites two, at most
1. A reason and a score that disagree is itself a defect in the review.

## Dimensions and what each one's checks are

| dimension | checks (see `checklist.md`) |
|---|---|
| **correctness** | references resolve · no tripped sentinel · exit code = documented meaning · thresholds agree · built vs declared honest |
| **safety** | one trigger · overlap guard · kill switch · async escalation · no self-approval · stop-classes named once · budgets enforced · no swallowed setup errors |
| **reliability** | idempotent tick · green-or-reverted · no-progress + repeat-failure stops · steady state recognised |
| **cost** | lines read at wake and their growth · archive rule · agents-per-tick cap · wall-time cap |
| **maintainability** | one canonical copy per rule in the loaded file · counts agree · superseded designs removed · playbook vs archive |
| **understandability** | one tick explainable from the files · three questions answered once each · every file has a role · resume ≠ history |
| **observability** | closed outcome vocabulary · one record per tick, written last · stuckness visible in state · metrics recorded |
| **purpose** | intent document exists and is named in loaded rules · empty-queue ladder · periodic objective review · intent read-only for the loop · items trace to intent |

## Health label

Mean of the eight scores, then:

| mean | label | meaning for the reader |
|---|---|---|
| ≥ 4.0 | **fit** | run it; adopt the prescriptions at leisure |
| 3.0 – 3.9 | **watch** | safe to run; fix the Risk items this month |
| 2.0 – 2.9 | **treat** | fix the Invalid items before the next unattended tick |
| < 2.0 | **stop** | don't run unattended until the Invalid items are fixed |

A single `0` in **safety** caps the label at **treat** regardless of the
mean — a loop with no kill switch and no escalation channel is not "fit"
because its documents are tidy.

## Sharpness (queue quality)

Only when the loop has a queue (backlog, roadmap items, scenario list).
Report two numbers and a list:

- **stated acceptance**: share of open items with an explicit acceptance
  criterion or exit test.
- **ambiguous items**: open items whose wording is judgement-only —
  contains *improve, look at, consider, explore, clean up, review* with no
  measurable object — as a count.
- **top three sharpened**: for the three highest-ranked ambiguous items,
  one proposed rewording each that names the object and the test.

Sharpness feeds the **purpose** and **reliability** scores; it is not a
ninth dimension.
