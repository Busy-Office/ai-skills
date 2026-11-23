---
name: principle-stop-on-a-rule
description: "Apply when work goes in rounds or retries — fix and review, a subloop, a goal run: write the budget first, then stop at done, plateau, budget, scope growth or a check that cannot run."
---

# Stop on a rule

**Apply when** work repeats: review-and-fix rounds, retries of a failing item, a goal run, a loop's
try-verify-adjust.

**The rule.** Write the budget down before round 1: rounds (3 when nobody set one), agents, and
minutes from `date`. After each round, stop at the **first** of:

| stop | when | then |
|---|---|---|
| **done** | the gate is green, the reviewer has no should-fix findings, every claim is Ran or Read | report done, with the evidence |
| **plateau** | two rounds in a row fixed nothing new, or a fixed finding came back | stop; report what is stuck and the approaches spent |
| **budget** | a cap stated up front is reached | stop; report what is open and what one more round would cost |
| **scope growth** | the work needs a new contract, package or permission | ask the user before building it |
| **cannot verify** | a check cannot run at all (a missing tool, a service down, a crashed or starved run) | re-run it alone; still cannot run → ask the user |

A round that hits none goes again, and changes the approach, not only the wording: repeating a failed
try is how a plateau starts.

**Why.** Without a written stop, one more round always looks cheap, and the bill shows only
afterwards.

**The sign you skipped it.** Round five of the same fix; a budget stated after it was spent; "almost
there" twice.
