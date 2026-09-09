# Run review — sample-app · last 14 days

12 runs shipped 7 commits. A commit costs 168k billable tokens, most of it
re-reading the tree. Nothing verifies before commit: 2 of 7 commits fix a file
an earlier run already touched.

## The economics

| | |
|---|---|
| runs / commits | 12 / 7 |
| tokens per commit | 168k (billable; cache reads 3.1M, not billed here) |
| cache hit rate | 0.44 |
| subagent share | 0.06 |
| rework rate | 0.29 (2 commits) |
| human turns per run | 1.2 · interrupts 1 |

## Score

**Verdict: expensive** · mean 2.3 / 5

| dimension | score | why |
|---|---|---|
| effectiveness | 4 | 7 commits; done-count moved 4 → 7 |
| efficiency | 2 | 31 tool calls per edit |
| budget | 2 | cache 0.44; `docs/LOOP-STATUS.md` (1 900 lines) read at wake |
| plan quality | 3 | 6 of 11 items state acceptance |
| agent fit | 1 | no verifier ran in any session |
| convergence | 2 | rework 0.29; `src/csv.ts` in 5 commits |

## Findings

| id | class | what | evidence | fix |
|---|---|---|---|---|
| F1 | Misroute | nothing checks the work before commit | no verify step in 12 sessions | verifier seam, one context per item |
| F2 | Leak | heaviest model does its own sweeping | `docs/LOOPS.md:22` · 31 calls/edit | route the reading to a search subagent |
| F3 | No-converge | one command repeated 5× in a run | session s-91ab | subloop N=3, each round changes approach |
| F4 | Ill-formed | thrashing run was on an unstated item | `docs/BACKLOG.md:14` | hand to requeue |

## Do next

1. Add the verifier seam — closes F1.
2. Route the searching out — closes F2.
3. Archive the status log at 500 lines.

---
*Read 12 transcripts (14d) and 7 commits · no state file read whole · target repo untouched.*
