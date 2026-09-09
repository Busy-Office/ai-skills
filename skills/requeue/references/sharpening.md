# Sharpening — turning a wish into a task

An item is a task when an actor who has never seen the conversation can
start it and know when to stop. Three parts, all required:

1. **Object** — what changes, named: a file, a route, a table, a screen.
2. **Test** — the observable that says it is done. A command, a status
   code, a number with a unit, a rendered state.
3. **Bound** — what it must not touch, or how far it goes.

## The rewrite

| before | after |
|---|---|
| improve the dashboard | Cut first-paint on `/dashboard` to under 1.5 s on a cold load (Lighthouse, throttled 4G); no change to the data API |
| clean up the parser | Remove the three unused branches in `parser.ts` (`legacy*`); all existing parser tests stay green |
| review error handling | Every route in `api/` returns a typed error body on 4xx/5xx; add tests for the two that currently return HTML |
| make it faster | Cut p95 on `GET /search` from 640 ms to under 200 ms, measured by the existing bench; no schema change |

The pattern: replace the judgement verb with the observable that would
have made you use it.

## When you cannot write the test

That is the finding, and there are only three honest outcomes:

- **A question for a person.** State it as one question with options, put
  the item in the `human` lane, and leave it out of the loop's queue.
- **A spike.** Rewrite it as a bounded investigation with its own exit:
  *"Determine whether X is feasible in ≤ 1 run; output: a note naming the
  approach and the cost. No production code."* A spike's acceptance test
  is that the note exists and answers the question.
- **Delete it.** If nobody can say what done looks like and nothing waits
  on it, the item is a mood, and it has been costing attention every time
  the queue is read.

Never hand an untestable item to the loop with a bigger model attached.
That is the most expensive way to discover the item was never a task.

## How much to sharpen

Sharpen the top of the proposed order — enough for the next few ticks —
and list the rest as needing it. Rewriting forty items produces forty
guesses; the loop only ever reads the top of the queue anyway.
