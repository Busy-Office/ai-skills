### Plugin release

**A release reaches everyone who installed the plugin. Check it, ask, then ship.**

1. Work on a release branch in its own worktree.
2. Bump the version everywhere the plugin states it (for a Claude Code plugin,
   `.claude-plugin/plugin.json` and the marketplace file); every copy must match.
3. Add the changelog entry: what changed, for someone who uses the plugin.
4. Run the plugin's checks one at a time — the repository's own list, e.g. in its `AGENTS.md`.
5. `busy-office:review` the release diff.
6. Commit, then rebase onto the main branch, so the tip you show is the tip that ships. The
   rebase moved the tip → run the checks again on it.
7. Ask the owner: one yes/no naming the version and the tip.
8. On the yes, for that tip: fast-forward the main branch, tag in the repository's own naming, push
   both, update the installed copy, restart the session.

**Reply:** the version, the tag, the checks (Ran), whether the release is asked for or done, and
what people who installed it will see.
