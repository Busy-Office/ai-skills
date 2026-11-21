# NOTICE

The `busy-office` plugin is MIT licensed ([LICENSE](LICENSE), © 2026 Busy Office). Three of its skills
are adapted from MIT-licensed upstream work. Their copyright and permission notice is in
[LICENSES/pstack-MIT.txt](LICENSES/pstack-MIT.txt) and applies to those skills' upstream parts.

| skill in this plugin | upstream | copyright | licence |
|---|---|---|---|
| `skills/automate-me/` | `automate-me` from pstack ([cursor/plugins](https://github.com/cursor/plugins)), as ported to Claude Code by [pstack-claude](https://github.com/michael-denyer/pstack-claude) v0.9.90 | © 2026 Lauren Tan (pstack); © 2026 Michael Denyer (the port's changes) | MIT, [LICENSES/pstack-MIT.txt](LICENSES/pstack-MIT.txt) |
| `skills/correct/` | `correct` from the same source | © 2026 Lauren Tan; © 2026 Michael Denyer | MIT, [LICENSES/pstack-MIT.txt](LICENSES/pstack-MIT.txt) |
| `skills/blast-radius/` | `blast-radius` from the same source | © 2026 Lauren Tan; © 2026 Michael Denyer | MIT, [LICENSES/pstack-MIT.txt](LICENSES/pstack-MIT.txt) |

The three skills were rewritten for this plugin rather than copied: dependencies on other pstack
skills and pstack tooling were removed, and Claude Code subagents and this plugin's own `jev` skill
stand in where a step needed them. `automate-me` writes a section of the user's global
`~/.claude/CLAUDE.md` instead of a personal skill, and adds a local decision log with
`scripts/decisions.mjs`. Busy Office's changes and additions are © 2026 Busy Office under the
plugin's MIT licence.
