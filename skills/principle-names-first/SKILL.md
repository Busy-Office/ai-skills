---
name: principle-names-first
description: "Apply when writing anything a person reads — a reply, a page, a question, a summary: plain words first, then the code, id or path after them."
---

# Names first

**Apply when** a reply, a page, a decision or a summary will be read by a person, above all one
reading from a phone between other things.

**The rule.** Say what a thing is in plain words, then give its code.

- First mention: the plain name, the code after it — "the nightly export (`exp-02`)", "the stop
  rules (`improve-until-done`)", "the payments tests (`npm test -w payments`)".
- Later mentions: the plain name alone, or the code alone in a table column whose heading names it.
- A term the reader may not know gets a half-line gloss the first time.
- Bare codes, ids and paths belong in machine files and command lines.

**Why.** The reader decides from the words they understand. A code they must look up is a decision
delayed, or made blind.

**The sign you skipped it.** A summary that reads "Fixed S2, N1, N6"; a question that names a file
but not what it does; an approval request that only a person who wrote the code could answer.
