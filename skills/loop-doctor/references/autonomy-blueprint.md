# Autonomy blueprint — the target setup

What a scheduled loop looks like when it can run for weeks with the human
reading a log, not answering questions. The review compares the project's
loop against this and hands over the delta as ordered steps. Nothing here
is new machinery; every element has been seen working in a real loop.

## The principle

**The human is removed from the critical path, never from the decision.**
The loop decides everything reversible itself and records why; it
escalates everything irreversible asynchronously and keeps working on
something else. Human input becomes a review of a log, on the human's
schedule.

## Stage by stage

| stage | target | why it reduces human input |
|---|---|---|
| **trigger** | one scheduler entry; cadence stated once in the loaded rules; a `HALT` file checked at wake as the kill switch | nobody has to start it, and stopping it doesn't require editing rules |
| **wake** | read order: `RESUME` (short, rewritten) → roadmap → gate log; an overlap lock; state files under an archive rule | no "what was I doing?" question to the human; no tick lost to a collision |
| **select** | first unblocked roadmap item **with a stated acceptance test**; items without one are not dispatchable and are sent to the sharpening step instead | the loop never has to ask "what does done mean here?" |
| **act** | budgets in the loaded rule: agents per tick, wall time, attempts per item, change classes that escalate | the human is not the budget |
| **verify** | a separate fresh-context verifier with default-FAIL criteria; "verify by running" | the human is not the QA |
| **gate** | decisions classified at the moment they arise: **two-way door → decide, record the reasoning, continue; one-way door → write the fail-closed reading to the gate log, proceed on it or on other work, human overrules later** | blocking gates are the largest source of idle waiting on a person |
| **record** | one state file, written last; closed outcome vocabulary; one commit per tick | the human can read status in one place, in one minute |
| **re-arm / stop** | enumerated stops (goal met · budget · repeat-failure · no-progress · HALT); the empty-queue ladder below; **goal-level exit criteria** so "roadmap done" is checkable | the loop knows when it is finished, and what to do when it isn't but the list is |

## The empty-queue ladder, as a rule you can paste

The loaded rules file (the one the driver actually puts in context)
should carry this, worded for the project:

```
When no roadmap item is unblocked:
1. If every goal-level exit criterion in <ROADMAP> is met, record
   `steady-state` and stop re-arming until <INTENT> or <ROADMAP> changes.
2. Otherwise read <INTENT> and <ROADMAP>. Draft the next slice: 3–7 items,
   each with an acceptance test and the intent clause it serves. Append
   them to <ROADMAP> as `proposed`, and add one gate entry to <GATE LOG>
   listing them. Do not edit <INTENT>.
3. Start the first proposed item that is reversible (no migration, no
   external side effect, no money, no permission change). Leave one-way
   items `proposed` until the gate is answered.
4. If nothing in the slice is reversible, run one bounded explore (≤ 1
   tick, output is a finding, not a change) and record `steady-state`.
```

## The objective review, as a counter rule

```
Every <N>th tick, before selecting work: re-read <INTENT> against
<ROADMAP>. Mark items that serve no intent clause `proposed-retire`, add
a gate entry, continue. Never re-prioritise silently.
```

## Human-input points

The review lists every place the current loop needs a person, and what
removes it. The usual ones:

| today the human must… | replace with |
|---|---|
| start the loop / say "continue" | scheduler entry + `HALT` file |
| answer a blocking gate before the tick proceeds | two-way/one-way classification; log-and-continue |
| clarify what an item means | acceptance test required to be dispatchable; sharpening step |
| notice the queue is empty and write more | the empty-queue ladder |
| notice it is stuck | no-progress and repeat-failure stops with an outcome word in the state file |
| decide whether the loop is done | goal-level exit criteria on the roadmap |
| approve every merge | verifier + gates; human approval only for one-way classes |

## What this deliberately keeps human

Editing intent. Answering one-way-door gates. Raising a budget. Turning
the loop back on after `HALT` or `steady-state`. A setup that automates
these has removed the human from the decision, not just the path.
