---
name: correct
description: "Turns a mistake agents keep repeating in a repository into one they cannot make: architecture first, then types, then a check whose error names the fix, then a test, prose last. Each check is proven to fail on a real past mistake; exceptions carry a reason and an expiry. Use for /correct, \"agents keep doing X\", or when the user corrects the same thing twice. Not for a scheduled loop's design (that is loop-doctor) or the user's personal preferences (automate-me)."
---

# Correct

The user keeps correcting agents in this repository for the same mistakes. Change the repository so
the next agent cannot make them.

Assume every contributor is an agent that sees only the files it opened, copies the nearest example,
and takes the shortest path that compiles. Design the repository so a change that looks right from
one file is right for the whole repository.

## Find the mistake classes

Read, in this order:

- the corrections already on record: the user's feedback memories for this workspace
  (`~/.claude/projects/<encoded-cwd>/memory/*.md` with `type: feedback`) and, if the user keeps one,
  the local decision log's corrections (`~/.claude/decision-log.jsonl`: read it directly, `grep` by
  topic; its format is in `busy-office:automate-me`'s `references/decision-log.md`);
- recent commits, reverts and fix-ups (`git log`, `git log --grep=revert -i`), and the diffs that
  undid an agent's change;
- the agent instruction files (`CLAUDE.md`, `AGENTS.md`, skills) and code comments that explain a
  workaround.

Group the mistakes into classes. A class counts once it has happened **twice**. Name each with its
evidence: the commits or `file:line` where it happened.

## Fix each class at the highest level that works

1. **Eliminate it with architecture.** One owner for each piece of state, one supported way to do
   each task. Hide internals so the wrong import fails. Replace hand-synced lists with one source of
   truth. Delete the old way and the dead code an agent would copy.
2. **Make it unwritable with types.** The bad state does not compile.
3. **A check whose error names the fix.** If bad code still compiles, add a lint rule or a script in
   the repository's gate whose message names the file, type or function to use instead. If the
   pattern is already common, fail only when a change adds more.
4. **Test the behaviour.** Fix or delete any test that still passes when the behaviour it checks
   breaks, or that fails when only the internals change.
5. **Prose last, and only for judgement calls.**

The ladder and why prose comes last are `principle-encode-lessons-in-structure`. Say why each higher
level did not work before settling on a lower one.

## Fix and prove

Fix the most frequent classes first, one commit each.

**Test the existing check first.** When the repository already has a check for the class, run it
at a commit where the mistake happened and paste its output. A rule is enforced only if that check
fails there; one that passes is a repeat that nothing enforces.

**Prove each check fails on a real past mistake.** Take a commit where the mistake happened (or
re-apply it in a scratch worktree), run the new check there, and paste its failing output. A check
that has never been seen to fail is a guess. Then run it on the fixed tree and paste it passing.

Run the same command the repository's gate runs: a check that only runs locally, or only in CI, is
half a check.

**Exceptions** go on the offending line, each with a reason, an expiry date and the user's approval.
The check itself fails on an expired exception.

## Land it

Use the repository's own landing flow, as its instructions describe it: typically a work branch in
its own worktree, the gate run, the work squashed and fast-forwarded onto the main branch. Do not
push, open a pull request or tag unless the repository's rules and the user say so.

For a second opinion before calling a class closed, the `jev` skill can judge it (for example
`jev judge completion` with the failing and passing check output attached), if it is installed and
the repository is allowed. It is optional and advisory.

## Keep the rule table

Keep a table in the repository's agent instruction file that pairs each rule with what enforces it
(the architecture, type, check or test). When the user corrects you, fix the mistake and add the
rule. If the rule was already there and nothing enforces it, that is a repeat: fix it at the highest
level in the same change. Drop a rule once its mistake can no longer happen.

**Reply:** `references/report-template.md`, exactly: each class with its evidence, the level picked
and why a higher one did not work, the proof that the check fails on the past mistake, and the
rule-table rows added or dropped.

---

Adapted from pstack's `correct` (MIT, © 2026 Lauren Tan; Claude Code port © 2026 Michael Denyer); see [NOTICE.md](../../NOTICE.md).
