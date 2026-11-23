---
name: principle-subtract-before-you-add
description: "Apply when sizing a change, refactoring, or tempted to add a layer, option, file or rule: remove what the change makes dead first, then make the smallest diff that solves the asked problem."
---

# Subtract before you add

**Apply when** you plan a change, a refactor, a new skill, doc or rule, or feel the pull toward an
abstraction, a config flag, a wrapper or something "for later".

**The rule.**

- **Does it need to exist?** If not, say so in one line and stop.
- **Look before you write.** Reuse the helper, pattern or rule already here.
- **Remove what the change makes dead** — the old path, the stale doc line, the duplicate rule — in
  the same change as the addition.
- **Then the smallest diff** that solves the problem asked: no interface with one implementation, no
  option nobody sets, no scaffolding for a request nobody made.

**Why.** Every added line is read by every later agent. A codebase or a rules file grows by default
and shrinks only on purpose.

**The sign you skipped it.** A new helper beside an existing one; a new rule restating an old one; a
"flexible" option with one caller; a diff whose line count only goes up.
