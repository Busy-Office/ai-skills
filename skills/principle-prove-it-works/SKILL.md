---
name: principle-prove-it-works
description: "Apply before saying done, citing an agent's report, or recommending on a fact: grade every claim Ran, Read or Inferred, and re-run a claim before citing it."
---

# Prove it works

**Apply when** you are about to say "done", cite what an agent reported, recommend on a fact, or hand
the user evidence.

**The rule.** Every claim carries one grade:

| grade | means |
|---|---|
| **Ran** | a tool printed it in this session; the command and its output are there to point at |
| **Read** | you opened the line: a real `file:line`, or the library's own source |
| **Inferred** | anything else: memory, an agent's summary, an argument for why it should hold |

- **Re-run before citing.** An agent's Ran claim is Inferred to you until you re-run it; its Read
  citation is Inferred until you open the line. A claim that fails when re-run is a finding.
- **Decide on Ran or Read.** An Inferred fact a decision rests on gets run or read first, or is
  reported as **unproven**.
- **Check the real thing**, not a proxy: the feature path and the actual value, not "it compiles",
  a file's timestamp or an agent's self-report.

**Why.** A writeup that sounds right reads the same whether or not it is true. The grade tells the
reader how much weight each sentence bears; re-running catches the report that describes the work it
meant to do.

**The sign you skipped it.** A "done" with no command output beside it; "the agent confirmed"; a
`file:line` nobody opened; a test result from before the last edit.
