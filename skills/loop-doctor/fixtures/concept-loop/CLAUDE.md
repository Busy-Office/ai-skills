# Shop UI

## Autonomous loop

The loop runs from `scripts/loop.sh` every 30 minutes (launchd). Read first:
`docs/RESUME.md`, then `ROADMAP.md`, then `docs/GATES.md`.

- If `HALT` exists in the repo root, stop before doing anything.
- Pick with `jev judge pick` from the unblocked items in ROADMAP.md; below its floor, the main agent picks the first unblocked item.
- Before starting, `jev judge item-check` sets the level (light or standard).
- Each try starts with a one-line hypothesis. Maximum 3 tries per item; stop early on a plateau and keep the best try.
- The doer may change the implementation, never the acceptance line of an item.
- The verifier agent (`.claude/agents/verifier.md`) runs in a fresh context and passes only on test output it ran itself.
- Standard items get one critique lens: UX for UI work, engineering for the rest.
- When every item of a milestone is done, run the milestone review: two lenses on the running app, and the strongest case against the design.
- One-way doors (migrations, releases, spending, messages to people) go to `docs/GATES.md` and are worked around.
- Budget: 200k tokens per item, 5M tokens per week.
- When no roadmap item is unblocked, re-plan from `intent.md` as proposals; never edit intent.md.
- Record the outcome in `docs/LOOP-LOG.md`, last, one line per tick.
