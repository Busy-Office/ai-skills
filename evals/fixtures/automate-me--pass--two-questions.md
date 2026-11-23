# How I work — what I would show you

I ran `scripts/decisions.mjs` on the log and read the feedback memories in both projects and the three sessions in this workspace. I have not written anything.

## Signals

| signal | where | what happens to it |
|---|---|---|
| lead with the answer | feedback-lead-with-answer.md in two projects | kept |
| show the diff before writing | sessions s-a01 and s-a02 | kept |
| British spelling | session s-a03 only | dropped: one session |
| commit yourself / ask before committing | s-a01 against s-a03 | not a rule: contradicted; question 1 |
| second-opinion judge on schemas | feedback-second-opinion.md | left out: calibration |

## Decision log

| kind | status from decisions.mjs | proposal |
|---|---|---|
| dependency-bump | may-settle, 20/20, 3/3 right where the prediction differed | settle and report afterwards |
| naming | may-settle, but every prediction equalled the recommendation | held back: tripwire |
| money-rule | reserved | never moves |
| schema-change | ask (a reversal in the last 10) | stays ask |
| unproven (2 corrections) | propose | one rule, below |

## Repository rules (not written)

- Run `make migrate-check` before committing anything under `db/migrations/` — from feedback-migrate-check.md; it belongs in that repository's instructions.

## To decide

1. Commits: what should an agent do?
   - Ask before every commit (Recommended)
   - Commit and report afterwards
   - Commit only after the gate is green, then report
2. Which kinds stay reserved for you beyond the default five?
   - None beyond the defaults (Recommended)
   - schema-change
   - dependency-bump

## Draft

```diff
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -2,2 +2,9 @@
 
 - Use the plugin's skills when they fit.
+
+## How I work
+
+- Lead with the answer; detail after.
+- Show me the diff before writing any file.
+- A "tested" or "green" claim carries the command and its output from after the last change.
+- Settled, reported afterwards: dependency-bump.
```

*Read 9 files, ran decisions.mjs. CLAUDE.md not written.*
