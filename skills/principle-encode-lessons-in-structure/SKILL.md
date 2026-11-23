---
name: principle-encode-lessons-in-structure
description: "Apply when a mistake or correction happens a second time, or you are about to write an instruction that already exists: make it architecture, a type, a check or a test, not more prose."
---

# Encode lessons in structure

**Apply when** a mistake recurs, the user corrects the same thing twice, or you catch yourself
writing an instruction a second time.

**The rule.** A mistake made twice becomes structure, at the highest level that works:

1. **architecture** — one owner per piece of state, one supported way; delete the old way an agent
   would copy;
2. **a type** that makes the bad state unwritable;
3. **a check** in the gate whose error names the fix;
4. **a test** of the behaviour;
5. **prose**, last, only for a judgement call no machine can make.

Prove a new check by running it on the real past mistake and pasting it failing. The `correct` skill
is the full procedure.

**Why.** A rule in an instruction file enforces nothing: nothing fails when an agent skips it, and
the next agent sees only the files it opened.

**The sign you skipped it.** A rules file that grows a line per incident; "remember to …" in a
brief; the same review finding in two batches.
