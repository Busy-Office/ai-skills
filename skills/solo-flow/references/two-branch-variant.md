# The two-branch variant

Use this instead of the single-`main` model in SKILL.md only after
confirming something outside the loop genuinely reads integration state
before a release tag exists — another agent, another repo, a staging
deploy. If nothing does, don't use this file; the single-branch model is
simpler and has one less thing to keep in sync.

This is GitLab Flow's shape, not classic GitFlow's: no long-lived
`feature/*` branches, no `hotfix/*` branch, no PRs. The only addition
versus the single-branch model is one integration branch sitting between
local work and the tagged, consumer-facing branch.

## The model

| Branch | Where it lives | Purpose | Who merges |
|---|---|---|---|
| `main` | remote | the tagged, consumer-facing branch — only ever advances when a release is cut | the owner approves each release |
| `develop` | remote, default branch | where the agent's merges land continuously; the thing that consumer actually reads ahead of a release | the agent, automatically, once checks pass |
| `feat/*`, `fix/*`, `chore/*` | local only | one unit of work | never pushed |
| `release/x.y.z` | local, short-lived | holds the version bump and notes | merged into `main`, then back into `develop` |

## What changes from the single-branch flow

- Day-to-day work still lands on `develop`, exactly as it would on `main`
  in the single-branch model — same fast-checks-while-building,
  full-suite-plus-review-before-merge discipline.
- CI runs on push to **both** `develop` and `main` — the same check suite,
  not a lighter one for `develop`. A failing run on `develop` blocks
  everything the same way a failing run on the single branch would.
- Releasing now genuinely means merging: cut `release/x.y.z` from
  `develop`, bump + notes, owner approves, merge into `main`, tag `main`,
  **then merge `main` back into `develop`** so the version bump and any
  release-only fixes aren't lost from the branch work continues on.
- The back-merge step is the one piece of bookkeeping this variant carries
  that the single-branch model doesn't. It's cheap when done every
  release; it's a real bug source if a release is ever cut without it —
  a fix made directly against `main` during a release and never carried
  back to `develop` will look "fixed" to consumers and reappear in the
  next release cut from `develop`. Make the back-merge part of the release
  steps in `LOOP.md`, not a separate manual step someone might skip.

Everything else — the permission tiers, the local-branch discipline, the
release-trigger rules, the setup checklist's `git merge-base
--is-ancestor` / `git patch-id` cleanup steps — carries over unchanged
from SKILL.md.
