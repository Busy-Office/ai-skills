# Metrics — what each number means

Every number below comes out of `runs.mjs`. A number is not a finding.
A number **with a band and a named cause** is.

## Budget (what the loop spends)

| metric | where | reads as |
|---|---|---|
| `billableTokens` | input + output + cache-creation, summed over sessions | the bill for the window. Cache *reads* are not in it — report them separately, never add them in |
| `tokensPerCommit` | billable ÷ commits | the unit cost *if every commit shipped something*. Read it beside the next row, never alone |
| `tokensPerShippingCommit` | billable ÷ (commits that touched anything but the loop's own records) | **the honest unit cost.** This is the number to lead with |
| `commitsByKind`, `recordOnlyShare` | commits split code / mixed / record-only | how much of the commit count is bookkeeping |
| `tokensPerSession` | billable ÷ sessions | run size. Rising with flat `tokensPerCommit` means bigger runs, not worse ones |
| `cacheHitRate` | cache-read ÷ (cache-read + cache-create + input) | prompt-cache discipline. **< 0.6** with many short runs ⇒ the loop rebuilds context every tick |
| `outputTokens`, `thinkingShare` | thinking ÷ output | **> 0.6** on routine mechanical work means the actor is reasoning where it should be reading a rule |
| `sidechainShare` | subagent tokens ÷ billable | fan-out cost. **> 0.5** with `commits` flat ⇒ the crew researches more than it ships |
| `perAgent[type]` | one row per subagent type: runs, tokens, `avgTokensPerRun`, model, `topTools` | **what a summon of each actually costs.** This is the number an agent-fit decision needs, and the one people guess at |
| `commitCoverage` | `git commit` calls seen in the transcripts ÷ commits in the window | whether these sessions are the ones that made these commits. Below **0.5**, tokens-per-commit is mixing two populations — see below |
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

## The bookkeeping trap

A loop that appends to its own log and commits it every tick manufactures
commits that shipped nothing. They land in the denominator and the unit cost
falls, so the loop looks more efficient the more bookkeeping it does.

Measured across six real projects, `recordOnlyShare` ran from 0 to 0.57, and
correcting for it **reordered the ranking completely**: the project that looked
cheapest at 106k was 245k once its 57% record-only commits came out, and the one
that looked mid-table at 296k turned out to be the most expensive of the six at
597k. Any conclusion drawn from the uncorrected number was wrong.

Report both, always, and lead with the corrected one:

> 216M billable over 779 shipping commits — **245k each**. A further 1 250
> commits (57%) touched only the loop's own records; counting those gives 106k,
> which is the number not to quote.

The same caution applies to any per-commit rate, `reworkRate` included: a
bookkeeping commit cannot be rework, so a loop that commits its log often has a
flattering rework rate for the same reason.

## The population trap

A loop that runs headless — a cron driver, a CI job, a remote session — leaves
no transcript under `~/.claude/projects/<project>`. The commits are still in
git. Divide one by the other and you get a confident number about two
different populations.

`commitCoverage` is the test, and it counts **`git commit` calls in the
transcripts**, not session timespans: one long interactive session's window
spans every commit in the repo and proves nothing. A share above 1 is normal
(retries and amends each count a call). A share below 0.5 means most of the
work is invisible here: report the unit cost over the covered commits, or mark
it `NOT MEASURED` and say which runs you could not see.

## Honesty rules

- Missing transcripts ⇒ the budget half is `NOT MEASURED`. Say so; do not
  infer tokens from commit sizes.
- One window is a sample. Say the window and the session count next to
  every rate.
- Correlation is stated as correlation. "Both sessions that thrashed were
  on the same vague item" is evidence; "vague items cause thrash" is not.
