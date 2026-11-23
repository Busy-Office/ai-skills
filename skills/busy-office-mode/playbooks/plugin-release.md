### Plugin release

**A release reaches everyone who installed the plugin. Check it, then ask.**

1. Work on a release branch in its own worktree.
2. Bump the version everywhere the plugin states it (for a Claude Code plugin,
   `.claude-plugin/plugin.json` and the marketplace file); every copy must match.
3. Add the changelog entry: what changed, for someone who uses the plugin.
4. Run the plugin's checks one at a time — the repository's own list, e.g. in its `AGENTS.md`.
5. `review` the release diff.
6. Commit, fast-forward the main branch, and tag, in the repository's own naming.
7. Ask the owner before pushing: one yes/no naming the version and the tip.
8. On the yes: push the main branch and the tag, update the installed copy, restart the session.

**Reply:** the version, the tag, the checks (Ran), whether the push is asked for or done, and what
people who installed it will see.
