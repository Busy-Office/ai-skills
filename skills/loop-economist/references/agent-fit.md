# Agent fit — who should do which work

The loop's actors are a crew, and most cost problems are casting problems:
the wrong actor, or one actor doing every part.

## Routing table

| work | shape | route to | why |
|---|---|---|---|
| locate code / sweep many files for a convention | wide read, narrow answer | a search subagent (`Explore`-class), fresh context | the file dumps stay out of the caller's context; only the conclusion returns |
| mechanical edit with a stated rule (rename, format, codemod, port a pattern) | deterministic | a small fast model, or a script | reasoning tokens here buy nothing |
| feature work against a written acceptance test | build + verify | the main actor, one context | it needs the thread of what it just changed |
| design / trade-off / a plan whose shape is unknown | judgement | the strongest model, once, with a written output | pay for reasoning where the output is the reasoning |
| review of code the loop just wrote | adversarial | a **separate** context or a reviewer agent | a context cannot independently check itself; it will confirm its own choices |
| research an external API or unfamiliar library | wide read, cite-heavy | a research subagent writing to a file | keeps the citations, drops the pages |
| anything with no acceptance criterion | not yet work | `requeue` | no actor can converge on an unstated target |

## Personas worth naming in a loop

A persona is a role with its own inputs, output and refusal — not a tone.
Four earn their keep in an engineering loop:

- **Planner** — turns an item into a task with an acceptance test and a
  file list. Refuses to edit code.
- **Builder** — makes the change, minimum diff, keeps existing tests
  green. Refuses to widen scope.
- **Verifier** — runs the acceptance test and reads the diff against the
  item. Refuses to fix what it finds; it reports. This is the persona
  most missing loops lack, and its absence shows up as `reworkRate`.
- **Editor / integrator** — decides what to keep, records the tick, and
  is the only one that commits.

Small loops can collapse Planner into Builder. **Never collapse Verifier
into Builder** — that is the one seam that pays for itself, and the
evidence is in the rework and churn numbers.

## Fan-out rules

- Fan out over **independent** dimensions (files, review axes, candidate
  approaches), never over steps of one dependent chain.
- Every subagent gets: the goal, the output shape, and the budget. A
  subagent with no output shape returns prose the caller must re-read —
  paying twice.
- Cap the crew per tick. Unbounded fan-out is how `sidechainShare` passes
  0.5 while `commits` stays flat.
- One context, one pass, is the right answer more often than it looks.
  Judge from `toolCallsPerEdit`: fan-out is worth it when the reading
  dominates, not when the deciding does.

## What the roster does not predict

Across six real projects measured in one 30-day window, **the number of agents
did not track rework at all**. One project with ten agents and one with a single
agent both sat at 0.23; the project with *no* agent definitions shipped 2033
commits at 0.04. What tracked instead was whether anything gated the work — the
two worst had the least CI, the two best had the most.

Read that as a caution about this whole page rather than a law: n is six,
`reworkRate` keys on commit subjects and so is sensitive to naming convention,
and one of the low-rework projects had too few commits to count. But it is
enough to order the prescriptions. **Fix the seam before the roster.** Adding a
persona to a loop that gates nothing moves cost around; adding a gate to a loop
that has none is what moves rework.

## Price the roster before judging it

`perAgent` gives each subagent type's average cost per summon, its model and
its real tool mix. Read those three together before calling any routing wrong:

- A **verifier** whose tool mix is all `Read`/`Grep` and never runs the test
  command is not verifying — it is reviewing. Say which you found.
- A **searcher** that costs as much per summon as the builder is not saving the
  caller anything; either its brief is too wide or its output shape is unstated.
- The **most expensive summon on the page** deserves one line of justification
  in the review, whichever agent it is.

## Reading the mix

- Heavy model + `topTools` dominated by Read/Grep/Bash ⇒ **over-powered**;
  route the searching out.
- `subagentMix` empty + `toolCallsPerEdit` high ⇒ **unrouted**; the actor
  is doing its own sweeping in the expensive context.
- No reviewer agent, no separate verify session, and `reworkRate` > 0.25
  ⇒ **no verifier exists**; that is an `agent fit` 0, not a 2.
