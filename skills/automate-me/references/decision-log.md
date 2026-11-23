# The decision log

One JSON object per line in `~/.claude/decision-log.jsonl`. It lives in the user's own Claude Code
config folder and stays on this machine: never commit it, publish it, attach it to a report or send
it to an outside service (the `jev` skill included). If the user keeps their config folder somewhere
else, use that.

Sessions append to it while they work (the rule the "How I work" section installs). `automate-me`
only reads it, through `scripts/decisions.mjs`, which does the counting. `scripts/backfill.mjs`
proposes lines from one past session for the user to review; it never writes the log either.

## A decision

Written once the user has answered a decision the agent put to them, or once a settled decision has
been reported and the user has had the chance to reverse it.

```json
{"ts": "2026-11-21T10:04:00Z", "type": "decision", "kind": "dependency-bump",
 "question": "Bump the test runner from 3.1 to 3.2?", "options": ["yes", "no"],
 "prediction": "yes", "prediction_confidence": 0.9,
 "recommendation": "yes", "confidence": 0.85,
 "evidence": {"ran": 2, "read": 1, "inferred": 0},
 "mode": "asked", "answer": "yes", "outcome": "accepted",
 "corrections": [{"kind": "noise", "note": "the question listed three unrelated options"}]}
```

| field | meaning |
|---|---|
| `kind` | a short, stable, generic slug for the class of decision (`dependency-bump`, `schema-change`, `release`). Reuse an existing kind before inventing one; the learning is per kind. |
| `question`, `options` | as put to the user |
| `prediction`, `prediction_confidence` | the answer `automate-me` predicted the user would give, from the "How I work" section and this log's past answers for the kind, and how sure (0–1). Recorded **before** the recommendation is formed, so it cannot copy it. `null` when unknown (a backfilled past decision). |
| `recommendation`, `confidence` | what the agent recommended, and how sure it was (0–1) |
| `evidence` | how many facts behind the recommendation were **ran** (a tool printed it), **read** (`file:line`) and **inferred** |
| `mode` | `asked` (the user decided) or `settled` (the agent decided and reported afterwards) |
| `answer` | what the user chose, or did not reverse |
| `outcome` | `accepted` (the recommendation stood) or `changed` (the user chose otherwise, or reversed a settled one) |
| `corrections` | the user's follow-up corrections on this decision, each `{kind, note}` |
| `repo` | optional; the log is local, so this may name the repository |
| `source` | optional; set by `backfill.mjs`: the session id and the question's header |

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

## Reserved kinds

These kinds never graduate, whatever their record. Use exactly these slugs for them, so the reserve
list catches them:

| kind | the decision |
|---|---|
| `land-shared-branch` | landing or pushing on a branch other people or the release build from |
| `money-rule` | how money is computed, rounded, posted or reported |
| `contract-wording` | the wording of an interface, an API or a legal text others rely on |
| `protected-file` | a governed or protected file: rules, constitution, CI, permissions |
| `irreversible` | anything that cannot be undone: deleting data, publishing, sending |

`--reserve kindA,kindB` adds kinds the user also keeps; `--unreserve kindC` takes one of these off,
only on the user's word. The script prints the list it used.

## What the counts mean

`node scripts/decisions.mjs [log] --reserve kindA,kindB` prints, per kind, a `status`. A kind is
scored on its **predictions**, not its recommendations: the prediction is what a settled kind would
act on. A prediction counts when it is recorded and the user answered the decision themselves
(`mode: asked`).

- **`may-settle`** — 20 or more predictions, 95 % or more of them equal to the answer, and **no
  reversal** in its last 10 decisions. It may be *proposed* as "settle and report afterwards". The
  user approves the move; the script never moves it.
- **`ask`** — anything else. A reversal is a prediction that missed, or a settled decision the user
  overturned (`mode: settled`, `outcome: changed`); one inside the last 10 sends a settled kind back
  to `ask`, so propose removing it from the settled list.
- **`reserved`** — on the reserve list. It never moves.

Each kind also shows `recommendation_correct` beside `correct`, so the user can see whether the
prediction or the recommendation reads them better.

Per correction kind, `propose: true` once it is seen 2 or more times. Each proposal becomes one
operational rule in the "How I work" section, written from the notes, not from the kind's name.

## Backfill from past sessions

`node scripts/backfill.mjs <session.jsonl> [--kind <slug>]` reads one transcript and prints one
proposed line per question answered through `AskUserQuestion`: the question, the options, the one
marked "(Recommended)" as `recommendation`, the answer, `mode: asked`, `prediction: null`. The
predictions are unknown for the past, so these lines add to `recommendation_correct` and never to
graduation. `kind` is `null` unless given: the user sets it per line, keeps the lines they want and
appends them; `decisions.mjs` skips a line with no kind as malformed.

## Calibration is a different thing

How far to trust a source of confidence — a second-opinion verdict that later turned out right or
wrong, a test suite that passed on a broken build — is calibration of the tool, not knowledge of the
user. Keep it out of this log and out of the user's rules. If it is tracked at all, it goes in its own
file and changes how much weight a source gets, never what the user is said to prefer.
