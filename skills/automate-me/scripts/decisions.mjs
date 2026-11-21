#!/usr/bin/env node
// automate-me: what the local decision log says about the user.
//
// Reads the JSONL decision log (schema in ../references/decision-log.md) and
// reports, per decision kind, whether it may be proposed as "settle and report
// afterwards", and which correction kinds have recurred enough to become a
// proposed rule. Counting is done here so it is not done by eye.
//
// Usage: node decisions.mjs [log] [--reserve kindA,kindB]
//        node decisions.mjs --self-test
//
// Read-only. The default log is ~/.claude/decision-log.jsonl; a missing log is
// not an error.

import { readFileSync, existsSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WINDOW = 10;          // last N decisions of a kind
const SETTLE_AFTER = 5;     // accepted at least this often inside the window, no change
const RULE_AFTER = 2;       // a correction kind seen this often becomes a proposed rule
const CORRECTION_KINDS = ["noise", "unproven", "obsolete", "false-alarm", "incomplete", "inaction"];

export function analyse(text, { reserve = [] } = {}) {
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
    const last = rows.slice(-WINDOW);
    const accepted = last.filter((r) => r.outcome === "accepted").length;
    const change = [...last].reverse().find((r) => r.outcome === "changed");
    const status = reserve.includes(kind) ? "reserved"
      : change ? "ask"
      : accepted >= SETTLE_AFTER ? "may-settle"
      : "ask";
    const why = status === "reserved" ? "the user reserves this kind; it never moves"
      : change ? `changed on ${change.ts ?? "?"} — inside the last ${last.length}`
      : status === "may-settle" ? `${accepted} accepted in the last ${last.length}, none changed`
      : `${accepted} accepted in the last ${last.length}; needs ${SETTLE_AFTER}`;
    return { kind, total: rows.length, window: last.length, accepted, status, why };
  });
  const rules = [...corrections].map(([kind, r]) => ({ kind, count: r.count, propose: r.count >= RULE_AFTER, notes: r.notes }));
  return { kinds, corrections: rules, malformed, unknownCorrections };
}

function selfTest() {
  const text = readFileSync(join(HERE, "..", "fixtures", "decision-log.jsonl"), "utf8");
  const got = analyse(text, { reserve: ["release"] });
  const kind = (k) => got.kinds.find((x) => x.kind === k)?.status;
  const corr = (k) => got.corrections.find((x) => x.kind === k)?.propose;
  const checks = [
    ["six accepted, none changed → may-settle", kind("dependency-bump") === "may-settle"],
    ["one change in the window → ask", kind("schema-change") === "ask"],
    ["reserved never moves", kind("release") === "reserved"],
    ["four accepted → still ask", kind("naming") === "ask"],
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

const isMain = process.argv[1] && (() => {
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); }
  catch { return false; }
})();
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) selfTest();
  else {
    const i = args.indexOf("--reserve");
    const reserve = i >= 0 ? (args[i + 1] ?? "").split(",").filter(Boolean) : [];
    const log = args.find((a, j) => !a.startsWith("--") && args[j - 1] !== "--reserve") ?? join(homedir(), ".claude", "decision-log.jsonl");
    if (!existsSync(log)) { process.stdout.write(JSON.stringify({ log: "missing", kinds: [], corrections: [] }, null, 2) + "\n"); process.exit(0); }
    process.stdout.write(JSON.stringify(analyse(readFileSync(log, "utf8"), { reserve }), null, 2) + "\n");
  }
}
