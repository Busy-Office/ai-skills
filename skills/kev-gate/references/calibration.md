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
- **A spent holdout teaches nothing but its counts.** When a holdout
  refuses, take the verdict and the counts back to design — not the cases.
  Rewording a question around the holdout items it got wrong is tuning on
  the holdout by another route. Redesign from the tune set, then write a
  fresh holdout.
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
that was reverted or patched soon after. `scripts/harvest.mjs` writes the
cases, read-only, with the state built the way a driver builds it (subject +
`--stat`, ≤ 1500 characters):

```bash
node scripts/harvest.mjs <repo> --since 240.days --max 80 \
  --exclude '^(chore\(loops\)|Record|Roadmap|docs)' > all.jsonl
```

`deep-review` = reverted, or the **most recent** earlier commit to touch a
code file that a fix-like commit then touched within `--window-days`;
`light-review` = neither, and older than `--settle-days`. Hub files (touched
by more than 10% of commits) and prose files are ignored when matching, and
every line's `note` names the commit that blamed it. Split it yourself —
alternate lines, or older/newer — into tune and holdout *before* looking.

**Run `--fit` first, and prefer a recorded outcome to the proxy.**

```bash
node scripts/harvest.mjs <repo> --fit
node scripts/harvest.mjs <repo> --labels outcomes.jsonl --fit
node scripts/harvest.mjs <repo> --labels outcomes.jsonl > all.jsonl
```

`outcomes.jsonl` is whatever the project already records about how a review
turned out, one row per commit: `{"sha": "…", "want": "<action>", "why": "…"}`.
`--lowest <action>` names the rank-0 action if it is not `light-review`. On
busy-office-ui the proxy scored a path-prior AUC of 0.58 at a 14% base rate,
flat across areas (11–17% in every area with 80 or more commits): the label
carried no cheap signal, and the two gates designed on it were refused. A
label no file path predicts is not necessarily wrong — but it is the first
thing to doubt, before the question and long before the threshold.

**Read a sample before trusting the label.** The first version of this rule
("any fix-like commit touching the same file within a week") labelled 57% of
a real repo deep, off one fix to one governance file that every slice
touched. Blame-the-last-toucher on code files brought it to 14%. And the
label is a proxy: in a try → verify → adjust loop a fix the next day can be
the normal rhythm rather than something a deeper review would have caught.

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

Each `missed` / `over` row carries its facts — on the **tune** report, read
them before moving a threshold. On the holdout report read the counts and
the sweep only (see "A spent holdout" above). A miss with the deciding fact at 0.02 is a question the model
cannot answer, not a threshold in the wrong place; redesign the question.

**The sweep is the fragility reading.** `merge-risk` on its holdout:

```text
shift  -0.2  -0.1   0   +0.1  +0.2
missed   0     0    0    0     2
over     5     2    0    0     0
```

One step either way still admits. A gate whose first miss is one step away
— in whichever direction its rules break — is admitted and one model update
from refused; record that, with the direction.

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
`merge-risk` ships in shadow for that reason.

**On real history it did not transfer.** busy-office-ui (a CSS-first UI
library, 2,117 commits, an active loop), 80 harvested cases, 40 of them
blamed by a later fix:

| gate | file | n | correct | missed | over | verdict |
|---|---|---|---|---|---|---|
| merge-risk, as shipped | 80 harvested | 80 | 42 | **35** | 3 | **refuse** |
| scope score (repo-fitted, tune AUC 0.77) | tune half | 40 | 20 | 1 | 19 | **refuse** — holdout left unspent |
| merge-risk, as shipped | busy-office-erp, 25 harvested (12 blamed) | 25 | 12 | **12** | 1 | **refuse** |

The shipped gate answered its own question correctly — almost nothing in a
UI library touches data, auth or money, and the missed cases' top areas were
`additive` and `refactor` — but that fact does not predict which changes
there needed a follow-up. A repo-fitted question did rank the cases (scope
AUC 0.77 against 0.62 for a plain file count), yet no threshold reached zero
misses without escalating 19 of 20 quiet changes. Two design rounds, no
admitted gate: review depth in that repo stays with the model. A second repo
(busy-office-erp, still at its stack-decision stage) gave the same picture
on a single run: every one of the 12 blamed changes was a loop script, a
benchmark or a doc, and every one was called light. The risk
areas in `merge-risk` are an example for a service with data and money, not
a default. On this repository's last ten
commits (subject + stat, unlabelled) it chose light review nine times; none
of the ten touched data, auth, money or an interface.
