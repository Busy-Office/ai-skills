---
name: principle-guard-the-context-window
description: "Apply when a task needs wide reading — many files, long logs, transcripts, a big diff — or the session is growing long: bulk reading goes to a subagent or a script, and the main context keeps the summary."
---

# Guard the context window

**Apply when** answering means sweeping many files, reading a long log or transcript, comparing
large outputs, or the session has run long.

**The rule.**

- **Bulk reading goes elsewhere:** to a subagent (a cheap search agent for a sweep) or to a script
  that prints a digest. The main context keeps the conclusion and the pointers.
- **Read bounded:** a header, the first and last screen, or the line range you need.
- **Batch reads:** several ranges in one command. Cost is context × turns.
- **Brief with paths**, not pasted contents.
- **Before a long session runs out,** write its state to a file (the `pause-safely` playbook).

**Why.** Every token in the main context is paid again on every later turn, and attention thins
across it. A dump read once keeps costing until the session ends.

**The sign you skipped it.** A 2,000-line file read to find one function; a full test log pasted
into the reply; the same file opened four times.
