# Verification — a node on the edge whose job is to kill the finding

The leverage of a graph is not more agents. It is the structure you can wrap
around them to buy confidence: a verifier sits on the edge before a result
is allowed downstream, and only what survives it reaches the answer.

Verifiers are not a primitive. Every pattern here is `agent()` plus
`parallel()` plus a line of code that counts votes.

---

## The one rule

**A verifier that produced the finding is not a verifier.** A context
cannot refute its own work; it will explain it. The verifier is a separate
`agent()` with a different prompt whose *only* job is to make the finding
fail. A "now double-check your answer" line at the end of the finder's
prompt is a self-check, and the review counts it as no verifier at all.

---

## The patterns

### Adversarial — N refuters, majority survives

```js
const VERDICT = { type: 'object', additionalProperties: false,
  properties: { refuted: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['refuted', 'reason'] }

const votes = await parallel(Array.from({ length: 3 }, (_, i) => () =>
  agent(`Try to refute this finding. If you cannot reproduce or evidence it, refuted=true. Default to refuted when uncertain.\n\n${claim}`,
        { label: `refute:${i}`, phase: 'Verify', schema: VERDICT })))
const survives = votes.filter(Boolean).filter((v) => !v.refuted).length >= 2
```

**When:** the finding is a claim that can be true or false — a bug, a
missing check, a factual assertion. **Why default-to-refuted:** a verifier
asked "is this real?" agrees; one asked "kill this" looks for the evidence.
The default makes an uncertain verifier vote against, which is the
direction that costs less when it is wrong.

### Perspective-diverse — one lens per verifier

```js
const LENSES = ['correctness', 'security', 'does it reproduce']
const views = await parallel(LENSES.map((lens) => () =>
  agent(`Judge this finding through the ${lens} lens only. Real?\n\n${claim}`,
        { label: `verify:${lens}`, phase: 'Verify', schema: VERDICT })))
const real = views.filter(Boolean).filter((v) => !v.refuted).length >= 2
```

**When:** a finding can fail in more than one way. Three identical refuters
share a blind spot; three lenses do not. Use it for code review, where
"compiles" and "safe" and "actually happens at runtime" are different
questions.

### Judge panel — N attempts, parallel judges, synthesise from the winner

```js
const ANGLES = ['MVP-first', 'risk-first', 'user-first']
const attempts = (await parallel(ANGLES.map((a) => () =>
  agent(`Design the approach, ${a}.\n\n${brief}`, { label: `attempt:${a}`, schema: DESIGN })))).filter(Boolean)
const scores = (await parallel(attempts.map((d, i) => () =>
  agent(`Score 0–10 against the bar:\n${BAR}\n\nDesign:\n${JSON.stringify(d)}`,
        { label: `judge:${i}`, schema: SCORE })))).filter(Boolean)
const winner = attempts[scores.map((s) => s.score).indexOf(Math.max(...scores.map((s) => s.score)))]
const final = await agent(`Start from the winner; graft the best of the others.\n\nWinner:\n${JSON.stringify(winner)}\n\nOthers:\n${JSON.stringify(attempts)}`)
```

**When:** the solution space is wide and one-attempt-iterated tends to lock
in the first idea. **Non-negotiables:** the bar is written *before* the
attempts run; the judges wrote none of them; "none clears the bar" is an
allowed verdict.

### Completeness critic — what is missing

One agent at the end whose prompt is *what did this not cover — a source
unread, a modality not searched, a claim asserted without a verifier?* Its
answer is not a section of the report; it is the next round's work-list.

---

## Which one, and what it costs

| pattern | apply when | agents per finding | keep if |
|---|---|---|---|
| adversarial | a claim that is true or false | N (3 typical) | ≥ majority not refuted |
| perspective-diverse | can be wrong in several distinct ways | one per lens (3 typical) | ≥ majority pass |
| judge panel | wide solution space, wrong pick is expensive | N attempts + N judges + 1 | highest score above the bar |
| completeness critic | the sweep might have gaps | 1 per run | — feeds the next round |

Scale N to what was asked: "find any bugs" → single-vote verify; "audit this
thoroughly" → three-to-five-vote adversarial pass and a synthesis. Every
verifier is an agent; a graph that verifies eighty findings three times has
spent 240 agents on confidence, and that is the right spend only when the
findings were going somewhere that matters.

---

## Effort on the verify stage

Finders can run at the session's effort. Verify and judge stages carry the
judgement, so they are the one place to spend *up*: `effort: 'high'` on a
refuter is cheaper than a wrong finding in the report. The reverse holds
too — a verifier on a bounded, mechanical check ("does this file import
X?") runs at `effort: 'low'` and a tier down, because it is a check, not a
judgement. `cost-model.md` for the tiering rule.
