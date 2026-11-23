---
name: busy-office-mode
description: "Routes a multi-step task to one playbook — feature, bug fix, investigation, refactor, goal run, loop tick, grill, landing, plugin release, session pickup, pause — opens its steps as todos and names the skill each step calls. Use at the start of any task with more than one step, when unsure which busy-office skill fits, or to see how the loop-family skills hand off to each other."
---

# Busy Office mode

Route the task to one playbook, then work its steps.

## Route

1. **Match the task to one playbook** below. Two fit → the one whose "for" names the deliverable the
   user asked for. None fits → `figure-it-out`.
2. **Read it.** A repository may override a playbook with a file of the same name in its own
   `.agents/playbooks/` (for example `.agents/playbooks/feature.md`); when that file exists, read it
   instead of the one here.
3. **Open todos** whose first items are the playbook's steps, in order, each naming the skill it
   calls.
4. **Say which playbook** you picked, in one line, then work it. The triggers below fire inside any
   playbook.

| playbook | for |
|---|---|
| `feature` | new or changed behaviour: built, verified, reviewed and landed |
| `bug-fix` | something broken: reproduced, fixed at the cause, with a test that failed before |
| `investigation` | a read-only question; the deliverable is a cited answer |
| `refactor` | same behaviour, new structure; parity checked before and after |
| `goal-run` | a multi-milestone goal driven to done without per-step asks |
| `loop-tick` | one unattended run of a scheduled loop |
| `grill` | a decision tree settled with the owner, round by round |
| `landing` | an approved batch onto the main branch, and the clean-up |
| `plugin-release` | a new version of a Claude Code plugin |
| `session-pickup` | resuming from a handoff, a goal file or the decision log |
| `pause-safely` | parking in-flight work so a cold start can resume it |
| `figure-it-out` | none of the above: write a one-off playbook first |

The files are `playbooks/<name>.md` beside this skill.

## Triggers

| when | call |
|---|---|
| how X works, before changing it | `how` |
| why X is the way it is | `why` |
| a diff, plan or report is ready to be judged | `review` |
| what a change can break beyond its diff | `blast-radius` |
| spawning or briefing an agent | `deploy-agents` |
| work going in rounds | `improve-until-done` |
| the same mistake a second time | `correct` |
| a cheap second opinion at a decision point | `jev` |
| branches, worktrees, release tags | `solo-flow` |
| "where are we", a status page | `progress-dashboard` |
| a scheduled loop's design, cost, picture, preamble, queue or purpose | the loop family below |
| the shape of one multi-agent run | `graph-engineer` |

`automate-me` runs only when the user calls it. Principles are the `principle-*` skills: load one
when its "Apply when" fires, and name it in the reply where it changed a decision.

## The loop family

Seven skills look at an autonomous engineering loop. Each answers one question and hands the rest
on; this table is the one place their hand-offs are written.

| question | skill | reads | hands off |
|---|---|---|---|
| Is the design sound, safe, and does it stop? | `loop-doctor` | the loop's documents | unclear queue items → `requeue`; vague intent → `sharpen-intent`; what the runs cost → `loop-economist`; the shape inside a tick → `graph-engineer`; cheap judgements → `jev` |
| What do the runs cost, and is the right agent doing the work? | `loop-economist` | transcripts and commits | names the binding constraint: the actor → its own prescriptions, or `graph-engineer` when the fix is the run's shape; the input → `requeue`; the design → `loop-doctor`; the preamble → `wake-weight`; cheap work pointed at nothing → `sharpen-intent` |
| What does it look like, and who is on the crew? | `loop-atlas` | definitions and observed summons | only draws; its gaps and vacancies are input to `loop-doctor` and `loop-economist` |
| What does every run pay before it starts? | `wake-weight` | the files loaded at wake | duplicated rules → `loop-doctor`; a queue too heavy to read → `requeue` |
| What should it work on next? | `requeue` | the queue | ranks against what `sharpen-intent` produced |
| What is any of this for? | `sharpen-intent` | the purpose document | re-run `requeue` after it changes; `loop-doctor` checks the loop is anchored to it |
| What shape should one run's work take? | `graph-engineer` | a Workflow script or an agent prompt | the loop around runs is the six above |

`loop-doctor` and `loop-economist` see one loop from opposite sides: a loop can score well on its
documents and still ship the same file four times. `graph-engineer` looks inside one run; the other
six look at the loop around runs.
