---
name: deploy-agents
description: "How to deploy subagents on a batch of work: which model and effort per job, at most 3 agents and one full test suite at a time, the brief every agent gets, and the standard batch (worktree → build → re-run claims → fresh review → fix → final check → explain → user yes → land), with an optional Workflow script for it. Use before spawning a builder, reviewer, fixer or search agent, when writing an agent brief, or when an agent's report is about to be cited."
---

# Deploy agents

You are the **coordinator**. Agents do the work; you pick them, brief them, check what they claim,
and carry the result to the user. You cite only what you checked yourself.

## Pick the agent for the job

| job | model and effort |
|---|---|
| hard-rule code: money, posting, concurrency, security, anything a test cannot fully pin | the strongest model, high effort |
| an ordinary build or fix | a standard strong model, default effort |
| review | always a **different model or a fresh context** from the builder; never the builder reviewing itself |
| a page, a doc or a report draft | a cheaper model |
| a search, a lookup, a re-run of a command | a cheap or explore agent, low effort |

## Limits

- **At most 3 agents at once.**
- **One full test suite at a time**, across every agent and the coordinator. Parallel full suites
  starve each other and can crash with no summary; that looks like a red build and wastes a round.
  Agents run targeted tests; the full suite runs once, alone, at the end.

## The brief

An agent knows only its brief. Every brief carries all of these:

```
Goal: <one sentence: what is true when it is done>
Where: worktree <path>, branch <name>. Work only there.
Do not touch: <paths, files, services; and: never push, merge or land>
Decisions (verbatim): <the user's words, quoted, not summarised>
Test: <exact commands for targeted checks>; never the full suite — the coordinator runs it
Report: what changed (files, commits), then each claim graded Ran (a tool printed it),
        Read (file:line) or Inferred, with the command or line that shows it
```

## The standard batch

1. **Worktree** — create one branch and worktree for the batch.
2. **Build** — one builder, briefed as above.
3. **Verify** — re-run the builder's Ran claims and open its Read citations yourself, or hand that
   to a cheap agent. A claim that does not reproduce is a finding, not a fact.
4. **Review** — a fresh reviewer (another model or a new context) reads the diff against the goal
   and the decisions, and lists should-fix and nice-to-have findings.
5. **Fix** — a fresh fixer per round, briefed with the open findings. Rounds and when to stop
   follow `improve-until-done`: at most 3 review rounds, stop on done, plateau, budget, scope growth
   or a claim that cannot be verified.
6. **Final check** — the full suite, run alone, by you.
7. **Explain** — one short page or message: what changed, why, the evidence with its grades, what
   is still open.
8. **User yes** — ask one yes/no question about that exact version.
9. **Land** — through the repository's own flow, only after the yes.

## Workflow option (trial on one batch first; compare tokens with the manual way)

[`references/batch.workflow.js`](references/batch.workflow.js) runs steps 2–6 as one Workflow
script: builder, a cheap verifier on each edge, a fresh reviewer, a fixer while should-fix findings
stay open, the stop rules of `improve-until-done`, and the final check only on done. Only the round
records and the final result come back to your context. Steps 1 and 7–9 stay with you, and you
still re-run the final check before citing it.

The Workflow tool runs only when the user explicitly opts in. Fill `args` from the brief (the
header comment lists the fields; `reviewModel` must differ from `buildModel`). Check its stop rules
without spending tokens: `node scripts/dry-run.mjs --self-test`. To change the graph's shape (fan
out, add verifiers, tier models), use `graph-engineer`.
