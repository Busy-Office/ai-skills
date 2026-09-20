# Gate design

A gate file is pure data. The model call, the rules and the calibration
record live in one place so that a reader — or `loop-doctor` — can see what
was asked, what was decided from it, and what evidence admitted it.

## The file

```json
{
  "gate": "merge-risk",
  "version": 1,
  "mode": "shadow",
  "purpose": "One sentence: the decision, and what it never decides.",
  "state_shape": { "change": { "diff": "what the driver puts here" } },
  "max_state_chars": 6000,
  "questions": { "<name>": { "type": "choice | noul | score", "…": "…" } },
  "rules": [ { "if": { "…": "…" }, "then": "<action>" } ],
  "default": "<action when no rule fires>",
  "unreachable": "<action when KEV cannot answer — the highest rank>",
  "actions": { "<action>": { "rank": 0, "reversible": true, "does": "…" } },
  "calibration": { "model": "…", "threshold_from": "…", "note": "…" }
}
```

Bump `version` whenever a question, a rule or a threshold changes. The
version is written to every log line, so a shadow report never mixes two
gates' answers.

## Questions

The API takes three types. What each returns, and what the gate sees as
facts:

| type | criteria | answer | facts |
|---|---|---|---|
| `choice` | `{option: description}` | probabilities per option | `name:option` → probability |
| `noul` | `{true:{what,examples}, false:{what,examples}}` | probability the state supports the statement | `name` → probability |
| `score` | ordered rubric, 2–255 entries | expected position on the rubric | `name` → score |

`noul` is a statement-supported-by-state probability, not a yes/no belief:
"did the tests pass?" scored 0.98 on a green log, "did the tests fail?"
0.17, "is it raining in Paris?" 0.07. A `noul` about something the state
does not contain scores low whichever way it is phrased.

Instructions are an object, not a sentence:

```json
"instructions": {
  "question": "Which area does change.diff mainly touch?",
  "inspect": "change.diff",
  "focus": "optional: what to weigh",
  "ignore": ["optional: what not to be distracted by"]
}
```

`inspect` (or `compare: [a, b]`) names the path inside `state`. Use the same
key names in `state_shape`, the question and the driver.

All questions in one call share one pass over the state. Measured on this
server, packed and separate passes returned identical numbers — extra
questions cost latency (roughly linear in their length), not accuracy.

## Rules

First match wins; no match is `default`.

```json
{ "fact": "kind:owner_decision", "gte": 0.5 }
{ "fact": "risk", "lt": 0.2 }
{ "fact": "risk", "between": [0.35, 0.65] }
{ "sum": ["area:auth", "area:money"], "gte": 0.13 }
{ "any": [ … ] }   { "all": [ … ] }   { "not": { … } }
```

- **`sum`** is the workhorse for a `choice`. A small model spreads its mass;
  the top choice is often wrong while the mass across a *group* of options
  still ranks cases correctly. Thresholds on a sum can be low (0.13 in
  `merge-risk`) — that is fine, it is a ranking cut, not a belief.
- **`between`** is the uncertainty band: a fact too close to its threshold
  to act on goes up a tier. Put the band's rule before the rule it guards.
- A rule that reads a fact the answer does not contain does not evaluate to
  false — it fails open to `unreachable`.

## Actions

Every action has a `rank` — how much attention it buys, lowest first — and
`"reversible": true`. Rank is what lets calibration tell a miss from an
over-escalation, so rank by *cost of being wrong if taken unaided*, and give
lanes of equal cost the same rank (a wrong lane at the same rank is a
`misroute`).

`unreachable` must be the top rank. `default` is usually the bottom for a
risk screen (nothing fired → light) and the top for a fast-path gate
(nothing fired → the model triages, as before).

## The K rows

| id | level | what | why |
|---|---|---|---|
| K1 | error | `choice` with neither a fallback option nor `"exhaustive": true` | with no way out the model is forced to guess; the author must say which way out exists |
| K2 | error | instruction is a bare string, or lacks `question` and `inspect`/`compare` | the model is not told where in the state to look |
| K3 | error | `noul` without `criteria.true.what` and `criteria.false.what` | the boundary between yes and no is undefined |
| K4 | error | the question asks for a verdict (*safe, should, ok to, ready, approve, acceptable, good enough, trust*) | a verdict needs judgement the model does not have; screen for the risk |
| K5 | error | an action with no numeric `rank`, or not declared `reversible: true` | a gate picks who looks next; it never approves |
| K6 | error | no `unreachable`, or it is not the top rank; no `default` | an outage must not lower the bar |
| K7 | error | a rule reads a fact no question produces, or names an undeclared action | the rule can never fire, or fires into nothing |
| K8 | warn | a question no rule reads | latency for nothing |
| K9 | error | `mode` is not `shadow` or `enforce` | a new gate starts in shadow |

K1's ways out are not equivalent, and on kev-0.5b the *wording* decides.
The server's `/api/info` shows it was trained with a `None of the above`
option. Same ten areas, same twenty merge cases, three ways out:

| way out | mass it took | AUC | lowest risky vs highest safe |
|---|---|---|---|
| none — `"exhaustive": true`, safe categories as the way out | — | 1.00 | 0.16 vs 0.10 |
| `unknown: "There is not enough evidence in change.diff to tell"` | 0.04–0.53 | 1.00 | 0.08 vs 0.07 |
| `other: "None of these"` | 0.06–0.93 | 0.98 | 0.02 vs 0.03 — no threshold separates |

(With a nine-area set lacking `additive`, `None of these` took 0.62–0.98 on
every case.) So `kev-decision`'s advice — include an unknown /
insufficient-evidence option when appropriate — holds up when it is worded
as *missing evidence*; a catch-all worded like the trained none-option does
not. Either way the margin narrows, so calibrate the one you choose. The
hosted model uses `noMatch` / `noIssue` throughout the `jev-review` sample.

## Formulation findings (kev-0.5b, 2026-09-20)

Measured on `fixtures/merge-risk/tune.jsonl`, 10 risky and 10 safe cases.
AUC is the chance a risky case outranks a safe one.

| formulation | AUC | safe cases escalated at the zero-miss threshold |
|---|---|---|
| three structured `noul`s (destructive / protected / contract) | not computed | 10 of 10 (at any ≥ 0.5, which also missed nothing) |
| one short `noul` naming all the risks | 0.54 | 7 of 10 |
| two-way `choice` risky / routine | 0.86 | 6 of 10 |
| four-point `score` rubric | 0.92 | 5 of 10 |
| nine-area `choice` (no `additive`) with `other: None of these` | 0.94 | 4 of 10 |
| risky four + one "routine" option | 0.96 | 2 of 10 |
| **ten-area `choice`, exhaustive, summed risky mass** | **1.00** | **0 of 10** |

What generalises: concrete categories beat abstract properties; more,
narrower options beat fewer, broader ones; the group sum beats the argmax.
What does not: the numbers. Try two or three formulations on your tune set
before writing thresholds.

Other measured limits:

- **Reading beats inferring.** Facts stated in the state (CI log → green /
  red / pending) were 6 of 6 at top probability ≥ 0.85. Bare verdict
  questions were confidently wrong at the same level.
- **No comparison across two texts.** A `noul` over `item.text` and
  `item.history` scored 0.04, 0.15 and 0.26 on three of four shipped items.
- **File paths are a glob's job.** `src/cart/total.ts` → "docs" at 0.68.
- **The state has a trained length.** kev-0.5b was trained on states of
  about 384 tokens (~1,500 characters) and 1,024 per question branch; the
  server accepts up to 8,192 but the model never learned from inputs that
  long. `max_state_chars` defaults to 6000 as a hard stop; set it near 1500
  for this checkpoint.
- **Raw patches wash the signal out.** The same gate that separated every
  one-line summary sent two docs-only commits to deep review when given
  2.5k characters of patch, at 2.2–2.4 s. With subject + `--stat` it sent 9
  of the repo's last 10 commits to light review at 0.5–0.9 s.
