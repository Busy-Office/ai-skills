#!/usr/bin/env node
// automate-me: what the local decision log says about the user.
//
// Reads the JSONL decision log (schema and thresholds in
// ../references/decision-log.md) and reports, per decision kind, whether it may
// be proposed as "settle and report afterwards", and which correction kinds
// have recurred enough to become a proposed rule. Counting is done here so it
// is not done by eye.
//
// A kind is scored on the prediction line written before the decision was put
// to the user, never on the agent's recommendation: the prediction is what a
// settled kind would act on. A prediction written on the decision line itself,
// or after it, is not scored.
//
// Usage: node decisions.mjs [log] [--reserve kindA,kindB | --reserve=kindA,kindB]
//        node decisions.mjs --self-test
//
// Read-only. The default log is ~/.claude/decision-log.jsonl; a missing log is
// not an error.

import { readFileSync, existsSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const GRADUATE_AFTER = 20;   // scored predictions a kind needs
const GRADUATE_PERCENT = 95; // share of them that matched the answer, compared without rounding
const WINDOW = 10;           // no reversal among a kind's last N scored or settled decisions, by ts
const RULE_AFTER = 2;        // a correction kind seen this often becomes a proposed rule
const CORRECTION_KINDS = ["noise", "unproven", "obsolete", "false-alarm", "incomplete", "inaction"];
// Kinds that never graduate. --reserve adds to this list; nothing takes a kind off it.
export const DEFAULT_RESERVE = ["land-shared-branch", "money-rule", "contract-wording", "protected-file", "irreversible"];

const norm = (k) => String(k).trim().toLowerCase().replace(/\s+/g, " ");
const label = (a) => norm(String(a).replace(/\(recommended\)\s*$/i, ""));
const same = (a, b) => label(a) === label(b);
const isObject = (r) => r !== null && typeof r === "object" && !Array.isArray(r);

export function analyse(text, { reserve = DEFAULT_RESERVE } = {}) {
  const reserved = new Set(reserve.map(norm));
  const predictions = new Map(); // id → prediction line, as seen so far
  const decisions = new Map();
  const corrections = new Map();
  let malformed = 0, unknownCorrections = 0;
  const addCorrection = (c, ts) => {
    if (!isObject(c) || !CORRECTION_KINDS.includes(c.kind)) { unknownCorrections++; return; }
    const row = corrections.get(c.kind) ?? { count: 0, notes: [] };
    row.count++;
    if (c.note) row.notes.push(`${ts ?? "?"}: ${c.note}`);
    corrections.set(c.kind, row);
  };
  text.split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    let r;
    try { r = JSON.parse(line); } catch { malformed++; return; }
    if (!isObject(r)) { malformed++; return; }
    if (r.type === "correction") { addCorrection(r, r.ts); return; }
    if (r.type === "prediction" && r.id != null) { predictions.set(r.id, r); return; }
    if (r.type !== "decision" || !r.kind) { malformed++; return; }
    const kind = norm(r.kind);
    if (!decisions.has(kind)) decisions.set(kind, []);
    // only a prediction line that appeared earlier in the file counts
    decisions.get(kind).push({ r, i, p: r.prediction_id != null ? predictions.get(r.prediction_id)?.prediction ?? null : null });
    for (const c of Array.isArray(r.corrections) ? r.corrections : []) addCorrection(c, r.ts);
  });
  const kinds = [...decisions].map(([kind, rows]) => {
    const scored = rows.filter(({ r, p }) => r.mode === "asked" && p != null && r.answer != null);
    const settled = rows.filter(({ r }) => r.mode === "settled");
    const overturned = settled.filter(({ r }) => r.outcome === "changed");
    const hit = ({ r, p }) => same(p, r.answer);
    const correct = scored.filter(hit).length;
    const n = scored.length + overturned.length;   // an overturned settlement is a miss
    const window = [...scored, ...settled]
      .sort((a, b) => String(a.r.ts ?? "").localeCompare(String(b.r.ts ?? "")) || a.i - b.i)
      .slice(-WINDOW);
    const reversal = [...window].reverse().find((x) => (x.r.mode === "settled" ? x.r.outcome === "changed" : !hit(x)));
    const status = reserved.has(kind) ? "reserved"
      : reversal ? "ask"
      : n >= GRADUATE_AFTER && correct * 100 >= GRADUATE_PERCENT * n ? "may-settle"
      : "ask";
    const why = status === "reserved" ? "reserved; it never moves"
      : reversal ? `reversal on ${reversal.r.ts ?? "?"}, inside the last ${WINDOW}`
      : n < GRADUATE_AFTER ? `${n} scored predictions; needs ${GRADUATE_AFTER}`
      : status === "may-settle" ? `${correct}/${n} predictions right, no reversal in the last ${WINDOW}`
      : `${correct}/${n} predictions right; needs ${GRADUATE_PERCENT} %`;
    // tripwire: does the prediction know anything the recommendation did not?
    const withRec = scored.filter(({ r }) => r.recommendation != null);
    const differ = withRec.filter(({ r, p }) => !same(p, r.recommendation));
    const correctWhereDifferent = differ.filter(hit).length;
    const tripwire = !withRec.length ? null
      : differ.length === 0 ? "every prediction equalled the recommendation: nothing beyond the recommendation is shown yet"
      : `${correctWhereDifferent}/${differ.length} right where the prediction differed from the recommendation`;
    const recommended = rows.filter(({ r }) => r.mode === "asked" && r.recommendation != null && r.answer != null);
    return {
      kind, total: rows.length, predictions: n, correct, accuracy: n ? Math.round((correct / n) * 1000) / 1000 : null,
      recommendation_correct: recommended.filter(({ r }) => same(r.recommendation, r.answer)).length,
      recommendations: recommended.length,
      same_as_recommendation: withRec.length ? Math.round(((withRec.length - differ.length) / withRec.length) * 100) / 100 : null,
      differ: differ.length, correct_where_different: correctWhereDifferent, tripwire,
      reversal: reversal?.r.ts ?? null, status, why,
    };
  });
  const rules = [...corrections].map(([kind, r]) => ({ kind, count: r.count, propose: r.count >= RULE_AFTER, notes: r.notes }));
  return { kinds, corrections: rules, malformed, unknownCorrections };
}

// A synthetic log for the edge cases: one prediction line before each decision.
function synth(rows) {
  return rows.map((o, i) => {
    const { pts, ...r } = o;
    const id = `s${i}`;
    const p = { type: "prediction", id, kind: r.kind ?? "k", question: "q", prediction: r.prediction ?? "yes", prediction_confidence: 0.9, ts: pts ?? r.ts ?? "t" };
    const d = { ts: "t", type: "decision", kind: "k", mode: "asked", recommendation: "yes", answer: "yes", outcome: "accepted", ...r, prediction_id: id };
    delete d.prediction;
    return (d.mode === "asked" ? JSON.stringify(p) + "\n" : "") + JSON.stringify(d);
  }).join("\n");
}
const rep = (k, f) => Array.from({ length: k }, (_, i) => f(i));

function selfTest() {
  const text = readFileSync(join(HERE, "..", "fixtures", "decision-log.jsonl"), "utf8");
  const got = analyse(text, { reserve: reserveList(["release"]) });
  const kind = (k, g = got) => g.kinds.find((x) => x.kind === k);
  const corr = (k) => got.corrections.find((x) => x.kind === k)?.propose;
  const status = (rows, opts) => kind("k", analyse(synth(rows), opts));
  const cli = (...a) => spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...a], { encoding: "utf8" });
  const fixture = join(HERE, "..", "fixtures", "decision-log.jsonl");
  const checks = [
    // the protocol
    ["20 predictions, all right → may-settle", kind("dependency-bump").status === "may-settle"],
    ["scored on prediction, not recommendation", kind("dependency-bump").recommendation_correct === 18 && kind("dependency-bump").correct === 20],
    ["inline prediction on the decision line → unscored", kind("inline-kind").predictions === 0 && kind("inline-kind").status === "ask"],
    ["prediction line written after the decision → unscored", kind("late-kind").predictions === 0],
    ["no prediction line (backfilled) → unscored", kind("copy-edit").predictions === 0 && kind("copy-edit").status === "ask"],
    // the thresholds
    ["19/20, the miss outside the last 10 → may-settle at exactly 95 %", kind("naming").status === "may-settle"],
    ["19/20, the miss inside the last 10 → ask", kind("schema-change").status === "ask" && kind("schema-change").reversal !== null],
    ["18/20 → ask", kind("formatting").status === "ask"],
    ["19 predictions → ask, needs 20", kind("refactor").status === "ask"],
    ["189/199 (94.97 %) is under 95 %, no rounding", status([...rep(10, () => ({ answer: "no" })), ...rep(189, () => ({}))]).status === "ask"],
    // the window
    ["a settled decision reversed → ask, counted as a miss", kind("cleanup").status === "ask" && kind("cleanup").predictions === 21 && kind("cleanup").correct === 20],
    ["settled reversal outside the window still counts in the denominator", (() => { const k = status([...rep(20, () => ({})), { mode: "settled", outcome: "changed", answer: "no" }, ...rep(10, () => ({}))]); return k.predictions === 31 && k.correct === 30 && k.status === "may-settle"; })()],
    ["unscored rows do not push a miss out of the window", (() => { const t = synth([...rep(29, () => ({})), { answer: "no" }]) + "\n" + rep(10, () => JSON.stringify({ ts: "t", type: "decision", kind: "k", mode: "asked", recommendation: "yes", answer: "yes", outcome: "accepted" })).join("\n"); return kind("k", analyse(t)).status === "ask"; })()],
    ["window ordered by ts, not by line", status([...rep(29, (i) => ({ ts: `2026-11-${String(i + 1).padStart(2, "0")}` })), { answer: "no", ts: "2026-11-30" }, ...rep(10, () => ({ ts: "2026-01-01" }))]).status === "ask"],
    ["a (Recommended) suffix on the answer still matches", status(rep(20, () => ({ answer: "Yes (Recommended)" }))).correct === 20],
    // the tripwire
    ["tripwire: share equal to the recommendation, accuracy where they differ", kind("dependency-bump").same_as_recommendation === 0.9 && kind("dependency-bump").differ === 2 && kind("dependency-bump").correct_where_different === 2],
    ["tripwire: says so when the prediction never differed", /nothing beyond the recommendation/.test(kind("naming").tripwire ?? "") === false && /nothing beyond the recommendation/.test(status(rep(20, () => ({}))).tripwire ?? "")],
    // reserve
    ["--reserve adds a kind", kind("release").status === "reserved"],
    ["default reserve matches money-rule written in another case", kind("money-rule").status === "reserved"],
    // input
    ["noise twice → proposed rule", corr("noise") === true],
    ["unproven once → not yet", corr("unproven") === false],
    ["standalone correction counted", got.corrections.find((x) => x.kind === "false-alarm")?.count === 2],
    ["malformed and non-object lines counted, no crash", got.malformed === 2],
    ["unknown correction kind counted", got.unknownCorrections === 1],
    // the command line
    ["--reserve=x form accepted", JSON.parse(cli(fixture, "--reserve=dependency-bump").stdout).kinds.find((x) => x.kind === "dependency-bump").status === "reserved"],
    ["unknown flag → exit 2", cli(fixture, "--unreserve", "money-rule").status === 2],
  ];
  for (const [name, ok] of checks) console.log(`${ok ? "✓" : "✗"} ${name}`);
  const failed = checks.filter(([, ok]) => !ok).length;
  console.log(`\n${checks.length - failed}/${checks.length} assertions passed`);
  process.exit(failed ? 1 : 0);
}

export function reserveList(add = []) {
  return [...new Set([...DEFAULT_RESERVE, ...add.map(norm)])];
}

const isMain = process.argv[1] && (() => {
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); }
  catch { return false; }
})();
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) selfTest();
  else {
    const add = [];
    let log = null;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "--reserve") add.push(...(args[++i] ?? "").split(",").filter(Boolean));
      else if (a.startsWith("--reserve=")) add.push(...a.slice(10).split(",").filter(Boolean));
      else if (a.startsWith("-")) { console.error(`unknown flag ${a}\nusage: node decisions.mjs [log] [--reserve kindA,kindB]`); process.exit(2); }
      else log = a;
    }
    const reserve = reserveList(add);
    log ??= join(homedir(), ".claude", "decision-log.jsonl");
    if (!existsSync(log)) { process.stdout.write(JSON.stringify({ log: "missing", reserve, kinds: [], corrections: [] }, null, 2) + "\n"); process.exit(0); }
    process.stdout.write(JSON.stringify({ reserve, ...analyse(readFileSync(log, "utf8"), { reserve }) }, null, 2) + "\n");
  }
}
