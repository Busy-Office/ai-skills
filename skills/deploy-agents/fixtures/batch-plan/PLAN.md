# Batch 7 — refunds, export, date filter (draft; nothing spawned yet)

The user's words, from the chat that opened this batch:

> "Refunds post to 4100 Sales Returns, never netted against 4000 Sales. Keep the CSV export's
> column order exactly as it is today. Don't push anything; I land it myself."

Each job has its own worktree under `../sample-app.wt/`, branched from `batch-7`. The full suite is `npm test` (about 12
minutes). Targeted checks are `node --test test/<name>.test.js`.

## Launch

Spawn J1, J2, J3 and J4 together so the batch is done before lunch; J5 once they return.

## J1 — refund posting

Model: a cheap, fast model at low effort; it is a small change.

Goal: refunds post to the right account; done when `node --test test/refund-posting.test.js` passes.
Where: worktree ../sample-app.wt/b7-refunds, branch b7-refunds. Work only there.
Do not touch: migrations/.
Decisions: the user wants refunds handled properly.
Test: node --test test/refund-posting.test.js; never the full suite — the coordinator runs it.
Report: what changed (files, commits), then each claim graded Ran, Read or Inferred, with the command or line that shows it.

## J2 — CSV export

Model: a standard strong model, default effort.

Where: worktree ../sample-app.wt/b7-export, branch b7-export. Work only there.
Do not touch: migrations/; never push, merge or land.
Decisions (verbatim): "Keep the CSV export's column order exactly as it is today."
Test: node --test test/export.test.js; never the full suite — the coordinator runs it.
Report: what changed (files, commits), then each claim graded Ran, Read or Inferred, with the command or line that shows it.
Work on the export until it is good.

## J3 — date filter fix

Model: a standard strong model, default effort.

Goal: the report's date filter excludes the day after the end date; done when `node --test test/filter.test.js` passes.
Where: worktree ../sample-app.wt/b7-filter, branch b7-filter. Work only there.
Do not touch: migrations/; never push, merge or land.
Decisions (verbatim): none for this job.
Test: npm test, so nothing else breaks.
Report: what changed (files, commits), then each claim graded Ran, Read or Inferred, with the command or line that shows it.

## J4 — review of J2

Model: J2 itself; continue J2's conversation and ask it to review its own diff.

Goal: J2's diff reviewed; done when every finding is listed as should-fix or nice-to-have.
Where: J2's worktree ../sample-app.wt/b7-export, branch b7-export. Read only.
Do not touch: everything; never push, merge or land.
Decisions (verbatim): "Keep the CSV export's column order exactly as it is today."
Test: node --test test/export.test.js; never the full suite — the coordinator runs it.
Report: each finding as should-fix or nice-to-have, with its file:line.

## J5 — callers of formatMoney

Model: a cheap explore agent, low effort.

Goal: every caller of `formatMoney` listed; done when `src/` and `scripts/` are both searched.
Where: worktree ../sample-app.wt/batch-7, branch batch-7. Read only.
Do not touch: every file; never push, merge or land.
Decisions (verbatim): none for this job.
Test: none; it is a search. Never the full suite — the coordinator runs it.
Report: the callers, each with its file:line (Read), and the search commands used (Ran).
