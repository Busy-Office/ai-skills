# The plan check

The reply when a batch plan is checked before anything is spawned: what is wrong, the fixed
briefs, the launch. Prose outside tables and code: **≤ 300 words**; each brief is a code block, so
it pastes into the spawn as it is.

````markdown
# <batch> — <N defects>, <the jobs already right>

<≤ 50 words: the defects that would cost the most, and which briefs stand as written.>

## Defects

| defect | where | rule it breaks | fix |
|---|---|---|---|
| 4 agents in flight | `PLAN.md:13` | limit: 3 agents at once | waves below |
| money code on a cheap model | `PLAN.md:17` | job table: the strongest model, high effort | strongest model, high effort |

## Fixed briefs

### J1 — <the plan's own job heading>

```text
Model: <model and effort, from the job table>
Goal: <what is true when it is done; done when <check> passes>
Where: worktree <path>, branch <name>. Work only there.
Do not touch: <paths>; never push, merge or land.
Decisions (verbatim): "<the user's words>"
Test: <targeted commands>; never the full suite — the coordinator runs it
Report: what changed (files, commits), then each claim graded Ran, Read or Inferred
```

### J5 — <job>

Unchanged: `PLAN.md:<lines>`.

## Launch

1. Wave 1: <at most 3 jobs>.
2. Wave 2: <a review once the job it reviews returns>, <…>.
3. The coordinator runs the full suite once, alone, after the last wave.

---
*Read N files (<names>) · nothing spawned, no test run.*
````

- **Defects**: one row per defect, with the `file:line` and the rule it breaks: a brief field
  (Goal, Where, Do not touch, Decisions, Test, Report), the job table, or a limit.
- **Fixed briefs**: the plan's job headings, each brief rewritten with every field; a brief that
  was already right is named as unchanged, not rewritten.
- **Launch**: waves of at most 3, ≤ 5 lines.
- **Receipt**: nothing spawned, no Workflow or test started.
