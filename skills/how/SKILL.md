---
name: how
description: "Explains how part of a codebase works — overview, key parts, the flow, where things live, gotchas — from parallel read-only explorers merged into one synthesis. Use for \"how does X work\", a walkthrough before changing something, or where something should live. Why it is that way is the why skill."
---

# How

Answer "how does X work" at the depth someone needs to change X safely: a working mental model, not
annotated source.

## Steps

1. **Scope.** Restate X in one line. Ambiguous → state your reading and go; the user can redirect.
2. **Size it.** Narrow (one module, one function, a few files): explore and explain in one pass,
   yourself or with one explorer, then step 4. Wide (a subsystem, a cross-cutting feature, several
   services): step 3.
3. **Explore in parallel.** Split X into 2–3 angles that do not overlap (for example the data model,
   the request path, the background jobs). Spawn one read-only explorer per angle, in one message, on
   a cheap model (`principle-guard-the-machine`). Each brief names the question, its angle, and the
   report: the files and symbols it found with `file:line`, the flow it traced, the surprises, every
   claim graded (`principle-prove-it-works`). Explorers return findings, not prose.
4. **Synthesize once**, yourself or with one agent on a strong model given every explorer's
   findings, into the shape below. Open the `file:line` behind each main claim before it goes in.

## The explanation

- **Overview** — what X is for and its shape, in three lines.
- **Key parts** — the few types, modules or tables that matter, one line each, with `file:line`.
- **The flow** — what happens in order, from the trigger to the result; a small diagram past four
  hops.
- **Where things live** — path → what is there.
- **Gotchas** — what surprises someone changing it: ordering, hidden state, a second copy, a flag.

Drop a section that does not apply. Leave out what the code does that nobody needs in order to
change it.

**Reply:** the explanation, then one line on what was not explored.
