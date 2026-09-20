# Calibration

A gate is a claim — *this cheap answer can stand in for that expensive one,
on these decisions, erring only upward* — and calibration is the evidence.
No gate is wired to `enforce` without a record of it.

## Case files

One JSON object per line; lines starting `//` are comments.

```json
{"state": {"change": {"diff": "db: migration 0043 drops column users.legacy_role."}}, "want": "deep-review", "note": "optional"}
```

- `state` is exactly what the driver will send: same keys, same shape, same
  length. A gate calibrated on one-line summaries and fed raw patches is
  uncalibrated.
- `want` is an action the gate can emit. If the right lane is one the gate
  never emits (triage would have sent it to *sharpen*), label it with the
  gate's escalation action and put the detail in `note`.
- Two files. **`tune.jsonl`** (≥ 20) is looked at as often as you like;
  thresholds come from it. **`holdout.jsonl`** (≥ 12) is written at the same
  time, by the same method, and run **once**, after the thresholds are fixed.
- At least 5 cases labelled above the lowest rank in each file. The
  calibrator refuses otherwise: zero misses of a risk it was never shown
  proves nothing.
- **These are floors for running the calibrator, not proof.** The kit's own
  guidance is that 50–100 labelled examples "can reveal obvious problems, but
  is not enough to establish reliability for rare or high-impact failures",
  and that out-of-domain probabilities are usable but not calibrated (ECE
  about 0.1). Twenty cases admit a gate to *shadow*; the evidence that lets
  it act is the shadow log growing on real traffic — and the reason no gate
  action is ever irreversible is that no sample this size rules out the rare
  miss.

## Labels from the project's own history

Hand-written cases get a gate started; they are in the author's voice and
flatter the gate. Replace them with history as soon as there is any.

**Review depth (`merge-risk`)** — a change that needed a second look is one
that was reverted or patched soon after:

```bash
# reverted commits → want: deep-review
git log --grep='^Revert "' --format='%H %s'
# commits followed within 3 days by a fix touching the same files
git log --since=90.days --format='%H %ct %s' --name-only
# everything else older than 30 days with no follow-up → want: light-review
```

Build each `state` the way the driver will:

```bash
git show --stat=100 --format='%s' <sha> | head -12
```

**Wake gate** — a tick whose session ended with no commit, no queue change
and no message was a tick that did not need to wake. Label from the loop's
own status log and `git log` around each tick's timestamp.

**Failure triage** — a red CI run whose re-run went green with no commit in
between was flaky; one fixed by a commit was real; one fixed by a change
under `.github/` or the runner was infra.

**Queue fast-path** — an item that was rewritten before it was built needed
triage; one built as written did not. `git log -p -- <backlog file>` shows
the rewrites.

Where history cannot label (a new project), label by hand, mark the
calibration block `"labels": "hand-written"`, and keep the gate in shadow
until the shadow report has real outcomes.

## Reading the report

```bash
node scripts/kev.mjs calibrate gates/merge-risk.json fixtures/merge-risk/tune.jsonl
```

| field | meaning |
|---|---|
| `missed` | gate chose a **lower** rank than the label — the defect; admission needs zero |
| `over` | gate chose a **higher** rank — the price |
| `misroute` | same rank, wrong lane |
| `over_rate` | `over` ÷ cases that could have stayed below the top rank; above `--max-over` (0.5) the gate is refused as saving too little |
| `risky` | cases labelled above the lowest rank; below `--min-risky` (5) refuses |
| `unusable` | cases where KEV gave no usable answer; any refuses — fix the endpoint first |
| `sweep` | the same facts re-decided with every threshold moved by −0.2 … +0.2; no new model calls |
| `latency_ms` | median and max as reported by the server |

Each `missed` / `over` row carries its facts — read them before moving a
threshold. A miss with the deciding fact at 0.02 is a question the model
cannot answer, not a threshold in the wrong place; redesign the question.

**The sweep is the fragility reading.** `merge-risk` on its holdout:

```text
shift  -0.2  -0.1   0   +0.1  +0.2
missed   0     0    0    0     2
over     5     2    0    0     0
```

One step either way still admits. A gate whose misses start at +0.1 is
admitted and one model update from refused — record that.

## Setting thresholds

From the tune report only. For a risk screen, find the lowest-scoring risky
case and the highest-scoring safe case; if they do not separate, change the
formulation, not the threshold. If they do, cut at the midpoint and write
the two numbers into `calibration.threshold_from`. Giving up a correct
low-rank case for margin (the `0.65` in the queue-triage example) is a fair
trade; giving up margin for a better tune score is how a gate fails its
holdout.

## Shadow and promotion

`calibrate` answers "does the gate work on cases I wrote down". `shadow`
answers "does it work on what the loop actually sees".

1. The driver calls `ask --log <file>` on every real decision. In shadow
   mode the result has `"enforce": false`; the driver ignores `action` and
   lets the usual tier decide.
2. When the real decision is known — the review found something or did not,
   the tick did work or did not — record it:
   `kev.mjs outcome <log> <id> <actual-action>`.
3. `kev.mjs shadow <gate.json> <log>` joins the two under the same bar.
   `promote` needs ≥ 20 joined outcomes, ≥ 5 above the lowest rank, zero
   misses, over-rate ≤ 0.5.

Only the owner flips `mode` to `enforce`. Keep `--log` on afterwards and
keep recording outcomes for a sample: the shadow report is also the drift
alarm.

## When a calibration expires

Re-run both files, and treat the gate as `shadow` until they pass, when:

- the model behind the endpoint changes (`GET /v1/models`, `GET /api/info`);
- a question, rule, threshold or option description changes — bump `version`;
- the driver changes what it puts in `state`;
- the loop changes how it writes what it puts there (a new commit-subject
  convention is a new input distribution);
- the shadow report shows a miss.

## The record (kev-0.5b on CPU, 2026-09-20)

| gate | file | n | correct | missed | over | misroute | verdict |
|---|---|---|---|---|---|---|---|
| merge-risk | tune | 20 | 20 | 0 | 0 | 0 | admit |
| merge-risk | holdout | 12 | 12 | 0 | 0 | 0 | admit |
| queue-triage | tune | 20 | 18 | 0 | 2 | 0 | admit |
| queue-triage | holdout | 12 | 7 | 1 | 4 | 0 | **refuse** |

All four files are hand-written one-line summaries by the gate's author.
`merge-risk` ships in shadow for that reason. On this repository's last ten
commits (subject + stat, unlabelled) it chose light review nine times; none
of the ten touched data, auth, money or an interface.
