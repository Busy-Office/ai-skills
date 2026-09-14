# Cost model — what the shape will spend, before it runs

Three numbers, each with its formula, each labelled *estimate*. The review
states them so the reader can decide whether the graph is worth launching,
and so the next review can say whether the estimate held.

---

## What a node inherits

Every `agent()` runs on the **session's model and effort** unless the call
overrides it. An unmodified fan-out of forty nodes bills forty times the
session tier. Two options change that per node:

| option | values | default |
|---|---|---|
| `model` | a model id | inherit the session (almost always right — set only when confident a different tier fits) |
| `effort` | `'low' · 'medium' · 'high' · 'xhigh' · 'max'` | inherit the session |

Check `/model` before a large run; the estimate below is wrong by the whole
tier if the session is not where you think.

## Tier by judgement, not by position

| node does | model | effort | why |
|---|---|---|---|
| extract a field, classify into an enum, check one file against one rule | a tier down | `'low'` | bounded, repetitive, the schema does the discipline |
| find (open search over a scoped unit) | inherit | inherit | breadth needs the session's competence; the fan-out is where volume lives, so this is where a tier down pays most *if* the finder stays reliable — test on three items before tiering forty |
| refute, judge, adjudicate | inherit | `'high'` | the judgement the graph exists for; a wrong verdict costs more than the effort |
| merge / synthesise the answer | inherit | inherit or `'high'` | one node, read by a person, sees everything |

A model override on every node (**G15**) is not tiering; it is moving the
whole graph to another tier and losing the choice.

---

## The caps

| cap | value | consequence for the estimate |
|---|---|---|
| concurrency per workflow | `min(16, CPUs − 2)` — **not** the core count | a fan-out of width W runs in `ceil(W / cap)` waves |
| items per `parallel()` / `pipeline()` call | 4096 — hard error above | chunk larger lists; never assume truncation |
| agents per run lifetime | 1000 | a cycle's expected rounds × per-round agents must fit with the synthesis left over |
| `budget.total` | the user's "+N" directive, when set | a hard ceiling — `agent()` throws past it; reserve the synthesis's share |

On an 8-CPU laptop the cap is 6. On a 16-CPU box it is 14. On a 64-CPU host
it is 16. Write the number the run will actually get.

---

## The three formulas

### Agents

```
agents = Σ over static agent() sites of (fan-out width at that site)
       + cycle: expected rounds × agents per round
```

Fan-out width is the length of the array mapped at that site: `SOURCES
(9)`, `files (18)`, `fresh × lenses (fresh × 3)`. Where a width depends on
a prior stage's output, take the prior stage's expected count and say so.

### Critical path

```
pipeline:  slowest single-item chain = Σ over stages of (that item's stage time)
barrier:   Σ over stages of (slowest node in that stage)
fan-out:   ceil(width / cap) × per-agent time                  (queueing)
```

A barrier stage's time is its slowest node; a pipeline's is one item's
whole journey. The difference is the idle time the fast items spend waiting
at the barrier — which is why the pipeline is the default.

### Tokens

```
tokens ≈ Σ over nodes of (prompt tokens + typical return tokens)
```

Prompt tokens are the prompt string plus what the subagent reads to do the
job; return tokens are the schema's typical fill. A research node with a
schema of six short fields returns ~200 tokens; one returning free text
returns whatever it likes. Label the total *estimate*; the journal after
the run is the measurement.

---

## Worked example — 9-source research diamond, 3-vote verify

Session: 8 CPUs → cap 6. Per-agent time ~40 s. Prompt ~2k, return ~300.

| stage | shape | width | agents | wall-clock (est.) |
|---|---|---|---|---|
| research | fan-out | 9 sources | 9 | `ceil(9/6) = 2` waves × 40 s = 80 s |
| curate | barrier node (cross-set dedupe + rank — earned) | 1 | 1 | 40 s |
| verify | fan-out over ~12 curated × 3 refuters | 36 | 36 | `ceil(36/6) = 6` waves × 40 s = 240 s |
| synthesise | 1 | 1 | 1 | 40 s |
| **total** | | | **47** | **~400 s** |

Tokens ≈ 47 × (2k + 0.3k) ≈ **108k** (estimate). The verify stage is 77 %
of the agents and 60 % of the clock; dropping to single-vote verify on
`impact: 'low'` items (say 7 of 12) saves 14 agents and one wave. That is
the sentence the review writes under the cost block: which stage dominates,
and the one change that moves it.

Rewriting research → verify as a `pipeline()` would not help here — curate
is a genuine cross-set barrier — but verify → synthesise would, if the
synthesis did not need every verdict at once. It does. Say so; a barrier the
review can defend is a barrier the reader stops questioning.
