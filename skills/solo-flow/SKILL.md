---
name: solo-flow
description: Prescribes and audits a trunk-based git workflow for a repository with exactly one writer — a single autonomous agent or loop, with no other humans committing. One branch (main), local-only short-lived work branches, CI as the sole independent check (no PRs, nothing to review socially), and releases as tags cut directly off main rather than a develop/release branch dance. Use whenever someone is setting up or reviewing git/branching/release conventions for an agent-driven or loop-driven repo, asks whether to use GitFlow/GitHub Flow/GitLab Flow/trunk-based development, wants AGENTS.md or CLAUDE.md git rules written, is deciding whether a develop branch or long-lived feature branches earn their keep, or reports branch drift, a forgotten back-merge, or an autonomous loop that got confused about which branch it was on. Also use to sanity-check an existing branching setup that looks like GitFlow but has no other human collaborators to justify it.
---

# Solo Flow

GitFlow's branches (`develop`, long-lived `feature/*`, `release/*`, `hotfix/*`)
exist to coordinate humans who would otherwise step on each other. A repo
with exactly one writer — one agent, one loop, nobody else committing —
has no one to coordinate with. Every branch that isn't earning its keep
against that fact is state the loop has to track for no return: one more
thing to fast-forward, one more thing that can drift from its sibling, one
more question ("which branch am I on, and is it in sync?") a tick has to
answer before it can start.

Solo Flow is trunk-based development named for this specific case: one
branch (`main`), short-lived local work branches, CI as the only
independent check, and releases as tags cut directly off `main` instead of
a `develop`/`release` branch dance. It is not a novel workflow — it is
2026's mainstream recommendation for CI/CD-heavy teams, applied to the
narrower and more clear-cut case of a single automated committer.

## When a second branch would be justified — and it usually isn't

Before prescribing this, check for the one thing that would justify keeping
a `develop`/integration branch separate from `main`: **does anything outside
the loop consume in-progress state before a release tag exists** — another
agent, another repo, a staging deploy that reads ahead of what's tagged?

- If nothing does — the common case — collapse to one branch. `main` only
  ever holds commits that passed the full check suite, so there is no
  "unstable" state a second branch would need to shield anyone from.
- If something genuinely does — say, a deploy pipeline that must see
  integration state before a human signs off on a release — keep a
  `develop`/`main` split. That's GitLab Flow, a legitimate pattern; don't
  force trunk-based onto a repo that has a real second audience. Point that
  case to `references/two-branch-variant.md` instead of the model below.

Don't take the requester's word that a second branch is needed — ask what,
specifically, reads `develop` today. "We might want it later" is not a
consumer.

## The model

| Branch | Where it lives | Purpose | Who merges into it |
|---|---|---|---|
| `main` | remote, default | the only shared state; every commit on it has already passed the full check suite | the agent, automatically, once checks pass |
| `feat/*`, `fix/*`, `chore/*` | local only | one unit of work (one roadmap item, one bug, one cleanup) | never pushed — merged locally into `main`, then deleted |
| `release/x.y.z` | local, ephemeral (minutes, not days) — only needed if the version bump + notes take more than one commit, or the owner wants to review notes before they're permanent | holds the version bump and release notes until the owner signs off | fast-forwarded into `main`, then discarded — nothing merges back out of it |

The permission boundary is intentionally short, because there's only one
writer to grant permissions to:

- **Automatic:** local branches and commits, merging a work branch into
  `main` once checks pass, deleting merged local branches, cutting and
  merging `release/*`.
- **Needs the owner:** tags and GitHub releases, CI configuration changes,
  repository settings.
- **Never:** force-pushing `main`, deleting `main`, committing to `main`
  without the check suite having run on that commit.

## Day-to-day flow

1. `git fetch`, fast-forward local `main` to `origin/main`.
2. Create a local work branch off `main`; one commit per item.
3. While building, run only the fast checks (typecheck + lint) — save the
   full suite for step 4, it's too slow to run on every save.
4. Before merging: the full check suite, once per batch, plus one
   independent fresh-context review of the whole diff (a different agent
   or persona than the one that wrote it — the review is worth nothing if
   it's the same context grading its own work).
5. Merge: rebase onto `origin/main` if it moved, merge (fast-forward or
   `--no-ff`, pick one convention and keep it) into local `main`, push
   `main`, delete the local work branch.
6. The merge commit message is the record: items closed, net line change,
   decisions taken, and a release recommendation when one is due.
7. Anything handed off to another agent or repo cites the exact `main`
   commit SHA — never "whatever's on main," which moves.

## Checks

One GitHub Actions workflow, triggered on push to `main`: install from the
lockfile, build, lint, typecheck, unit tests, and whatever security check
the project runs. Upload test output on failure so a human (or the next
tick) can read why without re-running it. A failing run on `main` blocks
everything downstream of it — there is no second branch it could be
failing on instead, so there's no ambiguity to resolve about which one is
authoritative.

A second, separate workflow triggers on tag push (`v*`) for release
publishing — see Releases below. Keep the two workflows distinct: the
per-commit one gates every change, the per-tag one only runs at release
time and shouldn't slow down ordinary merges.

## Releases

A release is an annotated tag on a specific commit of `main`, pushed, with
notes published as a GitHub Release. Nothing merges between branches to
produce it.

```bash
git tag -a v1.4.0 -m "1.4.0: <one-line summary>"
git push origin v1.4.0
```

**When to cut one** — the agent recommends, the owner approves; the agent
never tags on its own judgement alone:
- a consumer needs a version to pin;
- a public export, prop, or behaviour has changed;
- 3 or more roadmap items have closed since the last release;
- 2 weeks have passed with unreleased work.

**Versioning:** a patch for fixes only, a minor for anything a consumer can
observe. (Reserve major bumps for the human decision they are — nothing
here should auto-recommend one.)

**Steps**, using the ephemeral `release/x.y.z` branch only when the bump
isn't a single mechanical commit:
1. Cut `release/x.y.z` from `main` at the commit to release (skip this and
   commit the bump straight to `main` if it's genuinely one commit and
   needs no review before it's permanent).
2. Bump the version, write the notes.
3. Owner approves; fast-forward `main` to include that commit.
4. Tag `vx.y.z` on that commit, push the tag, publish the GitHub release.

There is no "merge main back into develop" step — with one branch, there is
nothing to merge back into.

## Setting it up in a new project

1. If `main` already holds released code, tag the current tip as the
   baseline before changing anything else, so nothing already shipped
   looks unreleased.
2. Add the CI workflow: one trigger on push to `main`, a second on tag
   push for publishing. Confirm the first run actually passes before
   relying on it to gate anything.
3. Write the rules above into the agent's instructions (`AGENTS.md` or
   `CLAUDE.md`), with the release-trigger rules in one place the loop
   actually reads before selecting work (for example `LOOP.md`) — not
   copied into both, so there's exactly one copy to keep current.
4. `.gitignore` the loop's own state and tool output — it shouldn't be
   part of the history the checks above are protecting.
5. If a `develop` branch (or any other stale integration branch) already
   exists from a prior setup, don't delete it blind. Confirm every commit
   on it is already reachable from `main`:
   ```bash
   git merge-base --is-ancestor develop main && echo "safe to delete"
   ```
   If that fails, some commits on `develop` never made it to `main` —
   find them with `git log main..develop` and check whether any survive
   only as cherry-picks (same change, different SHA) with
   `git patch-id`, which matches commits by the content of their diff
   rather than their hash:
   ```bash
   git log main..develop --format=%H | git patch-id --stable
   git log --format=%H -20 main | git patch-id --stable
   # a matching patch-id on both sides means that commit already landed under a different SHA
   ```
   Only delete once every commit is accounted for one way or the other.

## Judgement calls

**A second branch is a claim, not a default.** Anyone proposing to keep
`develop` should be able to name what reads it today. If the answer is "it
felt safer" or "that's how the last project did it," that's the GitFlow
habit talking, not a requirement of this repo.

**The review step is not optional just because there's no PR.** Dropping
PRs removes social ceremony, not verification. "One independent
fresh-context review before merging" is doing the job a second reviewer's
eyes would have done — skip it and the only check left is CI, which
catches what it was written to catch and nothing else.

**`--no-ff` vs fast-forward is a one-time choice, not a per-merge one.**
Whichever you pick, every batch should look the same in history — a mix of
both makes `git log --graph` on `main` unreadable and tells you nothing
about which merges were "real" batches.

**Tags are immutable; branches are not.** If a release tag needs to
change, that's a new patch version, never a moved tag — a consumer who
already pinned `v1.4.0` must never see it point somewhere else later.

## Files

- `references/two-branch-variant.md` — the GitLab-Flow-style two-branch
  model (`develop` + `main`), for the case where something outside the
  loop genuinely does consume pre-release integration state. Read this
  instead of the model above only after confirming that consumer exists.
