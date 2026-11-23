#!/usr/bin/env node
// automate-me: what the local decision log says about the user.
//
// Reads the JSONL decision log (schema in ../references/decision-log.md) and
// reports, per decision kind, whether it may be proposed as "settle and report
// afterwards", and which correction kinds have recurred enough to become a
// proposed rule. Counting is done here so it is not done by eye.
//
// A kind is scored on automate-me's own prediction against the user's answer,
// never on the agent's recommendation: the prediction is what a settled kind
// would act on.
//
// Usage: node decisions.mjs [log] [--reserve kindA,kindB] [--unreserve kindC]
//        node decisions.mjs --self-test
//
// Read-only. The default log is ~/.claude/decision-log.jsonl; a missing log is
// not an error.

import { readFileSync, existsSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const GRADUATE_AFTER = 20;      // independent predictions a kind needs
const GRADUATE_ACCURACY = 0.95; // share of them that matched the answer
const WINDOW = 10;              // no reversal among a kind's last N decisions
const RULE_AFTER = 2;           // a correction kind seen this often becomes a proposed rule
const CORRECTION_KINDS = ["noise", "unproven", "obsolete", "false-alarm", "incomplete", "inaction"];
// Kinds that never graduate. --reserve adds to this list, --unreserve takes a kind off it.
export const DEFAULT_RESERVE = ["land-shared-branch", "money-rule", "contract-wording", "protected-file", "irreversible"];

const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
// A prediction counts when it was recorded and the user answered the decision themselves.
const scored = (r) => r.mode === "asked" && r.prediction != null && r.answer != null;
// A reversal: a settled decision the user overturned, or an asked one the prediction missed.
const reversed = (r) => (r.mode === "settled" && r.outcome === "changed") || (scored(r) && !same(r.prediction, r.answer));

export function analyse(text, { reserve = DEFAULT_RESERVE } = {}) {
  const decisions = new Map();
  const corrections = new Map();
  let malformed = 0, unknownCorrections = 0;
  const addCorrection = (c, ts) => {
    if (!c || !CORRECTION_KINDS.includes(c.kind)) { unknownCorrections++; return; }
    const row = corrections.get(c.kind) ?? { count: 0, notes: [] };
    row.count++;
    if (c.note) row.notes.push(`${ts ?? "?"}: ${c.note}`);
    corrections.set(c.kind, row);
  };
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let r;
    try { r = JSON.parse(line); } catch { malformed++; continue; }
    if (r.type === "correction") { addCorrection(r, r.ts); continue; }
    if (r.type !== "decision" || !r.kind) { malformed++; continue; }
    if (!decisions.has(r.kind)) decisions.set(r.kind, []);
    decisions.get(r.kind).push(r);
    for (const c of r.corrections ?? []) addCorrection(c, r.ts);
  }
  const kinds = [...decisions].map(([kind, rows]) => {
    const predicted = rows.filter(scored);
    const correct = predicted.filter((r) => same(r.prediction, r.answer)).length;
    const accuracy = predicted.length ? Math.round((correct / predicted.length) * 1000) / 1000 : null;
    const recommended = rows.filter((r) => r.mode === "asked" && r.recommendation != null && r.answer != null);
    const reversal = rows.slice(-WINDOW).reverse().find(reversed);
    const status = reserve.includes(kind) ? "reserved"
      : reversal ? "ask"
      : predicted.length >= GRADUATE_AFTER && accuracy >= GRADUATE_ACCURACY ? "may-settle"
      : "ask";
    const why = status === "reserved" ? "the user reserves this kind; it never moves"
      : reversal ? `reversal on ${reversal.ts ?? "?"}, inside the last ${WINDOW}`
      : predicted.length < GRADUATE_AFTER ? `${predicted.length} predictions; needs ${GRADUATE_AFTER}`
      : status === "may-settle" ? `${correct}/${predicted.length} predictions right, no reversal in the last ${WINDOW}`
      : `${correct}/${predicted.length} predictions right; needs ${GRADUATE_ACCURACY * 100} %`;
    return {
      kind, total: rows.length, predictions: predicted.length, correct, accuracy,
      recommendation_correct: recommended.filter((r) => same(r.recommendation, r.answer)).length,
      recommendations: recommended.length, reversal: reversal?.ts ?? null, status, why,
    };
  });
  const rules = [...corrections].map(([kind, r]) => ({ kind, count: r.count, propose: r.count >= RULE_AFTER, notes: r.notes }));
  return { kinds, corrections: rules, malformed, unknownCorrections };
}

function selfTest() {
  const text = readFileSync(join(HERE, "..", "fixtures", "decision-log.jsonl"), "utf8");
  const got = analyse(text, { reserve: reserveList(["release"], []) });
  const kind = (k) => got.kinds.find((x) => x.kind === k);
  const corr = (k) => got.corrections.find((x) => x.kind === k)?.propose;
  const unreserved = analyse(text, { reserve: reserveList([], ["money-rule"]) });
  const checks = [
    ["20 predictions, all right → may-settle", kind("dependency-bump").status === "may-settle"],
    ["scored on prediction, not recommendation", kind("dependency-bump").recommendation_correct === 18 && kind("dependency-bump").correct === 20],
    ["19/20 right, the miss outside the last 10 → may-settle at exactly 95 %", kind("naming").status === "may-settle"],
    ["19/20 right, the miss inside the last 10 → ask", kind("schema-change").status === "ask" && kind("schema-change").reversal !== null],
    ["18/20 right → ask", kind("formatting").status === "ask" && kind("formatting").accuracy === 0.9],
    ["19 predictions → ask, needs 20", kind("refactor").status === "ask"],
    ["a settled decision reversed → ask", kind("cleanup").status === "ask"],
    ["no predictions (backfilled) → nothing scored, ask", kind("copy-edit").predictions === 0 && kind("copy-edit").status === "ask"],
    ["--reserve adds a kind", kind("release").status === "reserved"],
    ["default reserve holds money-rule", kind("money-rule").status === "reserved"],
    ["--unreserve takes a default kind off", unreserved.kinds.find((x) => x.kind === "money-rule").status === "may-settle"],
    ["noise twice → proposed rule", corr("noise") === true],
    ["unproven once → not yet", corr("unproven") === false],
    ["standalone correction counted", got.corrections.find((x) => x.kind === "false-alarm")?.count === 2],
    ["malformed line counted", got.malformed === 1],
    ["unknown correction kind counted", got.unknownCorrections === 1],
  ];
  for (const [name, ok] of checks) console.log(`${ok ? "✓" : "✗"} ${name}`);
  const failed = checks.filter(([, ok]) => !ok).length;
  console.log(`\n${checks.length - failed}/${checks.length} assertions passed`);
  process.exit(failed ? 1 : 0);
}

export function reserveList(add, remove) {
  return [...new Set([...DEFAULT_RESERVE, ...add])].filter((k) => !remove.includes(k));
}

const isMain = process.argv[1] && (() => {
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); }
  catch { return false; }
})();
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) selfTest();
  else {
    const list = (flag) => { const i = args.indexOf(flag); return i >= 0 ? (args[i + 1] ?? "").split(",").filter(Boolean) : []; };
    const reserve = reserveList(list("--reserve"), list("--unreserve"));
    const log = args.find((a, j) => !a.startsWith("--") && !["--reserve", "--unreserve"].includes(args[j - 1])) ?? join(homedir(), ".claude", "decision-log.jsonl");
    if (!existsSync(log)) { process.stdout.write(JSON.stringify({ log: "missing", reserve, kinds: [], corrections: [] }, null, 2) + "\n"); process.exit(0); }
    process.stdout.write(JSON.stringify({ reserve, ...analyse(readFileSync(log, "utf8"), { reserve }) }, null, 2) + "\n");
  }
}
