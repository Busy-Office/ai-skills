---
name: why
description: "Finds why code, a rule or a design is the way it is — from git blame and log, the decision log, ADRs, the project notebook and the code graph — and returns a cited answer that also lists the sources that came up empty. Use for \"why does X work this way\", \"why did we pick Y\", where a regression came from, or before undoing something that looks wrong. How it works is the how skill."
---

# Why

Find the forces that shaped X, with evidence. Keep what the record says apart from what you infer.

## Steps

1. **Anchor.** Find X in the code: files, line ranges, symbols. A vague target → state your reading
   and go.
2. **Seed from git.**

   ```
   git blame -L <start>,<end> <file>
   git log --follow --oneline -20 -- <file>
   git log -1 --format=%B <commit>      # the full message of each commit that shaped it
   git log -S'<symbol>' --oneline       # when a symbol appeared or vanished
   ```

   A commit that names a PR or issue → read it (`gh pr view <n>`).
3. **Search every source this project has.** More than two to read → subagents in parallel
   (`principle-guard-the-context-window`).

   | source | where |
   |---|---|
   | commit history | the messages and diffs from step 2 |
   | decision log | the project's decision notes; the user's local decision log, if they keep one (`automate-me` describes it) |
   | ADRs | wherever the repository keeps them (`docs/adr/`, `docs/decisions/`, …) |
   | project notebook | the project's notebook or second brain, if one is set up ([guideline](../../docs/second-brain.md)) |
   | code graph | a code graph of the repository, if one exists, for who depends on X |
   | issues and PRs | the discussion linked from the commits |

4. **Record the empty ones.** Each source searched with nothing found is listed with its query:
   "no ADR mentions X (searched `docs/decisions/` for 'X', 'Y')". An empty source is an answer, and
   it saves the next person the search.
5. **Synthesize.** Each reason is either recorded (a commit, ADR or decision says so: Read) or
   inferred from the evidence (Inferred), per `principle-prove-it-works`. An inferred reason is never
   presented as the recorded one.

**Reply:** the answer in one or two lines; each reason with its source and grade; the sources that
came up empty; and, if the reason no longer holds, what changing X would need.
