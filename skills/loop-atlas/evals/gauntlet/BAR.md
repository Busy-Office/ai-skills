# The bar — loop-atlas page

The gauntlet grades **one artifact**: the page loop-atlas publishes for a real
project — the flow and the crew deck. The reference is the owner's brief
(2026-09-09): *visualise the complete loop flow, and introduce each agent like
a collectible card — key abilities, what they are good at.*

The artifact is normally an HTML page. Grade the page; where the critic needs
a text form, grade the markdown the skill wrote alongside it. Run
`node evals/bar-check.mjs loop-atlas <artifact.md>` for M1–M9 when a markdown
form exists.

## What every page requires (miss = FAIL)

1. **Every stage carries a `file:line`** in the table under the diagram, or
   the words *no evidence in any file* — an absence is located where the rule
   should have lived. A stage with an unsourced claim is a FAIL.
2. **The gaps are drawn.** Stages with no evidence appear in the diagram,
   dashed and labelled, not omitted. A diagram of a loop with an invisible
   hole in it is the failure this bar exists to catch.
3. **Every card value is derived, never invented.** Class, model, abilities,
   the four stats, weakness and the `Seen:` line each trace to the agent's own
   file, its tool grant, or the observed runs. **A stat that cannot be derived
   prints `—`**; a plausible number in its place is an immediate FAIL, because
   people route work by these.
4. **Every card has a weakness**, and it is real: what the agent must never be
   handed. A weakness that is a strength in disguise ("too thorough") is a
   FAIL.
5. **Every ability carries a cost** — a fresh context, a token figure, a wall
   clock, one commit.
6. **The three cards people forget are present** when the evidence supports
   them: the **main actor**, any **undefined-but-summoned** subagent type, and
   every **vacancy** (a class with no agent). A deck of only the defined
   agents is a FAIL when the runs summoned something else.
7. **The deck is ordered by observed summons**, not by file order, with
   never-summoned and vacancies last.
8. **No transcript content.** Counts and ids only.
9. **Nothing written to the target repo**; the page is the output.
10. **The static frame is complete.** With motion disabled (or in the exported
    still) the page loses no information — every label, edge and value is
    present. Animation may add sequence only. A page whose meaning depends on
    watching it is a FAIL.

## Class V — visual atlas (this artifact)

**Bar: a stranger can explain one tick from the picture in under a minute, can
pick the right agent for a job from the deck alone, and can name what is
missing from the crew.**

Pass requires, in addition to the shared list:

1. **Flow sufficiency test.** Hide everything but the diagram and its table.
   From those alone the critic answers: what fires it, how it picks work, who
   acts at each stage, who decides done, where it records, how it ends. Any
   "can't tell" is a FAIL.
2. **Deck routing test.** Given three jobs the critic invents (a wide search,
   a change with a stated test, a check of work just written), the deck names
   the right card for each — or shows the vacancy that means there is no right
   card. A wrong routing that the cards actively support is a FAIL.
3. **Card claims verified.** For two cards, the critic opens the agent file
   and confirms the class, the tool grant, and one ability. One mismatch is a
   FAIL.
4. **Counts reconcile.** The summons on the cards sum to the summons in the
   window table; subagent tokens do not exceed the total.
5. **Accessible and theme-honest.** The diagram has a text alternative that
   conveys the same six answers; colours are not the only carrier of the
   "vacant" state (dashes and a word, too); the page renders in both light and
   dark without a vanished stroke.
6. **The bullets under the page each name something visible** in the diagram
   or the deck. A bullet that asserts something the picture does not show is
   a FAIL — that is a judgement, and judgements belong to `loop-doctor` and
   `loop-economist`.

## Properties with no instrument yet

- Whether the stat scale is *calibrated* across projects — reach 4 here and
  reach 4 elsewhere should mean the same thing; nothing yet checks that.
- Whether the animation reads well to a person; the bar checks only that it
  carries no information the still lacks.
