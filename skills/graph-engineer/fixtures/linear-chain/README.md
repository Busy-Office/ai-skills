# Fixture: linear-chain

A six-step release-notes agent written as a chain. Public, invented, no real
project. What a correct graph redraw finds:

**Arrows that carry no data (cut them).**
- 1 → 2: the commit list does not read the changelog summary. `none`.
- 2 → 3: the dependency diff does not read the classified commits. `none`.

Steps 1, 2 and 3 are three independent nodes. They can run at once.

**Arrows that are real edges (keep them).**
- 2 → 4 and 3 → 4: the merge consumes both lists.
- 1 → 5 and 4 → 5: the writer consumes the summary and the merged list.
- 5 → 6: the checker consumes the written file.

**The diamond.** Split (the tag range), three parallel readers (1, 2, 3),
one merge (4 → 5). That is the whole graph.

**Plumbing phrased as an agent job.** Step 4 — combine, sort by type,
dedupe — is `flatMap` + a `Map` keyed by id. Zero tokens. A redraw that
spends an agent on step 4 is wrong.

**The verifier vacancy.** Step 6 is the same actor re-reading its own
output. A context cannot verify itself; the redraw replaces it with a
separate node prompted to refute (does every bullet trace to a commit or a
lock-file diff?) — or names the vacancy and says so.

**Contracts a redraw should state.** Node 2 → `{sha, subject, type}[]` with
`type` an enum; node 3 → `{name, from, to}[]`; node 5 → the file body as a
string; the verifier → `{bullet, sourced: boolean, evidence}[]`.

**Cost shape.** Four agents (1, 2, 3, 5) plus the verifier: five. Critical
path = max(1, 2, 3) + 5 + verifier; not 1 + 2 + 3 + 4 + 5 + 6.
