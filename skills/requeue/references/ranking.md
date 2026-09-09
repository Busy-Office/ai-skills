# Ranking — how the order is decided

Rank against the project's **intent document**, never against taste. If no
intent document exists, say so before ranking anything: an order without a
purpose is just a rearrangement.

## Five factors, in this precedence

Precedence matters more than weights. When two factors disagree, the
higher one wins and you say so in the item's one-line reason.

1. **Unblocks** — how many other open items or people this releases. A
   thing three items wait on outranks a thing nothing waits on, even if
   the second is more valuable on its own.
2. **Intent** — does the item move the stated purpose, and can you point
   at the sentence it serves? An item that traces to nothing is a
   candidate for deletion, not for rank 6.
3. **Readiness** — is it a task? Acceptance test stated, files known,
   no open decision inside it. An unready item cannot hold a high rank;
   sharpen it first (`sharpening.md`) and *then* it can.
4. **Decay** — does waiting make it worse or more expensive? Migrations
   before more code lands on the old shape; a security or data-loss
   exposure; anything a deadline or an external date binds.
5. **Cost** — effort and risk of the change itself. It breaks ties; it
   never beats the four above. "Small" is not a reason to do something
   first, only a reason to prefer it over an equal.

## Who does it, and does that change the order

Every ranked item carries an actor and a lane:

| lane | meaning | effect on order |
|---|---|---|
| **loop** | the autonomous loop can finish it unattended | goes in the queue in rank order |
| **loop, subloop** | needs try · verify · adjust rounds — the approach is uncertain | keep, but budget it as several attempts |
| **loop, gauntlet** | more than one plausible approach and a costly wrong choice | keep, and write the bar before it runs |
| **human** | needs a credential, an account, a decision, a signature | leave the queue; goes to a gate list with the exact ask |
| **blocked** | waiting on something named | leave the queue with the blocker named; if the blocker is unnamed, that is the item |

A queue that mixes human-only items into the loop's lane stalls the loop
on things it cannot do. Separating the lanes is often the whole fix.

## Hygiene, applied before ranking

- **Duplicates** — the same item in two files: keep the copy in the file
  the loop actually reads, make the other a pointer.
- **Contradictions** — done in one place, open in another: resolve which
  is true from the repo, not from the newest file.
- **Ghosts** — items that no longer trace to intent, or whose object no
  longer exists in the code. Propose deletion explicitly; a queue nobody
  can finish is a queue nobody trusts.
- **Stale** — open a long time and never attempted. Say the age. Old and
  still right is fine; old and quietly dead is not.

## The output is a proposal

The order is a recommendation with a reason per item. The person (or the
gate) accepts it. Rewriting the queue file is a separate, asked-for step —
never a side effect of ranking it.
