---
name: loop-economist
description: Reviews what an engineering loop's actual runs cost and produced — reading Claude Code session transcripts and git history rather than the loop's documents. Reports tokens per shipped change, cache and subagent spend, rework and thrash, how often a human had to intervene, and whether the right agent, model or persona did each kind of work; scores six dimensions (effectiveness, efficiency, budget, plan quality, agent fit, convergence) into a verdict, and prescribes what closes each finding — a verifier seam, routing the searching out, a bounded subloop or a gauntlet for items one run cannot converge on, or handing the queue to requeue when the input rather than the actor is the problem. Use when someone asks how efficient or effective their loop or agents are, what the loop is costing in tokens or budget, whether it is worth running, why it keeps redoing the same work, whether it is using the right model or agents, how to orchestrate multiple agents or personas across the work, or wants their multi-agent build loop analysed, scored or made cheaper.
---

# Loop Economist

`loop-doctor` reads a loop's documents and asks whether the design is
sound. Loop-economist reads what the loop **actually did** — every session
transcript and every commit in a window — and asks a different question:
*what did a unit of shipped change cost, and was it produced by the right
crew?*

A loop can score well on its documents and still spend forty thousand
tokens a tick re-reading a codebase to change one line, or ship and then
un-ship the same file four times. Only the runs show that.

```mermaid
flowchart LR
  A["runs.mjs<br/>transcripts + git · read-only"] --> B["the economics<br/>tokens per commit"]
  B --> C["findings<br/>Leak · Misroute · No-converge · Ill-formed"]
  C --> D["score<br/>6 × 0–5 → verdict"]
  D --> E["prescribe<br/>verifier · routing · subloop · gauntlet"]
  E --> F{"binding constraint?"}
  F -- the actor --> G["review<br/>economics · score · findings · do-next"]
  F -- the input --> H["hand off to<br/>requeue"]
```

## The guard-rail: no overhead on the project

- **Write nothing into the target repo.** The review goes to the
  scratchpad, or to a published page if that is how they read things.
- **Run nothing of the project's.** No install, build or test run. Only
  `git log` and the collector.
- **Never quote a transcript.** Sessions contain the user's own words and
  their code. Cite a session by id and a metric, never by content.
- **One context, one pass.** No subagents by default — reviewing a
  fan-out problem by fanning out is its own joke.
- **Leave a receipt** in the footer: transcripts read, window, commits,
  repo untouched.

## Workflow

### 1. Collect

```bash
node <skill-dir>/scripts/runs.mjs <repo-path> --since 14d > <scratchpad>/runs.json
```

Sessions (tokens by kind, models, tools, subagents by type, human turns,
interrupts, tool errors, repeated identical calls, files edited), git
(commits, churn, rework commits), the loop's records (open/done/vague
items), and the derived rates. Read all of it — it is evidence, not
conclusions.

Pick the window from the loop's cadence: at least **20 ticks or 14 days**,
whichever is longer. Say the window in the first line of the review; every
rate is meaningless without it.

**Write the review from one collection, and quote that collection's numbers.**
A rolling window moves: a review drafted from Monday's run and finished on
Tuesday will state a commit count that no longer exists, and every derived rate
inherits it. Re-run the collector immediately before writing, and verify with
`node evals/bar-check.mjs loop-economist <artifact> --collector <run.json>`,
which compares the headline figures against the collection.

No transcripts (a loop that runs elsewhere, or a fresh machine) → the
budget half is `NOT MEASURED`. Score effectiveness, plan quality and
convergence from git and the records, and say plainly which four numbers
you could not see. Do not infer tokens from diff sizes.

### 2. Read the economics

`references/metrics.md` — each metric with its band and the cause a
reading out of band implies. Establish **tokens per commit** first; it is
the number the reader will remember. Then the three that explain it:
cache hit rate, subagent share, tool calls per edit.

### 3. Find the findings

One row per finding, classified:

- **Leak** — spend that produced no kept change (a zero-commit session, a
  fan-out whose output was re-derived, state re-read every tick).
- **Misroute** — the wrong actor did the work: `agent-fit.md`.
- **No-converge** — thrash, rework, a file the loop cannot leave alone.
- **Ill-formed** — the item had no acceptance test; no actor could have
  converged.

Each row cites a session id, a file or a metric. "Could be more efficient"
is not a row.

### 4. Score

`references/scorecard.md`. Six dimensions 0–5, one-line reason each citing
a number, mean → verdict (`compounding · productive · expensive ·
spinning`), then the caps: nothing shipped caps at *spinning*; more than
three human turns a run caps at *productive*; rework over 0.4 caps at
*expensive*.

**Show the mean and name every cap, including the ones that do not bind.** Add
the numbers up and check the division — a mean that disagrees with its own six
scores is the easiest thing in the review to falsify. Then one line: which caps
were tested, which applied, and which did not. A verdict word alone does not
show the caps were considered.

Write the reason before the digit. A reason citing two out-of-band metrics
cannot carry a 3.

### 5. Prescribe

`references/patterns.md`, and only what closes a finding you wrote:
verifier seam, route the reading out, cache discipline, per-tick budget,
persona split, and for the items one pass cannot reach — a **bounded
subloop** (try · verify · adjust, N rounds, each round must change the
approach) or a **gauntlet** (k independent attempts, a bar written first,
a judge that wrote none of them). Give every prescription its cost.

### 6. Name the binding constraint

One sentence, and it decides the handoff:

- **the actor** — wrong model, no verifier, unrouted searching → the
  prescriptions above.
- **the input** — thrash and rework concentrate on items with no
  acceptance test → say *the input, not the actor, is the problem* and
  hand off to **`requeue`**. A stronger model on an unstated target
  converges on nothing, more expensively.
- **the design** — the tick itself is unsound (two drivers, no stop, no
  gate) → hand off to **`loop-doctor`**; that is its question, not this
  one.

### 6b. Compare against the last one, if there is one

Every number here is a point on a curve, and the curve is the argument. Before
writing, look for the previous review — a project keeping these in a notebook or
a `docs/reviews/` directory can be asked directly. Where one exists, lead with
the movement: *"296k per shipping commit, up from 245k; rework 0.23 unchanged."*
Where none does, say so, and say the review is a baseline rather than a verdict —
a first measurement cannot tell anyone whether things are getting better.

`docs/second-brain.md` in this repo is one optional way to keep them.

### 7. Write the review

`references/report-template.md`, exactly: ≤ 60 words, the economics table,
the crew diagram drawn from the runs (including the edges that should not
exist), the score block, findings, non-converging runs, prescriptions,
do-next (≤ 5), footer receipt. Then a terminal summary of ≤ 8 lines.

### 8. Apply — only when asked

Prescriptions change how the loop behaves. Propose; apply on request, one
commit per prescription, diff shown first.

For the verifier seam specifically, applying means writing
`references/personas/verifier.md` into the target repo's
`.claude/agents/verifier.md` with its four slots filled from that project, and
adding the one rule that calls it before the commit step. Fill the slots from
the project's own task file; **if the check command cannot be established, do
not install the agent** and say why — an unwired verifier returns green without
running anything, and the loop will believe it.

## Judgement calls

**Tokens per commit is a ratio, and both halves lie alone.** Cheap runs
that ship nothing and expensive runs that ship a migration look the same
in one number. Always report the pair.

**Cache reads are not the bill.** Report them beside the billable total,
never inside it. Overstating spend to make a point is the same failure as
understating it.

**A retry that changes nothing is not persistence.** Three identical calls
in one session is the evidence for a subloop; the subloop's whole content
is the rule that each round must change the approach.

**A context cannot verify itself.** If no separate actor ever checked the
work, agent fit is 0 — not 2 — however good the code turned out.

**Fan-out is a cost, not a virtue.** Subagent share above half with flat
commits is a finding, and the prescription is fewer agents with stated
output shapes, not better prompts.

**One window is a sample.** Quote the session count next to every rate,
and prefer "in this window" to "always".

**Never paste what a session said.** Ids and numbers only.

## Files

- `scripts/runs.mjs` — transcripts + git collector; `--self-test`.
- `references/metrics.md` — every metric, its band, what a bad reading
  means.
- `references/scorecard.md` — six dimensions, anchors, verdict and caps.
- `references/agent-fit.md` — routing table, the four personas, fan-out
  rules.
- `references/patterns.md` — subloop, gauntlet, verifier seam, routing,
  cache, budget, escalate-to-input.
- `references/personas/verifier.md` — the verifier as a template for the
  target repo, with the refusal to install it unwired.
- `references/report-template.md` — the review, exactly.
- `evals/` — the prompts, and `gauntlet/BAR.md`, the bar this skill's
  reviews are graded against by a blind critic.

## Related

`loop-doctor` reads the same loop's documents and judges the design;
`loop-atlas` draws the flow and the crew as they are; `requeue` fixes the input
when the items were never tasks; `sharpen-intent` fixes what the items are
ranked against. Step 6 names which of them the findings actually belong to —
that hand-off is part of the review, not an afterthought.
