# The bar — wake-weight report

The gauntlet grades **one artifact**: the report wake-weight writes for a real
project. The reference is the owner's brief (2026-09-09): *optimise the loop —
find what every run pays before it does any work, and what to cut.*

Run `node evals/bar-check.mjs wake-weight <artifact>` first for the mechanical
criteria. A green pre-check is not a pass.

## What every report requires (miss = FAIL)

1. **Three numbers, together**: per tick, across the window, projected at
   current growth. A per-tick figure with no window total is a FAIL unless the
   tick count is genuinely unknown — in which case the report says so and does
   not guess one.
2. **Estimates are labelled.** Every token figure derived from character counts
   says so, at least once and next to the headline number. Presenting an
   estimate as a measurement is an immediate FAIL.
3. **Every loaded file says why it is loaded** — the file and line that pulls
   it in, or "always loaded". A row with no provenance cannot be cut and is a
   FAIL.
4. **Growth reported per file** as net lines in the window with the commits
   that made them, not as an adjective.
5. **Every cut carries a saving per tick and across the window, a cost, and a
   risk.** A cut with no stated risk has not been thought about. "Reduces
   context bloat" is not a saving.
6. **The savings are arithmetically consistent** with the file table: a cut
   cannot save more than the file weighs.
7. **A "what not to cut" section exists** and names at least one thing —
   including anything whose absence would turn into re-derivation.
8. **Nothing written to the target repo**, no project command run.
9. **The heuristic's edges are stated**: which rows the collector could not
   prove are read every tick, and that a driver reading something the rules
   never name would be invisible.

## Class W — weight report (this artifact)

**Bar: the owner can pick one cut, make it that afternoon, and know what they
expect to save and what they are risking.**

Pass requires, in addition to the shared list:

1. **Sum check.** The per-file token estimates sum to the stated per-tick
   total within 2%.
2. **Provenance check.** For two rows of the critic's choosing, the cited file
   and line really do name that file on a line with a read verb.
3. **The dominant class is named** and the prescribed cut matches it — an
   archive rule for a queue, a tail read for a log, on-demand for a map.
4. **Cut 1 is the largest saving that is also safe** (dead weight before
   on-demand), or the report says why not.
5. **Where `loop-economist` numbers exist for the same window**, the preamble
   is expressed as a share of measured spend, and that share is arithmetically
   right.
6. **No cut is proposed for the definition of done or the intent document.**
   Both are small and load-bearing; proposing them is a FAIL.

## Properties with no instrument yet

- Whether a cut, once made, actually reduces total spend — it can move cost
  into re-derivation. Needs a second window and `loop-economist` to settle.
- The accuracy of the chars-per-token constant for a given file mix; it is an
  estimate and the bar only requires that it is labelled as one.
