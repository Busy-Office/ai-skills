# What is shown before writing

What automate-me shows the user at step 6, before anything is written. Prose outside tables and
code: **≤ 300 words**.

````markdown
# How I work — <first draft | update>

<≤ 50 words: how many rules and settled kinds are proposed, each seen at least twice, and that
nothing is written yet.>

## Signals

| signal | source | verdict |
|---|---|---|
| <a preference> | `<memory>.md:<line>` in 2 projects | kept |
| <a preference> | 2 sessions (`<id>`, `<id>`) | kept |
| <a preference> | 1 session (`<id>`) | dropped |
| <a repository's command> | `<memory>.md:<line>` | repository |
| <how far to trust a judge or a suite> | `<memory>.md:<line>` | calibration |

## Decision log

| kind | status from decisions.mjs | proposal |
|---|---|---|
| <kind> | may-settle, <counts> | settle and report afterwards |
| <kind> | may-settle, prediction never differed | held back: tripwire |
| <kind> | reserved | never moves |

## Repository rules (not written)

- <the rule> — from `<memory>.md:<line>`; it belongs in that repository's instructions.

## To decide

1. <question>
   - <option> (Recommended)
   - <option>
   - <option>

## Draft

```diff
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ … @@
+## How I work
+
+- <a rule the user said at least twice>
```

---
*Read N files, ran decisions.mjs · CLAUDE.md not written.*
````

- **Signals**: one row per signal with its source and a verdict: kept, dropped (one session),
  contradicted, repository, calibration.
- **Decision log**: each kind's status as `scripts/decisions.mjs` printed it; on a first run with
  no log, one line saying so.
- **To decide**: one or two questions, 3–5 options each, one marked (Recommended).
- **Draft**: a unified diff against the current `~/.claude/CLAUDE.md`; no project, person or
  repository path in it.
- **Receipt**: what was read, that `decisions.mjs` ran, and that `CLAUDE.md` was not written.
