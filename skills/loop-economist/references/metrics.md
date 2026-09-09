# Metrics — what each number means

Every number below comes out of `runs.mjs`. A number is not a finding.
A number **with a band and a named cause** is.

## Budget (what the loop spends)

| metric | where | reads as |
|---|---|---|
| `billableTokens` | input + output + cache-creation, summed over sessions | the bill for the window. Cache *reads* are not in it — report them separately, never add them in |
| `tokensPerCommit` | billable ÷ commits | the unit cost of shipped change. The single most useful number in the review |
| `tokensPerSession` | billable ÷ sessions | run size. Rising with flat `tokensPerCommit` means bigger runs, not worse ones |
| `cacheHitRate` | cache-read ÷ (cache-read + cache-create + input) | prompt-cache discipline. **< 0.6** with many short runs ⇒ the loop rebuilds context every tick |
| `outputTokens`, `thinkingShare` | thinking ÷ output | **> 0.6** on routine mechanical work means the actor is reasoning where it should be reading a rule |
| `sidechainShare` | subagent tokens ÷ billable | fan-out cost. **> 0.5** with `commits` flat ⇒ the crew researches more than it ships |
| `minutesTotal` | wall clock | pair with tokens: cheap-but-slow and fast-but-expensive need opposite fixes |

Cost bands are per-project. Establish the project's own baseline from the
window and compare *within* it; never quote dollars unless the user gives
a rate.

## Effectiveness (what the loop produced)

| metric | reads as |
|---|---|
| `commits`, `insertions`/`deletions` | delivered change. Zero commits over a full window is the headline, whatever the score says |
| `zeroCommitSessions` | sessions that burned > 20k tokens and edited nothing. Each is a run that produced only opinion |
| `records[].openItems / doneItems` | queue movement. Done not rising while tokens rise is the classic stall |
| `reworkCommits`, `reworkRate` | commits whose subject is fix/revert/redo touching a file an earlier commit in the window already touched. **> 0.25** ⇒ the loop ships before it verifies |
| `churnFiles` | files touched in ≥ 3 commits — where the loop cannot converge |

## Convergence (did one run get there)

| metric | reads as |
|---|---|
| `thrashSessions` | a session repeated one identical call (same command / same file) ≥ 3 times. Retrying without changing the input is the definition of a run that will not converge |
| `toolErrorRate` | failing tool calls ÷ tool calls. **> 0.15** ⇒ the actor is working blind — wrong paths, missing permissions, an unavailable command |
| `toolCallsPerEdit` | search-and-read cost per change. **> 25** ⇒ no map: it re-discovers the codebase every run |
| `interrupts` | human stopped it mid-flight. Each one is a run that was going somewhere the human did not want |

A session that thrashed, or a file in `churnFiles` with a rework commit,
is the evidence that justifies prescribing a **gauntlet** or a **subloop**
(`patterns.md`) — not a hunch that the task is hard.

## Autonomy load (what it cost a person)

| metric | reads as |
|---|---|
| `humanTurnsPerSession` | how often a person had to speak. **> 3** on a loop that claims to be autonomous is an Invalid finding, not a preference |
| `interrupts` | as above |
| gate-log entries vs commits | gates that block, per unit of work |

## Plan quality (was the work well-formed before it started)

Judged from the records, not the tokens:

- share of open items with a stated acceptance test,
- `vagueItems` — open items worded only as judgement (*improve, review,
  clean up*),
- whether the sessions that thrashed were working on a vague item. That
  correlation is the finding: **the run failed because the item was not a
  task yet**, and it routes to `requeue`, not to a bigger model.

## Agent fit

`modelMix` and `subagentMix` say who did the work; `topTools` says what
they did. Judge against `agent-fit.md`. The two failures to look for:

- **over-powered**: the heaviest model spending its output on file
  reading, renames, formatting, log grepping.
- **under-powered / unrouted**: no subagent used on a task whose evidence
  is a wide search (`toolCallsPerEdit` high, Grep/Glob dominating
  `topTools`), or a verify step performed by the same context that wrote
  the code — no independent check ever happened.

## Honesty rules

- Missing transcripts ⇒ the budget half is `NOT MEASURED`. Say so; do not
  infer tokens from commit sizes.
- One window is a sample. Say the window and the session count next to
  every rate.
- Correlation is stated as correlation. "Both sessions that thrashed were
  on the same vague item" is evidence; "vague items cause thrash" is not.
