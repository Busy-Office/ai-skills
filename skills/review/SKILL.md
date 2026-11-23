---
name: review
description: "Has one or more fresh reviewers, on another model where possible, read a diff, plan or report against the goal and the owner's decisions, and returns findings grouped Act on, Consider, Noted, Dismissed. Use when a batch is ready for review, a fix round needs judging, before asking the owner for a yes, or for \"review this\". Optional Jev or Grok reviewer."
---

# Review

The builder never reviews its own work (`principle-fresh-reviewer`). You brief the reviewers, merge
what they find, and triage it.

## Steps

1. **Gather the inputs:** the diff (`git diff <base>...<tip>`) or the artifact, the goal in one
   sentence, the owner's decisions verbatim, the gate's last result. Not your conclusion, not the
   builder's summary.
2. **Pick the reviewers.**
   - Default: one, on another model than the builder; otherwise a fresh context.
   - Money, contracts, concurrency, security, or more than about 300 changed lines: two, on
     different models.
   - Optional, when installed and allowed: a `jev` verdict on the same inputs (`jev rules-check` or
     `jev judge completion` with the diff attached), and a Grok or other outside-model reviewer,
     read-only, handed the same brief.
3. **Brief each reviewer.** Read-only; targeted checks only, never the full suite
   (`principle-guard-the-machine`).

   ```
   Goal: <one sentence>
   Decisions (verbatim): <the owner's words>
   Read: <the diff command or the artifact path>; open any file it touches
   Check: does it reach the goal, honour every decision, and break nothing beyond the diff?
   Report: each finding with file:line, why it matters, should-fix or nice-to-have,
           graded Ran, Read or Inferred (principle-prove-it-works). Fix nothing.
   ```

4. **Merge and triage.** Remove duplicates across reviewers; a finding two reviewers raised
   independently ranks first. Re-check a finding before it goes in Act on: a reviewer's claim is
   Inferred to you until you run it or open the line.

   | group | what goes there | then |
   |---|---|---|
   | **Act on** | a real defect, a broken decision, a failing check, confirmed (Ran or Read) | the next fix round; these are `improve-until-done`'s should-fix findings |
   | **Consider** | plausible and worth a judgement, not proven | listed with the cost of acting |
   | **Noted** | true but out of scope, or a follow-up | the queue, or a line in the reply |
   | **Dismissed** | wrong, already handled, or noise | one-line reason each |

**Reply:** the four groups with their counts, Act on first; which reviewers ran, on which model; the
reasons for each dismissal.
