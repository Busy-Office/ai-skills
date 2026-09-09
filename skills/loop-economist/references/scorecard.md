# Scorecard — six dimensions of a run

Score the **runs**, not the design. Every dimension is 0–5 with a one-line
reason that cites a metric or a session id. If the reason has no number in
it, the score is unearned.

## Anchors

| score | meaning |
|---|---|
| **5** | the metric is in band and the evidence shows it held across the whole window |
| **4** | in band, with one session or one file as an exception |
| **3** | mixed: in band on average, out of band on a third of the runs |
| **2** | out of band, cause identified |
| **1** | out of band with a compounding second cause (e.g. rework *and* thrash) |
| **0** | the mechanism does not exist at all (no verifier ran; nothing shipped; no records) |

Where the evidence is missing rather than bad, write `NOT MEASURED — <why>`
and leave the dimension out of the mean. Never score upward on absence.

## Dimensions

| dimension | asks | primary evidence |
|---|---|---|
| **effectiveness** | did the runs produce shipped, kept change? | `commits`, `doneItems` movement, `zeroCommitSessions` |
| **efficiency** | what did a unit of change cost? | `tokensPerCommit`, `toolCallsPerEdit`, `minutesTotal` |
| **budget** | is the spend controlled and cached? | `billableTokens` vs window, `cacheHitRate`, `sidechainShare`, any budget cap in the loop's rules |
| **plan quality** | was the work a task before it started? | stated-acceptance share, `vagueItems`, thrash-on-vague-item correlation |
| **agent fit** | right actor, right shape of work? | `modelMix`, `subagentMix`, `topTools` vs `agent-fit.md` |
| **convergence** | does one run reach done and stay done? | `reworkRate`, `thrashSessions`, `churnFiles`, `toolErrorRate` |

**Autonomy load** (`humanTurnsPerSession`, `interrupts`) is not a seventh
dimension — it is reported as a headline number and it caps the verdict
(below).

## Verdict

Mean of the scored dimensions:

| mean | verdict | means |
|---|---|---|
| ≥ 4.0 | **compounding** | the loop is paying for itself; spend the recommendations on scale |
| 3.0 – 3.9 | **productive** | working, with a known leak; fix the lowest dimension first |
| 2.0 – 2.9 | **expensive** | it ships, but the unit cost or the rework makes it a bad trade today |
| < 2.0 | **spinning** | it consumes budget without producing kept change; stop and re-plan the input before spending another tick |

Caps, applied after the mean:

- `effectiveness` = 0 (nothing shipped in the window) caps the verdict at
  **spinning**, whatever the other five say.
- `humanTurnsPerSession > 3` caps at **productive** — a loop a person has
  to steer four times a run is not compounding, however cheap it is.
- `reworkRate > 0.4` caps at **expensive**.

## Writing the score

Reason first, number second — the same discipline the reasons enforce:
write the sentence with the metric in it, check it against the anchors,
then put the digit down. A score and a reason that disagree is a defect in
the review, not a rounding choice.
