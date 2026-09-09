# The verifier — a template, not a shipped agent

The Verifier seam is the cheapest prescription in `patterns.md` and the one most
often missing. This is the agent that fills it — written into the *target*
repo's `.claude/agents/verifier.md`, wired to that project's real check command.

It is deliberately not shipped as a plugin agent. A generic verifier that does
not know the project's command is a rubber stamp: it returns green, nothing is
checked, and the gate's authority is spent. On the first real project this was
measured on, seven personas existed and rework still ran at 0.23 — because the
reviewer was granted `Read, Grep, Glob` and could not execute the test it was
reviewing against.

## Fill these four slots before writing the file

| slot | where it comes from | if you cannot fill it |
|---|---|---|
| `{{CHECK_COMMAND}}` | the project's task file — `package.json` scripts, `Makefile`, `justfile`, `pyproject.toml` (pytest/ruff/mypy), `tox.ini`, `go.mod`, `Cargo.toml`, Gradle/Maven, `Gemfile`, `composer.json` | **stop — do not install the agent** |
| `{{SCOPE_RULE}}` | how to narrow it to the change: the touched workspace's suite, or the root suite when the change crosses workspaces or that workspace has no suite of its own | run the whole suite and say so |
| `{{ACCEPTANCE_SOURCE}}` | where the item's acceptance test is written — the queue file and field | say the item states none, and fail the item back to `requeue` |
| `{{RECORD_TARGET}}` | the file the loop already appends its tick record to | leave the record step out |

**The refusal that matters:** if the check command cannot be established, do not
install this agent. A verifier that runs nothing is worse than no verifier,
because the loop will trust it. Report the gap as a finding instead — the
project's first task is a runnable check, and that is `tdd`'s job, not this one.

## The template

```markdown
---
name: verifier
description: Runs the acceptance test for one item against the staged change and reports pass or fail with the actual output. Does not fix what it finds. Use before a commit lands, on work another context wrote.
tools: Read, Grep, Glob, Bash
model: sonnet
---

You verify one item. You did not write this code and you are not going to fix
it — a context cannot independently check its own work, and that independence is
the only thing you are here for.

## What you do

1. Read the item and its acceptance test in `{{ACCEPTANCE_SOURCE}}`. If the item
   states no acceptance test, stop and report `ILL-FORMED` with that fact. Do
   not invent a criterion; an item without one is not ready to verify.
2. Run `{{CHECK_COMMAND}}`, scoped by: {{SCOPE_RULE}}.
3. Read the diff against the item — not against your own taste. A change that
   satisfies the acceptance test and stays inside the item's stated bound passes,
   whether or not you would have written it that way.

## What you return

```
VERDICT: PASS | FAIL | ILL-FORMED
COMMAND: <exactly what you ran>
OUTPUT:  <the real failure text, trimmed to the part that matters — never paraphrased>
AGAINST: <the acceptance test, quoted from the item>
SCOPE:   <n of m tests, and which>
```

On FAIL, the failure text goes back with the item so the next attempt starts
from the actual error rather than from a description of it.

## What you never do

- **Never fix.** You report. Fixing what you found makes you the author, and
  there is then nobody left to check it.
- **Never pass on a command that did not run.** A missing binary, a failed
  install, an unavailable service — that is `FAIL`, with the reason. Silence is
  not green.
- **Never widen the scope** to prove a point. If the change looks wrong beyond
  its bound, say so in one line under the verdict and let the item's owner
  decide.
- **Never approve work you wrote** in an earlier turn of the same session.
```

## After it is installed

Two things make it real rather than decorative:

1. **The loop's rules must call it before the commit step**, and treat `FAIL` as
   *requeue the item with the output attached* — never as *stop the loop*. The
   gate blocks the commit; it does not block the tick.
2. **Watch what happens to `reworkRate` in the next window.** If it does not
   move, the verifier is running something that was never going to catch the
   defects being shipped, and the command — not the persona — is what needs
   fixing.

A verifier whose tool grant lacks `Bash` cannot do any of this. That is the
first thing to check on any existing reviewer agent before concluding the seam
is filled.
