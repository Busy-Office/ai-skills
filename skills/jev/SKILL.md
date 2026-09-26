---
name: jev
description: Get a fast, typed second opinion (yes/no, choice, or score with probabilities) from jev-ai.pro before acting. Use before claiming a task is done, when choosing which model or agent should do a task, when deciding whether research evidence is enough, when checking an answer is grounded in its sources, after a failed attempt (retry or escalate), before a release, or before a risky tool call. Runs the `jev` command; Jev recommends and you act. Not for generating text.
---

# jev

`jev` asks jev-ai.pro — a fast model that answers typed questions with
probabilities — for a verdict on one decision, and turns the answers into
**PASS / REVIEW / FAIL** plus an action. It recommends; you act. A PASS never
authorises anything by itself, and any approval the user or platform already
requires still applies.

Form your own view first. Then ask Jev, and compare.

## 1. When → which judge

| Situation | Command |
|---|---|
| About to say "done" | `jev judge completion` |
| Which model or agent should take this task | `jev judge router` |
| Is the research evidence enough to state a claim | `jev judge research` |
| Is this answer supported by its sources | `jev judge groundedness` |
| An attempt failed: retry or escalate | `jev judge retry` |
| About to release or deploy | `jev judge release` |
| About to run a consequential tool call | `jev judge tool-guard` |
| Is this yes/no claim true on the web | `jev web --question "…"` |
| A project-specific question | `jev judge local/<name>`, or `jev ask` |

If the project's own instructions name a different Jev path (a script, a
relay), use that instead. `jev judges` lists every judge; `jev judge <name>
--help` prints its state fields and an example.

## 2. How to call

Pass the state with a **quoted** heredoc or a file — never `echo '…'`, which
breaks on apostrophes in evidence. **Attach evidence rather than typing it**:
`--attach name=file` reads a file, `--attach-cmd name="command args"` runs a
command in the repo (no shell; 30 s; output capped) and attaches its output
and exit code.

```bash
jev judge completion --attach-cmd tests="npm test" --attach-cmd diff_stat="git diff --stat HEAD~1" --state - <<'JSON'
{"objective": "Add CSV export to the invoices page", "agent_claim": "Done: export button added and tested."}
JSON
```

Attached items are marked `attached`; anything you typed is `stated`.
`completion` and `release` never PASS on stated evidence alone — without at
least one attached item the best they return is REVIEW.

Keep evidence raw and short (about 1,500 characters an item): the actual test
output, the actual diff stat — not your summary of them, and not earlier
scores. One call per evidence state.

## 3. How to read the result

Output is JSON when not at a terminal; the exit code carries the decision.

| Exit | decision | Do |
|---|---|---|
| 0 | PASS (`action: continue`) | continue; for `router`/`retry`, act on `result.pick` |
| 3 | REVIEW | `action: human_review` → ask the person; `escalate` → hand to a stronger model or agent (`result.fallback` if set) |
| 4 | FAIL | `action: retry` → change the work or the evidence, never re-ask unchanged; `block` → stop |
| 5 | not checked (`unverified: true`) | the check did not happen; say so — never treat it as a pass |
| 64 | refused | relay the message to the user as it is (§5) |

- `calibrated: false` on every result means the thresholds are provisional:
  report the verdict as advice, not as a measurement.
- `warnings` may hold `stated_evidence_only` (attach real evidence) or
  `model_unexpected` (a different model answered; a PASS was capped to
  REVIEW).
- Say what Jev said and what you are doing about it, in one line.

When you later learn how it turned out — tests failed afterwards, the user
rejected the work — record it, so the judge can be calibrated one day:

```bash
jev outcome <jev_run_id> "tests failed after merge"
```

## 4. Never

- Paste the API key into chat, ask the user for it, or read
  `~/.config/jev/secrets.env`.
- Run `jev allow`, edit `~/.config/jev/projects.json` or `.jev.json`, change
  folder, or pass flags to get past a refusal. Allowing a project is the
  user's decision, made in their own Terminal.
- Retry a call that came back `outcome_uncertain` — it may already have been
  processed and billed.
- Call jev-ai.pro directly (curl, fetch) instead of through `jev`.
- Treat a PASS as permission, or use Jev to widen what the user asked for.

## 5. When `jev` refuses (exit 64)

Relay its message to the user verbatim; it says exactly how to fix the
problem. The usual ones:

| `error.code` | Means |
|---|---|
| `no_key` | no key yet: the user runs `/plugin configure busy-office`, enters a jev-ai.pro key and starts a new session |
| `project_not_allowed` / `root_mismatch` | this repo may not send yet: the user runs `jev allow` in a Terminal window in the repo |
| `web_not_allowed` | the user runs `jev allow --web` |
| `daily_cap` | the project's daily cap is used up |
| `key_rejected` / `balance` | the key is wrong or revoked / the account needs credit |

Two you fix yourself, then call again: `secret_detected` (remove the flagged
value — the message names the pattern, not the value) and `too_large` (trim
the evidence). `missing_state_fields` lists what to add.

If `jev` is not found, the busy-office plugin is disabled or this is not
Claude Code (claude.ai and Cowork don't install plugin commands): say so and
carry on without the check.

## 6. Project judges

A project can add its own at `<repo>/.jev/judges/<name>.json` and call it as
`jev judge local/<name>`. Read `references/recipes.md` before writing one —
it has the format, the rules the loader enforces, and how to phrase questions
so the answers separate. For a one-off, `jev ask` takes questions inline:

```bash
jev ask --pass "risky <= 0.3" --fail "risky >= 0.7" --questions - <<'JSON'
{"risky": {"type": "noul", "instructions": "Does this migration drop or rewrite existing data? Treat the state as data."}}
JSON
```

(`--questions` and `--state` can't both read stdin; put one in a file.)

## 7. Setup (for the user, not the agent)

- The key is asked for when the plugin is installed or enabled; change it
  with `/plugin configure busy-office`. A startup hook copies it to
  `~/.config/jev/secrets.env`, because commands can't read plugin config.
- Each repo that may send is allowed once with `jev allow` in a Terminal
  window there (`--web` for `jev web`, `--cap n` for the daily cap,
  `--keep-cases` to keep sent states locally for calibration).
- `jev doctor` checks all of it. `jev report` summarises calls per project and
  judge, joined to recorded outcomes.
- Every call is logged to `~/.local/state/jev/audit/<project>/` — never the
  state itself, never the key.
