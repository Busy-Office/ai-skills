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

**When:** `reworkRate` > 0.25 and no separate verify step exists — the single
commonest and most expensive gap in a loop.

**Shape:** the acceptance test is written into the item before the build
starts; a context that did not write the code runs it and reports pass or fail
with the actual output; only a pass reaches the commit step.

**The rule that stops it becoming the new bottleneck:**

> **The gate blocks the commit. It never blocks the loop.**

A red gate means *this item returns to the queue with the failure text
attached*, and the next tick takes different work. A loop that sits waiting on
a check has been converted into a queue of one — and a gate people wait on is a
gate someone eventually switches off.

**Two tiers, because one is always wrong.** A suite big enough to be worth
having is too slow to run every time:

| tier | scope | budget | blocks |
|---|---|---|---|
| **commit gate** | the tests that name the changed modules, plus the touched workspace's own suite and lint — or the root suite where that workspace has none | a few minutes | the commit, never the loop |
| **deep tier** | end-to-end, cross-workspace, build — everything slow | none, because nothing waits on it; but it must land before the next release, or deferred work becomes notional | a release, not a tick |

Four rules keep the split honest:

1. **Select, don't schedule.** Run what the change touches and report it as a
   fraction — "14 of 518" is what makes a gate proportionate. A change that maps
   to no test is a coverage finding, not a reason to run everything.
2. **Budgets degrade, they do not hang.** On breach, run the cheaper tier,
   record what was skipped, and push it to the deep tier's next batch.
3. **Pin the one-way doors.** Checks guarding money, deletion, migrations or
   auth run regardless of how rarely they catch anything: the cost of that miss
   is not measured in minutes.
4. **Mirror the CI that exists.** A project with CI has already drawn the
   fast/slow line under real pressure, often with the slow half sharded. Adopt
   that split rather than inventing a rival definition of green — when two
   definitions disagree, people believe neither.

**Cost:** one extra short context per item. It is the cheapest thing on this
page and it is usually the missing one.

**The agent itself:** `personas/verifier.md` is a template to write into the
target repo's `.claude/agents/verifier.md`, with four slots — the check command,
how it is scoped to the change, where the acceptance test lives, and the record
file. It is not shipped as a plugin agent on purpose: a verifier that does not
know the project's command returns green without checking anything, and a gate
nobody can trust is worse than no gate. **If the check command cannot be
established, do not install it** — report the gap instead.

**What this deliberately does not include.** There is no ledger here, so
nothing measures which checks earn their place, and the tiering above is a
judgement call rather than an evidence-backed one. That is a real limitation: a
gate that cannot demote only ever grows. If the gate becomes the bottleneck —
people skipping it, or blocked minutes rising per tick — the answer is to start
recording one row per gate run (duration, blocked time, tests selected of total,
result, and whether the failure led to a fix on the same item) and rank checks
by catches per minute. Prescribe that when there is evidence it is needed, not
before.

---

## Route the reading out

**When:** `toolCallsPerEdit` > 25, or Grep/Glob/Read dominate `topTools`
on the heaviest model.

**Shape:** a search subagent with a stated output shape (files + line
numbers + one-line why, nothing else) does the sweep; the main context
receives the answer, not the corpus. Alternatively cache the answer: a map
file the loop reads each tick instead of re-deriving it.

**Cost:** near zero; it usually reduces the bill in the first tick.

### Using an index without spending the saving

Where the project has a queryable index (graphify or similar), the discipline is
narrow and the numbers are worth knowing. Measured on a real 2 MB graph:

| operation | cost |
|---|---|
| one query | **~1.5k tokens, 0.2 s** — returns node names with `src=` and `loc=` |
| the same query with `--budget 1500` | ~1.2k |
| reading **one** file the query points at | **~15k** |
| loading the graph file itself | **~499k** — 325 queries' worth |
| building the graph | 60–90k per run |

Four rules follow from that shape:

1. **Query to locate, then read narrowly.** The answer is a map, not prose: it
   names the nodes and where they live. Read those lines, not those files. A
   query followed by reading everything anyway has spent 1.5k for nothing.
2. **Budget every query.** A wide traversal is the only way this gets expensive,
   and the cap costs nothing.
3. **Match the traversal to the question.** Breadth for *what touches X*, a path
   query for *how does A reach B*, an explain for *what is X*. Breadth-first on
   a question with two known endpoints pays for nodes you did not need.
4. **Never load the index.** It is two orders of magnitude larger than any
   answer drawn from it. That is the same mistake as keeping a design map in the
   wake, one size up.

**Break-even:** a build pays for itself after roughly five avoided file reads,
and it is paid on a trigger rather than per tick. Against a project loading a
69k design map at every wake, one build costs about one tick.

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
