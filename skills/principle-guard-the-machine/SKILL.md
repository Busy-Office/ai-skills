---
name: principle-guard-the-machine
description: "Apply before spawning agents, writing a Workflow script's fan-out or running a test suite: at most 3 agents at once, one full test suite at a time across every agent, and short commands that finish inside subagents."
---

# Guard the machine

**Apply when** you spawn agents, write or review a Workflow script's fan-out, run a full test suite,
start a long command, or brief a subagent that will run commands.

**The rule.**

- **At most 3 agents at once**, whether you launch them by hand or a Workflow script fans them out
  (its default concurrency). Queue the rest, or run the fan-out in waves of 3. Go higher only when
  the user explicitly opted into that scale.
- **One full test suite at a time**, across every agent and the coordinator. Agents run targeted
  tests; the full suite runs once, alone, at the end, by the coordinator.
- **Short commands in subagents.** A subagent runs commands that finish and print a result:
  targeted tests, a bounded window, a timeout. A long silent command (a full suite, a watch mode, a
  server) stalls the agent and can kill the run.
- **A crashed or starved run is not red.** Re-run it alone before judging it.

Where another skill or a repository states a higher limit, these limits win; only the user's
explicit opt-in raises the agent count.

**Why.** Parallel suites and too many agents starve one machine: runs crash with no summary, which
reads as a red build and spends a round on nothing.

**The sign you skipped it.** Two suites in flight; a fourth agent "just for this"; a subagent that
never returned; a failure that passed when re-run alone.
