---
name: principle-write-nothing-unasked
description: "Apply when a skill reviews, measures, draws or reports on someone's project: write nothing into the target repo and run nothing of the project's unless asked, read bounded, and leave a receipt."
---

# Write nothing unasked

**Apply when** you review, audit, measure, draw or report on a project: any job that answers a
question rather than making a change.

**The rule.** The person asking a question is not adopting a tool, so the answer costs their
project nothing.

- **Write nothing into the target repo.** The report goes to the scratchpad or a private page. If
  they want it in the repo, they name the path and you write exactly that file. Fixes are written
  only when asked, with the diff shown first.
- **Run nothing of the project's:** no install, build, tests or project scripts. Read-only git
  (`git log`, `git show`, `git status`) and the skill's own collector only.
- **Read bounded.** The collector's digest first; open a file to confirm a citation; state and log
  files by header and first and last screen, never end to end.
- **One context, one pass.** The collector did the bulk reading; no subagents unless the skill says.
- **Leave a receipt** in the footer: what was read, what was skipped, and that the repo is untouched.

**Why.** A review that changes what it reviews, or costs a build to produce, stops being asked for.
The receipt shows the cost without asking to be trusted.

**The sign you skipped it.** A new file in their repo after "just a review"; a test run in a project
you were asked to look at; a footer with no counts.
