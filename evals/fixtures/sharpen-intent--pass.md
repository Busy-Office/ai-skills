# Intent review — sample-app

Purpose is stated in two places and no rules file points at either, so no actor
loads one. Five of seven statements are outputs, not changes for anyone.

## Where purpose is stated

| file | intent headings | outcome / output-only | measured | loaded by a rules file? |
|---|---|---|---|---|
| `intent.md` | Purpose · Non-goals | 2 / 5 | 1 | no |
| `README.md` | — | 0 / 2 | 0 | n/a |

**Canonical:** `intent.md` — nothing points at it.

## Score

**Verdict: decorative** · mean 2.2 / 5
**Caps:** nothing loads `intent.md`, so canonicity is 1 and the verdict is capped at decorative regardless of the mean.

| dimension | score | why |
|---|---|---|
| clarity | 2 | 5 of 7 statements are outputs |
| falsifiability | 3 | one measure, no falsifier |
| focus | 2 | 5 objectives, none marked current |
| boundaries | 3 | one non-goal, costs nothing |
| canonicity | 1 | no rules file references `intent.md` |
| traceability | 2 | 7 of 17 items share language (0.41) |

## Does the work trace back?

| untraced item | where | reading |
|---|---|---|
| Add SSO login | `docs/BACKLOG.md:11` | intent is out of date |

## The draft

```markdown
# Intent
**For** a data analyst at a small company, who today waits two days on an engineer.
**The change:** they answer a new question without involving one.
**We will know it worked when** median time-to-answer is under 10 minutes by Q3.
**It was wrong if** analysts still route questions through an engineer after export ships.
TO DECIDE — is the audience one analyst, or the team?
```

## Do next

1. Put the draft at `intent.md` and point `CLAUDE.md` at it.
2. Answer the audience question.
3. Re-run requeue.

---
*Read 2 documents and 17 open items · draft not written to the repo · target repo untouched.*
