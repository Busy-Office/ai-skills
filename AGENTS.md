# Working in this repo

This is the source of the `busy-office` Claude Code plugin (marketplace `busy-office-ai-skills`,
GitHub `Busy-Office/ai-skills`). A change here reaches every project that installs the plugin.

## What belongs here

- Skills that are reusable across projects. A skill that names one repo's paths or rules lives in
  that repo, not here.
- Nothing a project's CI or landing gate depends on. Gates must run with no plugin installed.
- Before adding a skill, check that no skill here already does the job.

## Trying a change

Load the working copy for one session; it replaces the installed plugin for that session only:

    claude --plugin-dir ~/Projects/busy-office-skills

On a machine where the plugin is installed, do not symlink a skill from this repo into
`~/.claude/skills`. The link silently overrides the released copy, and the two drift apart. (The
single-skill symlink in the README is for people who do not install the plugin.)

## Checks

    node --test skills/jev/test/     # the jev suite; needs no key or network
    node evals/consistency.mjs       # the collectors still agree with each other

## Releasing

1. Work on a branch. Bump `version` in `.claude-plugin/plugin.json` and in both places in
   `.claude-plugin/marketplace.json`; the three must match.
2. Run the checks above.
3. Commit as `<version>: <what changed>`, fast-forward `main`, and tag `busy-office--v<version>`.
4. Ask the owner before pushing: a push publishes to everyone who has the plugin. Then push `main`
   and the tag.
5. Update the installed copy and restart the session:

       claude plugin marketplace update busy-office-ai-skills
       claude plugin update busy-office@busy-office-ai-skills

6. Run `jev` once. The plugin's startup hook re-points `~/.local/bin/jev` at the new version;
   `jev link` re-creates it if it did not.
