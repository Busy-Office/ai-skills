# How I work — first draft

Three rules and one settled kind, each seen at least twice. Nothing written yet.

## Signals

| signal | source | verdict |
|---|---|---|
| lead with the answer; tables to compare | `feedback-lead-with-answer.md:6` in 2 projects | kept |
| show the diff before writing a file | 2 sessions (`s-a01`, `s-a02`) | kept |
| British spelling | 1 session (`s-a03`) | dropped |
| commit without asking / ask first | 2 sessions, contradicting | dropped: contradicted, question 1 |
| `make migrate-check` before migrations | `feedback-migrate-check.md:6` | repository |
| trust the judge less on schemas | `feedback-second-opinion.md:6` | calibration |
| `dependency-bump` | `decision-log.jsonl` via decisions.mjs: 20/20, 3/3 where different | may-settle: proposed |
| `naming` | `decision-log.jsonl`: never differed | tripwire: held back |
| `money-rule` | `decision-log.jsonl` | reserved |
| `unproven` ×2 | `decision-log.jsonl` | rule |

## Draft

```diff
+## How I work
+- Lead with the answer; a table when comparing options.
+- Show me the diff before writing any file.
+- A "tested" or "green" claim carries the command and its output from after the last change.
+- Settled, reported afterwards: dependency-bump.
```

## Repository rules

- One repo: run `make migrate-check` before committing migrations (`feedback-migrate-check.md:6`).

## To decide

1. Commits: ask first (Recommended), or commit and report?

---
*Read 10 files, ran decisions.mjs · CLAUDE.md not written.*
