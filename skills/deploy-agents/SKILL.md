---
name: deploy-agents
description: "How to deploy subagents on a batch of work: which model and effort per job, the limits, the brief every agent gets, and an optional Workflow script for the build-to-fix steps. Use before spawning a builder, reviewer, fixer or search agent, when writing an agent brief, or before citing an agent's report. Designing or reviewing the graph of a multi-agent run is graph-engineer."
---

# Deploy agents

You are the **coordinator**. Agents do the work; you pick them, brief them, check what they claim,
and carry the result to the user. You cite only what you checked yourself.

## Pick the agent for the job

| job | model and effort |
|---|---|
| hard-rule code: money, posting, concurrency, security, anything a test cannot fully pin | the strongest model, high effort |
| an ordinary build or fix | a standard strong model, default effort |
| review | per `principle-fresh-reviewer`: another model, or a fresh context |
| a page, a doc or a report draft | a cheaper model |
| a search, a lookup, a re-run of a command | a cheap or explore agent, low effort |

## Limits

`principle-guard-the-machine`: at most 3 agents at once, one full test suite at a time, short
commands inside agents.

## The brief

An agent knows only its brief. Every brief carries all of these:

```
Goal: <one sentence: what is true when it is done>
Where: worktree <path>, branch <name>. Work only there.
Do not touch: <paths, files, services; and: never push, merge or land>
Decisions (verbatim): <the user's words, quoted, not summarised>
Test: <exact commands for targeted checks>; never the full suite — the coordinator runs it
Report: what changed (files, commits), then each claim graded Ran, Read or Inferred
        (principle-prove-it-works), with the command or line that shows it
```

## The batch

The steps from worktree to landing are the `feature` playbook in `busy-office-mode`.

## Workflow option (trial on one batch first; compare tokens with the manual way)

[`references/batch.workflow.js`](references/batch.workflow.js) runs the `feature` playbook's Build,
Verify claims, Review and Fix rounds steps as one Workflow script: builder, a cheap verifier on each
edge, a fresh reviewer, and a fresh fixer while should-fix findings stay open, under the
`improve-until-done` stop rules. Agents in it run targeted checks only. Its header lists every
status it can return. Only the round records and the result come back to your context. The other
steps stay with you: on done, you run the Final check (the full suite, alone) after the workflow.

The Workflow tool runs only when the user explicitly opts in. Fill `args` from the brief (the
header comment lists the fields). Every agent in it is a fresh context; set `reviewModel` to another
model than `buildModel` when one is available, and the script logs it when they match. Check its
stop rules without spending tokens: `node scripts/dry-run.mjs --self-test`. To change the graph's
shape (fan out, add verifiers, tier models), use `graph-engineer`.
