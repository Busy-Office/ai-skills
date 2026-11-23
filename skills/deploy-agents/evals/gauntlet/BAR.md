# The bar — deploy-agents deployment review

The gauntlet grades **one artifact**: the coordinator's check of a batch plan before anything is
spawned: what is wrong with each brief and the launch, the fixed briefs, and the launch order. The
reference is the skill's job table, the brief template and `principle-guard-the-machine`.

Run `node evals/bar-check.mjs deploy-agents <artifact>` first for the mechanical rows. A green
pre-check is not a pass. The answer key is the fixture's
[`README.md`](../../fixtures/batch-plan/README.md); the run under test reads only `PLAN.md`.

## What every deployment review requires (miss = FAIL)

1. **Nothing spawned.** No agent, Workflow or test run started; the receipt says so.
2. **Every brief carries all six fields**: Goal (what is true when it is done, checkable), Where,
   Do not touch (with never push, merge or land), Decisions (verbatim), Test (targeted commands),
   Report (claims graded Ran, Read or Inferred).
3. **Model and effort per job follow the job table.** Money, posting, concurrency and security code
   get the strongest model at high effort; review gets another model or a fresh context; searches
   and re-runs get a cheap agent.
4. **The limits hold**: at most 3 agents in flight, the full suite never inside an agent, and the
   coordinator named as the one who runs it, once, alone, at the end.
5. **The user's words are quoted, not summarised**, in every brief whose job they bear on.
6. **Every defect names the line and the rule** it breaks (a brief field, the job table or a limit),
   with the fix.
7. **No invented defects.** A brief that is already right stays as it is.

## Class P — deployment plan (the batch-plan fixture)

**Bar: the coordinator could spawn the fixed briefs in the fixed order and get back agents that stop
on their own, stay inside their worktree, and report claims it can check.**

Pass requires, in addition to the shared list:

1. **Every planted defect is found** with its `PLAN.md:<line>`. One missed id is a FAIL.
2. **The control holds.** No defect is claimed on J5.
3. **The fixed briefs are complete.** The critic reads each rewritten brief against the six fields;
   one field missing or vague ("until it is good") is a FAIL.
4. **The launch order is in waves of at most 3**, and the J2 review waits for J2.

## Properties with no instrument yet

- Whether the fixed briefs produce better agent runs: that needs the batch run both ways and the
  tokens compared (the skill's own Workflow trial says the same).
- Whether a Goal's done condition is the right one for the job, beyond being checkable.
