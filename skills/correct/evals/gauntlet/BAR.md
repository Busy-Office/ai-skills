# The bar — correct reply

The gauntlet grades **one artifact**: the reply correct writes after changing a repository so a
repeated mistake cannot happen again: each class with its evidence, the level picked and why no
higher one worked, the proof that the check fails on a real past mistake, and the rule-table rows.
The reference is the skill's ladder (`principle-encode-lessons-in-structure`) and
`principle-prove-it-works`.

Run `node evals/bar-check.mjs correct <artifact> --target <the built repo>` first for the mechanical
rows. A green pre-check is not a pass. The answer key is the fixture's
[`README.md`](../../fixtures/repeat-offender/README.md); the run under test works in the repo that
`build.mjs` builds and does not read it.

## What every reply requires (miss = FAIL)

1. **A class has happened twice**, and each class names its evidence: the commits or `file:line`
   where it happened and the correction on record. A mistake seen once is not a class.
2. **The level is the highest that works**, and every level below architecture says why the higher
   ones did not work.
3. **The check fails on a real past mistake.** A commit where it happened is checked out, or its
   change re-applied on a scratch branch, and the failing output is pasted; then the passing output
   on the fixed tree. A check proven only on an example the run wrote itself is a FAIL.
4. **The gate's own command runs it.** The proof uses the command the repository's gate runs
   (`npm run check` here), not the check script alone.
5. **An existing check is tested, not trusted.** A check the repository already has for the class is
   run on the past mistake before the rule is called enforced.
6. **Exceptions carry a reason, an expiry and the user's approval**, and the check fails on an
   expired one. None is the right number when nothing needs one.
7. **The rule table pairs each rule with what enforces it**, with rows added or dropped, and only
   for this repository's mistakes. Personal preferences stay out.
8. **Landed by the repository's own flow**: a work branch, the gate green on it, nothing pushed or
   tagged unasked; the reply says so.

## Class K — mistake classes (the repeat-offender fixture)

**Bar: the next agent that copies the nearest example into `src/report/` gets an error that names
`src/db/orders.js`, or cannot write the import at all.**

Pass requires, in addition to the shared list:

1. **Every planted id lands as the README says.** One miss is a FAIL.
2. **The proof reproduces.** The critic rebuilds the fixture, applies the run's branch, and gets the
   pasted failing and passing output.
3. **Both mistake forms are caught.** The fixed structure or check fails on the deeper path with
   single quotes (`'../../db/client.js'`) and on `'../db/client.js'`.

## Properties with no instrument yet

- Whether the chosen level holds up as the repository grows (a second module needing the client):
  a judgement the critic records.
- Whether the error message is the one an agent will act on: needs an agent run against it.
