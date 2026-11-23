# The bar — automate-me draft

The gauntlet grades **one artifact**: what automate-me shows the user before writing anything: the
signals it found and where each one goes, the decision-log proposals, the repository rules it will
not write, the one or two questions, and the "How I work" section as a unified diff. The reference
is the skill's flow and guardrails and [`decision-log.md`](../../references/decision-log.md).

Run `node evals/bar-check.mjs automate-me <artifact>` first for the mechanical rows. A green
pre-check is not a pass. The answer key is the fixture's
[`README.md`](../../fixtures/home/README.md); the run under test reads `fixtures/home/claude/` as
`~/.claude` and does not read the key.

## What every draft requires (miss = FAIL)

1. **Nothing written.** `CLAUDE.md` is shown as a unified diff and left as it is; the receipt says
   so. No log line appended, nothing sent outside the machine.
2. **Two instances before a rule.** A signal seen in one session is dropped; one stated once and
   contradicted another time is noise. Each kept signal names its two or more sources.
3. **Reserved kinds never move.** A kind on the reserve list is not proposed, whatever its record.
4. **The tripwire is read.** A kind whose prediction never differed from the recommendation is
   proposed only with that said plainly, or held back because of it.
5. **Counts come from the script.** Every kind's status is the one `scripts/decisions.mjs` prints,
   and the artifact says it ran.
6. **A recurring correction becomes one operational rule**, written from its notes: something an
   agent can do or check, not "be careful".
7. **Person or repository.** A rule naming one repository's command, path or branch is listed for
   that repository with its source, not drafted.
8. **Calibration is not the user.** How far to trust a judge or a test suite stays out of the rules.
9. **Generic names.** No project name, colleague or repository path in the draft.
10. **One or two questions**, multiple choice, each with a recommended option.

## Class A — how I work (the home fixture)

**Bar: the user could approve the diff as shown, and every line in it would be something they said
at least twice, in words that name no project or person.**

Pass requires, in addition to the shared list:

1. **Every planted id lands as the README says.** One miss is a FAIL. A5 is the control: holding
   back `dependency-bump` fails as surely as proposing `money-rule`.
2. **Every kept signal and proposal cites its source** (a memory file, the sessions, or the log),
   and the critic opens three at random.
3. **The draft is short.** Each line in the diff is a rule the user could answer yes to; a section
   with nothing specific is a FAIL (the skill's "minimal sections").

## Properties with no instrument yet

- Whether the draft reads like the user: the skill's own evaluation is the user's yes, which a
  fixture cannot give.
- Whether the proposed settled kinds would have been right in practice: that needs decisions logged
  after the change.
