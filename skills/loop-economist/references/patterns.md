# Patterns — what to prescribe

Prescribe only what closes a finding you wrote down, and give each one its
cost. Three habits kept beat twelve written down.

---

## Subloop — try · verify · adjust · again, bounded

**When:** a session thrashed (`thrashSessions`), or a file appears in
`churnFiles` with a rework commit. The task is real but one straight pass
does not reach it.

**Shape:** inside the tick, for one item only:

```
round 1..N (N = 3):
  attempt   — smallest change that could satisfy the acceptance test
  verify    — run the test; capture the actual failure text
  adjust    — change the *approach* from the failure, not the same call again
  stop when: test passes → commit
             no change in the failure text two rounds running → stop, record "not converging", requeue the item
             round N reached → stop, record the best attempt as a draft, requeue
```

**The rule that makes it cheap:** each round must state what it changed
about the approach. A round that repeats the previous call is not a round;
it is the thrash the subloop exists to replace.

**Cost:** up to 3× one attempt on the items that need it — and it removes
the unbounded retrying that is already being paid for.

---

## Gauntlet — several approaches in parallel, one bar, one survivor

**When:** the item has more than one plausible approach and the cost of
picking wrong is a rework commit; or a subloop hit its round cap.

**Shape:** k candidates (k = 2–3) attempt the same item **independently**,
in separate contexts, each producing a diff plus its own evidence. A
**judge that did not write any of them** scores all k against a written
bar and keeps at most one. The bar is written *before* the candidates run.

**Non-negotiables:** the bar exists as a file; the judge is a separate
context; "none of them clears the bar" is an allowed and recorded verdict.

**Cost:** k× the attempt. Only worth it where a wrong choice costs more
than k attempts — schema, public interface, migration, anything with
downstream commits.

---

## Verifier seam

**When:** `reworkRate` > 0.25 and no separate verify step exists.

**Shape:** the acceptance test is written into the item before the build
starts; a persona that did not write the code runs it and reports pass /
fail with the actual output; only a pass reaches the commit step.

**Cost:** one extra short context per item. It is the cheapest thing on
this page and it is usually the missing one.

---

## Route the reading out

**When:** `toolCallsPerEdit` > 25, or Grep/Glob/Read dominate `topTools`
on the heaviest model.

**Shape:** a search subagent with a stated output shape (files + line
numbers + one-line why, nothing else) does the sweep; the main context
receives the answer, not the corpus. Alternatively cache the answer: a map
file the loop reads each tick instead of re-deriving it.

**Cost:** near zero; it usually reduces the bill in the first tick.

---

## Cache discipline

**When:** `cacheHitRate` < 0.6.

**Shape:** the stable half of the tick prompt — rules, definition of done,
map — is loaded in a fixed order at the top of every run and does not
change between ticks; the variable half (the item, the state) goes last.
Growing state files read at wake defeat this: archive them on a threshold.

**Cost:** one ordering change in the driver.

---

## Budget per tick

**When:** no cap exists and `tokensPerSession` varies by more than ~3×.

**Shape:** a token or wall-clock ceiling per tick and per subagent, and a
recorded outcome when it is hit (`budget-exhausted`) — a real outcome that
routes the item back to the queue, not a silent stop.

---

## Persona split

**When:** one context plans, builds, verifies and records.

**Shape:** Planner / Builder / Verifier / Integrator per `agent-fit.md`,
with the refusals written down. Adopt the Verifier seam first and the rest
only if it is still not converging — a four-persona loop on a project that
needs one is its own kind of waste.

---

## Escalate to input, not to compute

**When:** thrash or rework concentrates on items with no acceptance
criterion (`vagueItems`).

**Shape:** stop prescribing anything about the actor. Run `requeue`:
re-rank the queue and sharpen the top items so the next tick is fed a task
rather than a wish. A bigger model on an unstated target spends more to
converge on nothing.
