# Critic prompt — graph-engineer gauntlet

The critic prompt is shared by every skill's gauntlet and lives at
[`evals/CRITIC.md`](../../../../evals/CRITIC.md); fill its fields with:

    Skill:   graph-engineer
    Bar:     skills/graph-engineer/evals/gauntlet/BAR.md   (shared list + Class D | R | C)
    Anchors: skills/graph-engineer/references/   (topologies, cycles, cost-model, anti-patterns)

One difference from the siblings: the instrument is not `evals/bar-check.mjs`
but the skill's own lint, run on the script inside the artifact —

    node skills/graph-engineer/scripts/graph-lint.mjs <script extracted from the artifact>

Extract the script's code block to a scratch file first; grade its lint
output against BAR §7–8 and, for Class R, against the fixture's README table
of planted ids. Then read the diagram before the prose, and grade the
barrier table against the script: every `parallel()` in the code must have a
row, and every row must name an operation that needs the whole set.

The target repo is read-only. Confirm `git -C <target> status --porcelain`
is identical before and after, and that no Workflow run appears in the
session's `/workflows` list for this artifact.
