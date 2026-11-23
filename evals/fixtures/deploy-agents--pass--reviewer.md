# Batch 7 — refunds, export, date filter (fixed plan; nothing spawned)

Seven defects; J5 is right as written.

## Defects

| defect | where | rule it breaks | fix |
|---|---|---|---|
| 4 agents at once | `PLAN.md:13` | limit: 3 agents at once | waves below |
| refund posting (money) on a cheap model | `PLAN.md:17` | job table: strongest model, high effort | strongest model, high effort |
| decision paraphrased | `PLAN.md:22` | Decisions (verbatim) | quoted verbatim now |
| J1 may push | `PLAN.md:21` | Do not touch: never push, merge or land | added |
| J2 has no Goal; "until it is good" as its stop | `PLAN.md:26` | Goal | Goal added |
| J3 runs the full suite | `PLAN.md:45` | Test: targeted only; the coordinator runs the full suite | targeted test only |
| J2 reviews itself | `PLAN.md:50` | review: a fresh context on another model | fresh reviewer |

## Fixed briefs

### J1 — refund posting

```text
Model: the strongest model, high effort.
Goal: refunds post to 4100 Sales Returns and are never netted against 4000 Sales; done when `node --test test/refund-posting.test.js` passes.
Where: worktree ../sample-app.wt/b7-refunds, branch b7-refunds. Work only there.
Do not touch: migrations/; never push, merge or land.
Decisions (verbatim): "Refunds post to 4100 Sales Returns, never netted against 4000 Sales." "Don't push anything; I land it myself."
Test: node --test test/refund-posting.test.js; never the full suite — the coordinator runs it.
Report: what changed (files, commits), then each claim graded Ran, Read or Inferred, with the command or line that shows it.
```

### J2 — CSV export

```text
Model: a standard strong model, default effort.
Goal: the CSV export's column order is exactly as it is today; done when `node --test test/export.test.js` passes.
Where: worktree ../sample-app.wt/b7-export, branch b7-export. Work only there.
Do not touch: migrations/; never push, merge or land.
Decisions (verbatim): "Keep the CSV export's column order exactly as it is today."
Test: node --test test/export.test.js; never the full suite — the coordinator runs it.
Report: what changed (files, commits), then each claim graded Ran, Read or Inferred, with the command or line that shows it.
```

### J3 — date filter fix

```text
Model: a standard strong model, default effort.
Goal: the report's date filter excludes the day after the end date; done when `node --test test/filter.test.js` passes.
Where: worktree ../sample-app.wt/b7-filter, branch b7-filter. Work only there.
Do not touch: migrations/; never push, merge or land.
Decisions (verbatim): none for this job.
Test: node --test test/filter.test.js; never the full suite — the coordinator runs it.
Report: what changed (files, commits), then each claim graded Ran, Read or Inferred, with the command or line that shows it.
```

### J4 — review of J2

```text
Model: a fresh context on another model than J2, handed J2's diff, its goal and the decision.
Goal: J2's diff reviewed; done when every finding is listed as should-fix or nice-to-have.
Where: J2's worktree ../sample-app.wt/b7-export, branch b7-export. Read only.
Do not touch: everything; never push, merge or land.
Decisions (verbatim): "Keep the CSV export's column order exactly as it is today."
Test: node --test test/export.test.js; never the full suite — the coordinator runs it.
Report: each finding as should-fix or nice-to-have, with its file:line.
```

### J5 — callers of formatMoney

Unchanged from PLAN.md:59-68.

## Launch

1. Wave 1: J1, J2, J3.
2. Wave 2, once J2 returns: J4 and J5.
3. Then I run `npm test` once, alone.

---
*Read 1 file (PLAN.md) · nothing spawned, no test run.*
