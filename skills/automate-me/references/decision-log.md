# The decision log

One JSON object per line in `~/.claude/decision-log.jsonl`. It lives in the user's own Claude Code
config folder and stays on this machine: never commit it, publish it, attach it to a report or send
it to an outside service (the `jev` skill included). If the user keeps their config folder somewhere
else, use that.

Sessions append to it while they work (the rule the "How I work" section installs). `automate-me`
only reads it, through `scripts/decisions.mjs`, which does the counting.

## A decision

Written once the user has answered a decision the agent put to them, or once a settled decision has
been reported and the user has had the chance to reverse it.

```json
{"ts": "2026-11-21T10:04:00Z", "type": "decision", "kind": "dependency-bump",
 "question": "Bump the test runner from 3.1 to 3.2?", "options": ["yes", "no"],
 "recommendation": "yes", "confidence": 0.85,
 "evidence": {"ran": 2, "read": 1, "inferred": 0},
 "mode": "asked", "answer": "yes", "outcome": "accepted",
 "corrections": [{"kind": "noise", "note": "the question listed three unrelated options"}]}
```

| field | meaning |
|---|---|
| `kind` | a short, stable, generic slug for the class of decision (`dependency-bump`, `schema-change`, `release`). Reuse an existing kind before inventing one; the learning is per kind. |
| `question`, `options` | as put to the user |
| `recommendation`, `confidence` | what the agent recommended, and how sure it was (0–1) |
| `evidence` | how many facts behind the recommendation were **ran** (a tool printed it), **read** (`file:line`) and **inferred** |
| `mode` | `asked` (the user decided) or `settled` (the agent decided and reported afterwards) |
| `answer` | what the user chose, or did not reverse |
| `outcome` | `accepted` (the recommendation stood) or `changed` (the user chose otherwise, or reversed a settled one) |
| `corrections` | the user's follow-up corrections on this decision, each `{kind, note}` |
| `repo` | optional; the log is local, so this may name the repository |

## A correction on its own

A correction can follow work that was not a decision:

```json
{"ts": "2026-11-21T11:30:00Z", "type": "correction", "kind": "false-alarm", "note": "reported a CI failure that was a stale cache"}
```

Correction kinds — use exactly these:

| kind | the user said, in effect |
|---|---|
| `noise` | unnecessary, or too long |
| `unproven` | you claimed it without showing it |
| `obsolete` | that was true once and is not now |
| `false-alarm` | the problem you raised is not real |
| `incomplete` | you said done and something is missing |
| `inaction` | you should have just done it, or asked sooner |

## What the counts mean

`node scripts/decisions.mjs [log] --reserve kindA,kindB` prints, per kind, a `status`:

- **`may-settle`** — accepted 5 or more times in its last 10 decisions, none changed. It may be
  *proposed* as "settle and report afterwards". The user approves the move; the script never moves it.
- **`ask`** — anything else. One `changed` outcome inside the window sends a settled kind back to
  `ask`; propose removing it from the settled list.
- **`reserved`** — a kind the user keeps for themselves. It never moves, whatever its record.

and, per correction kind, `propose: true` once it is seen 2 or more times. Each proposal becomes one
operational rule in the "How I work" section, written from the notes, not from the kind's name.

## Calibration is a different thing

How far to trust a source of confidence — a second-opinion verdict that later turned out right or
wrong, a test suite that passed on a broken build — is calibration of the tool, not knowledge of the
user. Keep it out of this log and out of the user's rules. If it is tracked at all, it goes in its own
file and changes how much weight a source gets, never what the user is said to prefer.
