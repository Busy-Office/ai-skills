---
name: blast-radius
description: "Finds what a change can break beyond its diff (consumers grep will not show, wire formats, lifecycle, pinned library versions) and proves the one fact it is safe because of by running real code, not by writing it up. Use for \"blast radius of X\", \"what could this break\", a small diff you do not trust, or a brief that asserts something about existing code before you design against it. Not for the shape of a multi-agent run (that is graph-engineer)."
---

# Blast radius

Find what a change breaks somewhere else, before it ships. Run it before design too, not only before
shipping, when a brief asserts something about existing code ("make endpoint X public", "X already
handles Y"): the assertion is a hypothesis, and the census of who consumes X is what decides the
design.

Listing the callers is not the job; grep does that in a second. The job is the breakage grep will
not show you.

## Don't trust your own writeup

A blast-radius writeup that sounds right is worthless: it reads as convincing whether or not it is
true. So don't hand back the writeup alone. Find the one or two facts the whole thing depends on and
prove them by running code.

### How sure are you

For each fact the change's safety depends on, get it as far down this list as is cheap, and say
where it stopped.

| level | what you have | grade |
|---|---|---|
| 1 | You said so. Worthless on its own. | Inferred |
| 2 | You pointed at the line: a real `file:line`, or the library's own source. | Read |
| 3 | You showed the bad case cannot happen: you walked the failure step by step and it does not reach. | Inferred, argued |
| 4 | You ran it: a script or test that calls the real code and fails loudly if you are wrong. | Ran |
| 5 | You reproduced it in the running application. | Ran |

Level 4 is usually one small script that imports the same library the application ships and calls
the exact function you are worried about.

## Steps

1. **Read the change.** The diff; the symbols it adds, changes and deletes; what it now does
   differently, including what the diff does not spell out. `git log -p` and `git blame` on the
   touched lines give the history and the reason they were shaped that way.
2. **Find the one fact it is safe because of.** Most changes that look risky are safe because of a
   single fact, such as "this call only drops cache entries that are already dead and does nothing
   else". Find that fact. If it holds, most risky cases clear at once. Spend your time here, not on
   a long list of maybes.
3. **Look where grep stops.** Read the source of the library you call, and check its pinned version
   and any local patch. Work out when things run: async ordering, teardown, the framework's
   lifecycle. Follow what a symbol search misses: the JSON an API returns, a database column, a wire
   format, another language reading the same bytes, a feature flag, a config key, a consumer three
   hops downstream or in another repository.
4. **Be honest about each risk.** Give it a real chance of happening and a real cost if it does.
   Keep the risks you confirmed. List the ones you checked and cleared separately. Cite a real
   `file:line`; a search that finds nothing is still an answer, and say which search. Never make up
   a caller or an API.
5. **Prove the one fact.** Write a script or test that runs the real code, run it, and paste what it
   printed. Write it in the scratchpad unless the user wants it kept as a test.
6. **For a big or wide change, get independent reads.** Give the diff, not your conclusion, to one
   or more Claude Code subagents in a fresh context, and merge what they find; different reviewers
   catch different real bugs. The `jev` skill can add a quick second opinion on a narrow question if
   it is installed and the repository is allowed.

## What to hand back

- **What it does.** What changed, including the part that is not obvious.
- **The one fact it is safe because of.** State it, the level you got it to, and the proof. If you
  could not prove it, write **unproven**.
- **Risks.** Each names how it breaks, the `file:line`, how likely and how bad, and how to check.
  Paste the proof for the ones that matter.
- **Cleared.** What you checked and why it is fine.
- **Before it lands.** The cheapest test or repro that catches the real bug, including the script
  you wrote.

Cite real code, keep it short, and strip anything private before it goes anywhere public.

**Reply:** the writeup above, with the one safety fact either proven or marked unproven.

---

Adapted from pstack's `blast-radius` (MIT, © 2026 Lauren Tan; Claude Code port © 2026 Michael Denyer); see [NOTICE.md](../../NOTICE.md).
