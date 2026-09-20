# Placement

## The tier ladder

| tier | what runs | cost per decision | what it may decide |
|---|---|---|---|
| T0 | code — exit codes, path globs, counts, `git` | nothing | anything a rule can state |
| T1 | **KEV** | ~0.3–0.9 s CPU, no tokens | which tier looks next, among reversible actions |
| T2 | the fast model (Fable, low effort) | tokens | judgement over a bounded input |
| T3 | a reasoning model, or the owner | most | anything irreversible, contested or novel |

Work down the ladder when placing a decision, not up: try to state it as
T0 first. KEV earns a place only on what is left — text that has to be
*read* to be sorted.

Two properties hold at every placement:

- **KEV runs before or instead of a model turn, never inside one.** Once a
  Claude turn is running, it has already paid more than KEV would save; let
  it decide. `kev-agent-kit` does ship an MCP server (`integrations/kev-mcp`, installed at
  user scope as `kev`:
  `kev_decide`, `kev_models`, `kev_check_permutations`) and a `kev-decision`
  skill over it — for an advisory second opinion in a session, and for
  trying questions while designing a gate. It is not a loop placement.
- **T0 guards sit in front of the gate.** Path globs for protected areas
  (`db/migrations/**`, `src/auth/**`, `.github/**`) force the top rank
  without asking KEV. The gate reads the author's account of a change; the
  globs do not depend on anyone's wording.

## Five placements

Each names the expensive direction — what calibration counts as a miss.

### 1. Wake gate — before the tick starts

The driver assembles what it would cost almost nothing to read — queue
head, `git log -5 --format=%s`, CI status line — and asks whether there is
work. A skip saves the whole preamble `wake-weight` measures.

- Actions: `skip` (rank 0), `wake` (rank 1). Unreachable → `wake`.
- Miss: skipped a tick that had work. Cost: one interval of delay — cheap,
  but compounding, so **bound it in the driver**: after N consecutive skips
  (3 is a fair start), wake regardless and reset.
- T0 first: an empty queue file and no new commits is a byte count and a
  `git rev-parse`, not a KEV call.

### 2. Review depth — after the build, before the review

`gates/merge-risk.json`. Chooses how deep `solo-flow`'s independent review
goes; the review happens either way, and so do the checks.

- Actions: `light-review` (rank 0), `deep-review` (rank 1).
- Miss: a risky change got the light review.
- State: commit subject + `git show --stat`, not the patch.

### 3. Failure triage — a red run

Read the tail of the failing job's log; sort into `retry` (flaky: timeout,
network, known-flaky test name), `fix` (an assertion or a compile error in
changed code), `escalate` (runner, credentials, quota). This is KEV's best
case — the answer is *stated* in the log.

- Miss: retried a real failure. Bound retries in the driver at one.
- T0 first: exit codes and a list of known-flaky test names.

### 4. Verifier pre-filter — before an expensive verifier node

Before a T3 verifier reads an agent's output, check the output has what the
contract requires as *stated facts*: it names the tests it ran, it cites
files, it has the required sections. A reject here costs a retry of the
cheap node instead of a turn of the expensive one.

- Actions: `reject-to-author` (rank 0), `verify` (rank 1).
- Miss: bounced a good output. Bound at one bounce, then verify anyway.
- This never replaces the verifier. It removes the outputs that were never
  going to pass.

### 5. Model router — choosing the tier for a unit of work

KEV's *opinion* of how hard an item is was not reliable. Route on facts it
can read (touches a protected area; names a file and a checkable result;
asks for a decision) plus T0 facts (files changed, lines changed), with the
mapping to a model in the driver.

- Miss: hard work sent to the cheap tier. The T2 turn must be able to hand
  up ("this needs the reasoning model") — a router with no way back up is
  the defect, whatever KEV says.

Not placements: anything that compares two texts (already-done detection,
dedupe), anything whose answer is a number in the state (T0), anything that
approves.

## Calling it

### From a driver script (the main route)

```bash
#!/bin/sh
# tick.sh — launchd / cron / a sleep loop calls this
SKILL=~/.claude/skills/kev-gate
STATE=$(git show --stat=100 --format='%s' HEAD | head -12 | jq -Rs '{change:{diff:.}}')
ANS=$(printf '%s' "$STATE" | node $SKILL/scripts/kev.mjs ask .loop/gates/merge-risk.json --state - --log .loop/kev.jsonl)

DEPTH=deep-review                                   # what the loop did before the gate
[ "$(printf '%s' "$ANS" | jq -r .enforce)" = true ] && DEPTH=$(printf '%s' "$ANS" | jq -r .action)
git diff --name-only HEAD~1 | grep -qE '^(db/migrations|src/auth)/' && DEPTH=deep-review   # T0 guard wins

case $DEPTH in
  light-review) claude -p "$(cat .loop/prompts/review.md)" --model fable ;;
  deep-review)  claude -p "$(cat .loop/prompts/review-deep.md)" --model opus ;;
esac
```

Three things to keep from this shape: the pre-gate behaviour is the
variable's initial value, so a shadow gate and a dead KEV both leave it
untouched; `enforce` is read from the answer, not assumed; the T0 guard runs
after the gate and wins.

`ask` prints one JSON object: `action`, `rank`, `enforce`, `reason`, `facts`,
`kev` (false when it failed open), `id` (for `outcome`), `latency_ms`.

### From a Claude Code hook

A hook is a shell command, so the same `ask` call works — for example a
`Stop` hook that screens the final message for a claim of "done" with no
test evidence stated, and blocks the stop to ask for it. Keep hook gates to
*reading* facts in text the hook already receives, and give the hook a
timeout shorter than `KEV_TIMEOUT_MS` would allow a hang. Configure hooks
with the `update-config` skill; this skill does not edit settings.

### Inside an orchestration graph

A gate is a routing node that costs no tokens: a classification, then an
`if` in code. In a graph review it is drawn as a node with **two out-edges,
act and escalate**, and the escalate edge is never optional.

Workflow-tool scripts cannot `import`, and whether they can reach the
network has not been verified here. Until it is, run the gate in the code
that *launches* the workflow and pass the result in as `args` — the router
decides which script or which `model` the workflow is started with.

### With the TypeSafe SDK

`@typesafe-ai/sdk` reads `TYPESAFE_BASE_URL` and `TYPESAFE_API_KEY`; the
local server exposes the same `POST /v1/systemone`. A TypeScript driver can
use the SDK's `choice() / noul() / score()` helpers against
`http://localhost:8008` and keep this skill's gate file as the source of
questions and rules. `jev-review` (github.com/devagrawal09/jev-review) is a
worked example of the staged pattern: screen → locate → classify → score →
route, thresholds as named constants, every stage able to drop a finding.

### Local, hosted, cloud

`KEV_URL` defaults to `http://localhost:8008`. A cloud routine cannot reach
localhost; there the gate fails open on every call, which is correct and
saves nothing — host the model where the loop runs, or point `KEV_URL` at a
hosted endpoint and accept that the state now leaves the machine. Say which
before wiring it.

The playground (`localhost:8009`) is the quickest way to try a question
against a pasted state before it goes into a gate file; `/v1/systemone/permute`
re-runs one `choice` under shuffled option orders to expose position bias.
