# Second brain — an optional guideline

Nothing in this plugin requires it. Every skill works with no second brain at
all, and none of them will nag you for one. This is for the case where you have
run these skills a few times and noticed the same gap:

> `loop-economist` ends its review with *"re-run on the next window and compare
> tokens per commit"* — and there is nowhere the previous review lives.

The artifacts these skills produce are a **time series**. A run review, a weight
report, a queue proposal, an intent draft: each is a measurement of the same
loop at a moment, and the interesting question is almost always *what changed*.
Written to a scratchpad, they last until the session ends.

## What it is

[NotebookLM](https://notebooklm.google.com) driven by the
[`notebooklm` CLI](https://github.com/teng-lin/notebooklm-py), with a small
local index for routing. A notebook holds sources; you ask it questions and get
answers **with citations back to the source**, which is the property that
matters — an unattributed summary of your own reasoning is not worth keeping.

## The division of labour with graphify

Both are indexes; they answer different questions, and confusing them wastes
both.

| question | tool | why |
|---|---|---|
| *where does X live, what touches it* | **graphify** | it indexes the code, and answers with file and line |
| *why did we decide X, what did the last review say* | **notebook** | it indexes the reasoning, and answers with a citation |

Query the graph for **where**; ask the notebook for **why**. A design decision is
not in the code, and a call site is not in a review.

## The layout that works

One notebook per project as its brain, one per deep-research topic:

```
<project> — project brain        CLAUDE.md, the intent doc, ADRs, and every
                                 artifact these skills produce, appended over time
<project> research: <topic>      one per topic, deep research imported, added to
                                 as it continues
```

Deep research takes 15–30 minutes, so start it non-blocking, keep the run id,
and import when it lands — never block a session on it.

## Routing, which is the part that needs local help

**There is no cross-notebook search.** `ask` is per-notebook, so every question
starts with *which notebook?* — and answering that by listing and guessing costs
more than the answer. A local index solves it offline:

```bash
python3 ~/.claude/second-brain/nb-index.py route "<topic words>"   # which notebook
python3 ~/.claude/second-brain/nb-index.py build --deep            # refresh
notebooklm ask "<question>" -n <notebook_id> --json                # grounded answer
```

Routing on source *titles* alone fails, because they are usually filenames —
`README.md` says nothing about its topic. `build --deep` caches the AI keywords
each source already carries (one call per source, capped, cached), and that is
what makes concept queries land.

## What to put in, and what not to

**Put in** what stays true: run reviews and weight reports (the time series),
ADRs and decision notes, intent documents, research output, design rationale.

**Keep out** what must be current: the queue, the loop's status file, anything
the loop writes each tick. A notebook is a snapshot — a stale backlog answered
confidently is worse than no answer, and `requeue` reads the real file anyway.

**The rule of thumb:** if re-reading it next month would still be right, it
belongs here. If it changes every tick, it does not.

## Cost

An `ask` returns a short grounded answer — a few hundred tokens plus citations —
against sources that never enter your context. That is the same economics as
querying a code index rather than loading it: the index is large, the answer is
small, and you only ever pay for the answer.

## Privacy

Sources leave your machine and go to a Google-hosted product. That is a real
decision and it belongs to whoever owns the project, per project. Say plainly
which documents are going in the first time a project starts using it; after
that the decision stands and need not be re-litigated.
