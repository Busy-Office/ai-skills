# The bar — blast-radius writeup

The gauntlet grades **one artifact**: the writeup blast-radius hands back for a change: what it
does, the one fact it is safe because of (proven or marked unproven), the risks, what was cleared,
and what to run before it lands. The reference is the skill's level table and
`principle-prove-it-works`.

Run `node evals/bar-check.mjs blast-radius <artifact> --target <the copy of repo/>` first for the
mechanical rows; it opens every cited `file:line`. A green pre-check is not a pass. The answer key
is the fixture's [`README.md`](../../fixtures/wire-format/README.md); the run under test reads
`repo/` and `change.patch` only.

## What every writeup requires (miss = FAIL)

1. **The one fact is named, with its level.** It says how far the fact got (levels 1–5) and its
   grade (Ran, Read, Inferred). A fact the safety rests on that stopped above level 4 is written
   **unproven**.
2. **The proof is run, not written.** At level 4 the script or command and its printed output are
   in the artifact. Prose that says what the script would print is level 1.
3. **Every risk cites a real `file:line`**, says how it breaks, how likely and how bad, and how to
   check. A caller or API that does not exist is a FAIL.
4. **Risks and cleared are separate.** What was checked and found fine is under Cleared with the
   reason; a search that found nothing names the search.
5. **Where grep stops is looked at**: wire formats, other languages, files read at runtime, config,
   lifecycle. A writeup that lists only symbol callers has not done the job.
6. **A green test is weighed, not trusted.** A test the change leaves passing is not evidence unless
   it would fail on the risk.
7. **Before it lands** names the cheapest check that fails on the real bug.
8. **Nothing written to the target.** The proof script lives in the scratchpad or a copy; the
   receipt says the target is untouched.

## Class B — blast radius of a change (the wire-format fixture)

**Bar: the author of the change could read the writeup and know, before merging, that it breaks the
nightly job, and could rerun the proof.**

Pass requires, in addition to the shared list:

1. **Every planted id lands as the README says.** B1 is a risk at its line, B2 is disproven at
   level 4, B3 is named as blind, B4 is cleared, B5 holds. One miss is a FAIL.
2. **The proof reproduces.** The critic reruns the pasted commands on a fresh copy with the patch
   applied and gets the same output.
3. **The user's claim is treated as a hypothesis.** The writeup says the claim was tested and how,
   not that it was taken as given.

## Properties with no instrument yet

- Whether the likelihood and cost given each risk are right: a judgement the critic records.
- Whether the writeup would scale to a wide change (independent reads per `principle-fresh-reviewer`):
  this fixture is one small diff.
