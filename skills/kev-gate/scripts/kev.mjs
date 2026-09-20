#!/usr/bin/env node
// kev-gate: put a small typed-judgement model (KEV / TypeSafe Jev) in front
// of a loop's decisions. The model returns probabilities for narrow facts;
// the rules that turn facts into an action are code, in the gate file.
//
// Usage: node kev.mjs ask <gate.json> --state <file|-> [--log <file.jsonl>] [--shadow]
//        node kev.mjs lint <gate.json>
//        node kev.mjs calibrate <gate.json> <cases.jsonl> [--min-cases 20] [--min-risky 5] [--max-over 0.5]
//        node kev.mjs outcome <log.jsonl> <id> <actual-action>
//        node kev.mjs shadow <gate.json> <log.jsonl> [--min-cases 20] [--min-risky 5]
//        node kev.mjs --self-test
//
// Env:   KEV_URL (default http://localhost:8008), KEV_API_KEY, KEV_MODEL,
//        KEV_TIMEOUT_MS (default 5000). The path and auth header match the
//        hosted TypeSafe API, so KEV_URL=https://api.typesafe.ai works too.
//
// `ask` never fails closed and never throws at the caller: if the model is
// unreachable, slow, or answers in a shape the gate did not expect, the
// result is the gate's `unreachable` action — the loop behaves as it did
// before the gate existed. The log holds a hash of the state, not the state.

import { readFileSync, appendFileSync, realpathSync, mkdtempSync, symlinkSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEFAULT_URL = "http://localhost:8008";
const DEFAULT_MAX_STATE = 6000;
const FALLBACK_OPTION = /^(no_?match|no_?issue|none|other|unsure|unknown)$/i;
// Words that ask the model for a verdict instead of a fact it can read.
const VERDICT_WORDS = /\b(safe|should|ok(?:ay)? to|ready|good enough|approve|acceptable|trust(?:ed|worthy)?)\b/i;

// ------------------------------------------------------------------ rules --
// A condition is {fact, gte} | {fact, lt} | {fact, between:[lo,hi]} |
// {sum:[facts…], gte|lt} | {any:[…]} | {all:[…]} | {not: cond}. `sum` exists
// because a small model's top choice is often wrong while the probability
// mass across a group of options still ranks cases well. A missing fact
// makes the condition throw, which `ask` turns into the unreachable action.
export function holds(cond, facts) {
  if (cond.any) return cond.any.some((c) => holds(c, facts));
  if (cond.all) return cond.all.every((c) => holds(c, facts));
  if (cond.not) return !holds(cond.not, facts);
  const one = (f) => { const x = facts[f]; if (typeof x !== "number" || Number.isNaN(x)) throw new Error("fact missing: " + f); return x; };
  const v = cond.sum ? cond.sum.reduce((t, f) => t + one(f), 0) : one(cond.fact);
  if (cond.gte !== undefined) return v >= cond.gte;
  if (cond.lt !== undefined) return v < cond.lt;
  if (cond.between) return v >= cond.between[0] && v <= cond.between[1];
  throw new Error("condition has no comparator: " + JSON.stringify(cond));
}

function describe(cond) {
  if (cond.any) return "any(" + cond.any.map(describe).join(", ") + ")";
  if (cond.all) return "all(" + cond.all.map(describe).join(", ") + ")";
  if (cond.not) return "not(" + describe(cond.not) + ")";
  const what = cond.sum ? "sum(" + cond.sum.join("+") + ")" : cond.fact;
  if (cond.gte !== undefined) return what + ">=" + cond.gte;
  if (cond.lt !== undefined) return what + "<" + cond.lt;
  return what + " in [" + cond.between.join(",") + "]";
}

// First matching rule wins; no match is the default. `shift` moves every
// threshold by a constant — used only by the calibration sweep.
export function decide(gate, facts, shift = 0) {
  const rules = shift === 0 ? gate.rules : shiftRules(gate.rules, shift);
  for (let i = 0; i < rules.length; i++) {
    if (holds(rules[i].if, facts)) return { action: rules[i].then, reason: "rule " + (i + 1) + ": " + describe(gate.rules[i].if) };
  }
  return { action: gate.default, reason: "default: no rule fired" };
}

function shiftRules(rules, d) {
  const mv = (c) => c.any ? { any: c.any.map(mv) } : c.all ? { all: c.all.map(mv) } : c.not ? { not: mv(c.not) }
    : c.gte !== undefined ? { ...c, gte: c.gte + d } : c.lt !== undefined ? { ...c, lt: c.lt + d }
    : { ...c, between: [c.between[0] + d, c.between[1] + d] };
  return rules.map((r) => ({ ...r, if: mv(r.if) }));
}

function factsIn(cond, out = new Set()) {
  if (cond.any || cond.all) (cond.any || cond.all).forEach((c) => factsIn(c, out));
  else if (cond.not) factsIn(cond.not, out);
  else if (cond.sum) cond.sum.forEach((f) => out.add(f));
  else if (cond.fact) out.add(cond.fact);
  return out;
}

const rank = (gate, action) => gate.actions?.[action]?.rank;

// ------------------------------------------------------------------- lint --
// Rows carry the K ids described in references/gate-design.md.
export function lint(gate) {
  const rows = [];
  const row = (id, level, where, msg) => rows.push({ id, level, where, msg });
  const questions = gate.questions || {};
  const actions = gate.actions || {};

  for (const [name, q] of Object.entries(questions)) {
    const ins = q.instructions;
    const text = typeof ins === "string" ? ins : ins?.question || "";
    if (q.type === "choice" && !q.exhaustive && !Object.keys(q.criteria || {}).some((k) => FALLBACK_OPTION.test(k)))
      row("K1", "error", name, "choice with no way out: add a fallback option (noMatch / none / other), or declare \"exhaustive\": true if the options cover every case");
    if (typeof ins === "string" || !ins?.question || !(ins.inspect || ins.compare))
      row("K2", "error", name, "bare instruction: give it {question, inspect|compare, focus, ignore} so it knows where to look");
    if (q.type === "noul" && !(q.criteria?.true?.what && q.criteria?.false?.what))
      row("K3", "error", name, "noul without criteria.true.what and criteria.false.what: the boundary is undefined");
    if (VERDICT_WORDS.test(text))
      row("K4", "error", name, "asks for a verdict (\"" + text.match(VERDICT_WORDS)[0] + "\"), not a fact the state supports; screen for the risk instead");
  }

  for (const [name, a] of Object.entries(actions)) {
    if (typeof a.rank !== "number") row("K5", "error", name, "action has no numeric rank: calibration cannot tell a miss from an over-escalation");
    if (a.reversible !== true)
      row("K5", "error", name, a.reversible === false
        ? "irreversible action behind a KEV gate: a gate may only pick who looks next, never approve"
        : "action does not declare reversible: true");
  }

  const ranks = Object.values(actions).map((a) => a.rank).filter((r) => typeof r === "number");
  const top = Math.max(...ranks);
  if (!gate.unreachable || !(gate.unreachable in actions)) row("K6", "error", "unreachable", "no fail-open action: say what happens when KEV is down");
  else if (rank(gate, gate.unreachable) !== top) row("K6", "error", "unreachable", "fail-open action is not the highest rank: an outage would lower the bar");
  if (!gate.default || !(gate.default in actions)) row("K6", "error", "default", "no default action for when no rule fires");

  const used = new Set();
  (gate.rules || []).forEach((r, i) => {
    if (!(r.then in actions)) row("K7", "error", "rule " + (i + 1), "then: \"" + r.then + "\" is not a declared action");
    for (const f of factsIn(r.if)) {
      used.add(f);
      if (!(f.split(":")[0] in questions)) row("K7", "error", "rule " + (i + 1), "reads fact \"" + f + "\" that no question produces");
    }
  });
  for (const name of Object.keys(questions))
    if (![...used].some((f) => f.split(":")[0] === name)) row("K8", "warn", name, "question no rule reads: drop it or use it");

  if (gate.mode !== "shadow" && gate.mode !== "enforce") row("K9", "error", "mode", "mode must be \"shadow\" or \"enforce\"; a new gate starts in shadow");
  return rows;
}

// -------------------------------------------------------------------- ask --
function flatten(answers) {
  const facts = {};
  for (const [name, a] of Object.entries(answers || {})) {
    if (a.type === "noul") facts[name] = a.noul;
    else if (a.type === "score") facts[name] = a.score;
    else if (a.type === "choice") for (const [opt, p] of Object.entries(a.probabilities || {})) facts[name + ":" + opt] = p;
  }
  return facts;
}

export async function ask(gate, state, opts = {}) {
  const fetchImpl = opts.fetch || globalThis.fetch;
  const url = (opts.url || process.env.KEV_URL || DEFAULT_URL).replace(/\/$/, "") + "/v1/systemone";
  const body = JSON.stringify({ state, model: process.env.KEV_MODEL || gate.model || "kev-latest", questions: gate.questions });
  const stateText = typeof state === "string" ? state : JSON.stringify(state);
  const base = {
    gate: gate.gate, version: gate.version,
    id: (opts.now || Date.now()).toString(36) + "-" + createHash("sha256").update(stateText).digest("hex").slice(0, 8),
    state_hash: createHash("sha256").update(stateText).digest("hex").slice(0, 16),
    enforce: gate.mode === "enforce" && !opts.shadow,
  };
  const failOpen = (why) => ({ ...base, action: gate.unreachable, rank: rank(gate, gate.unreachable), reason: why, facts: {}, kev: false });

  if (stateText.length > (gate.max_state_chars || DEFAULT_MAX_STATE)) return failOpen("state too large for the gate (" + stateText.length + " chars): not truncating silently");
  let res;
  try {
    const headers = { "Content-Type": "application/json" };
    if (process.env.KEV_API_KEY) headers.Authorization = "Bearer " + process.env.KEV_API_KEY;
    const r = await fetchImpl(url, { method: "POST", headers, body, signal: AbortSignal.timeout(Number(process.env.KEV_TIMEOUT_MS) || 5000) });
    if (!r.ok) return failOpen("kev answered HTTP " + r.status);
    res = await r.json();
  } catch (e) {
    return failOpen("kev unreachable: " + (e?.cause?.code || e?.cause?.errors?.[0]?.code || e?.name || "error"));
  }
  const facts = flatten(res.answers);
  try {
    const d = decide(gate, facts);
    return { ...base, action: d.action, rank: rank(gate, d.action), reason: d.reason, facts, kev: true, latency_ms: res.latency_ms };
  } catch (e) {
    return { ...failOpen("kev answer unusable: " + e.message), facts };
  }
}

// -------------------------------------------------------------- calibrate --
// Three kinds of error, never added together:
//   missed   — the gate chose a lower rank than the label: a risk got past
//   over     — the gate chose a higher rank: work was escalated needlessly
//   misroute — same rank, wrong lane
export function grade(gate, rows, { minCases = 20, minRisky = 5, maxOver = 0.5 } = {}) {
  const floor = Math.min(...Object.values(gate.actions).map((a) => a.rank));
  const out = { n: rows.length, correct: 0, missed: [], over: [], misroute: [], unusable: 0, per_want: {} };
  for (const r of rows) {
    const pw = (out.per_want[r.want] ||= { n: 0, correct: 0 });
    pw.n++;
    if (!r.kev) out.unusable++;
    const dw = rank(gate, r.want), dg = rank(gate, r.got);
    if (r.got === r.want) { out.correct++; pw.correct++; }
    else if (dg < dw) out.missed.push(r);
    else if (dg > dw) out.over.push(r);
    else out.misroute.push(r);
  }
  const risky = rows.filter((r) => rank(gate, r.want) > floor).length;
  const reasons = [];
  if (out.unusable) reasons.push(out.unusable + " case(s) got no usable answer from KEV: fix that before reading the rest");
  if (out.n < minCases) reasons.push("only " + out.n + " cases; need " + minCases);
  if (risky < minRisky) reasons.push("only " + risky + " case(s) labelled above the lowest rank; need " + minRisky + " — zero misses of a risk never shown proves nothing");
  if (out.missed.length) reasons.push(out.missed.length + " missed: the gate under-escalated");
  // Over-escalation is measured against the cases that could have stayed
  // low: a gate that sends everything up never misses and saves nothing.
  const top = Math.max(...Object.values(gate.actions).map((a) => a.rank));
  const couldStayLow = rows.filter((r) => rank(gate, r.want) < top).length;
  out.risky = risky;
  out.over_rate = couldStayLow ? +(out.over.length / couldStayLow).toFixed(2) : 0;
  if (out.over_rate > maxOver) reasons.push("escalates " + out.over.length + " of " + couldStayLow + " cases that did not need it (limit " + maxOver + "): the gate saves too little to be worth a moving part");
  out.verdict = reasons.length ? "refuse" : "admit";
  out.reasons = reasons;
  return out;
}

async function calibrate(gate, cases, opts) {
  const rows = [], lat = [];
  for (const c of cases) {
    const a = await ask(gate, c.state, { ...opts, shadow: true });
    if (a.latency_ms) lat.push(a.latency_ms);
    rows.push({ want: c.want, got: a.action, kev: a.kev, reason: a.reason, facts: a.facts, note: c.note || "" });
  }
  const g = grade(gate, rows, opts);
  // Sweep: re-decide from the facts already collected with every threshold
  // moved by d. No new model calls. Shows which way the gate would break.
  const sweep = [-0.2, -0.1, 0, 0.1, 0.2].map((d) => {
    const moved = rows.filter((r) => r.kev).map((r) => ({ ...r, got: decide(gate, r.facts, d).action }));
    const s = grade(gate, moved, opts);
    return { shift: d, missed: s.missed.length, over: s.over.length, misroute: s.misroute.length };
  });
  lat.sort((a, b) => a - b);
  const slim = ({ want, got, note, facts }) => ({ want, got, note, facts });
  return {
    gate: gate.gate, version: gate.version, ...g,
    missed: g.missed.map(slim), over: g.over.map(slim), misroute: g.misroute.map(slim),
    sweep, latency_ms: lat.length ? { median: lat[lat.length >> 1], max: lat[lat.length - 1] } : null,
  };
}

// ----------------------------------------------------------------- shadow --
// Join `ask` lines with `outcome` lines by id: what the gate would have done
// against what a higher tier (or the owner) actually decided.
export function shadowReport(gate, lines, opts) {
  const asks = new Map(), actual = new Map();
  for (const l of lines) {
    if (l.gate && l.gate !== gate.gate) continue;
    if (l.outcome) actual.set(l.id, l.outcome); else if (l.action) asks.set(l.id, l);
  }
  const rows = [...asks.values()].filter((a) => actual.has(a.id))
    .map((a) => ({ want: actual.get(a.id), got: a.action, kev: a.kev, facts: a.facts, note: a.id }));
  const g = grade(gate, rows, opts);
  return { gate: gate.gate, logged: asks.size, with_outcome: rows.length, ...g, verdict: g.verdict === "admit" ? "promote" : "stay-shadow" };
}

// -------------------------------------------------------------------- cli --
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const readJsonl = (p) => readFileSync(p, "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("//")).map((l) => JSON.parse(l));
const flag = (argv, name, dflt) => { const i = argv.indexOf(name); return i < 0 ? dflt : argv[i + 1]; };

async function main(argv) {
  const [cmd, ...rest] = argv;
  if (cmd === "--self-test") return selfTest();
  const limits = { minCases: Number(flag(rest, "--min-cases", 20)), minRisky: Number(flag(rest, "--min-risky", 5)), maxOver: Number(flag(rest, "--max-over", 0.5)) };
  if (cmd === "lint") {
    const rows = lint(readJson(rest[0]));
    console.log(JSON.stringify({ gate: rest[0], rows, errors: rows.filter((r) => r.level === "error").length }, null, 2));
    return rows.some((r) => r.level === "error") ? 1 : 0;
  }
  if (cmd === "ask") {
    const gate = readJson(rest[0]);
    const src = flag(rest, "--state");
    if (!src) throw new Error("ask needs --state <file|->");
    const raw = readFileSync(src === "-" ? 0 : src, "utf8");
    let state; try { state = JSON.parse(raw); } catch { state = raw; }
    const a = await ask(gate, state, { shadow: rest.includes("--shadow") });
    const log = flag(rest, "--log");
    if (log) appendFileSync(log, JSON.stringify({ ts: new Date().toISOString(), ...a }) + "\n");
    console.log(JSON.stringify(a, null, 2));
    return 0;
  }
  if (cmd === "calibrate") {
    const gate = readJson(rest[0]);
    const errors = lint(gate).filter((r) => r.level === "error");
    if (errors.length) { console.log(JSON.stringify({ verdict: "refuse", reasons: ["gate has lint errors; run lint first"], rows: errors }, null, 2)); return 1; }
    const report = await calibrate(gate, readJsonl(rest[1]), limits);
    console.log(JSON.stringify(report, null, 2));
    return report.verdict === "admit" ? 0 : 1;
  }
  if (cmd === "outcome") {
    appendFileSync(rest[0], JSON.stringify({ ts: new Date().toISOString(), id: rest[1], outcome: rest[2] }) + "\n");
    return 0;
  }
  if (cmd === "shadow") {
    const report = shadowReport(readJson(rest[0]), readJsonl(rest[1]), limits);
    console.log(JSON.stringify(report, null, 2));
    return report.verdict === "promote" ? 0 : 1;
  }
  console.error("usage: kev.mjs ask|lint|calibrate|outcome|shadow|--self-test  (see the header of this file)");
  return 2;
}

// -------------------------------------------------------------- self-test --
// No network: a stub stands in for KEV.
const GOOD = {
  gate: "t", version: 1, mode: "shadow",
  questions: {
    risky: { type: "noul", instructions: { question: "Does change.diff remove stored data?", inspect: "change.diff" }, criteria: { true: { what: "data removed" }, false: { what: "no data removed" } } },
    kind: { type: "choice", instructions: { question: "Which kind of change is change.diff?", inspect: "change.diff" }, criteria: { docs: "documentation", code: "code", noMatch: "neither" } },
  },
  rules: [
    { if: { any: [{ fact: "risky", gte: 0.5 }, { fact: "risky", between: [0.35, 0.5] }] }, then: "deep" },
    { if: { fact: "kind:docs", gte: 0.8 }, then: "skip" },
  ],
  default: "light", unreachable: "deep",
  actions: { skip: { rank: 0, reversible: true }, light: { rank: 1, reversible: true }, deep: { rank: 2, reversible: true } },
};
const BAD = {
  gate: "b", version: 1, mode: "on",
  questions: {
    verdict: { type: "noul", instructions: "Is this safe to merge?" },
    route: { type: "choice", instructions: { question: "Where does item.text go?", inspect: "item.text" }, criteria: { a: "x", b: "y" } },
    spare: { type: "noul", instructions: { question: "Is item.text long?", inspect: "item.text" }, criteria: { true: { what: "long" }, false: { what: "short" } } },
  },
  rules: [{ if: { fact: "ghost", gte: 0.5 }, then: "merge" }, { if: { fact: "verdict", gte: 0.9 }, then: "nowhere" }],
  default: "merge", unreachable: "hold",
  actions: { merge: { rank: 0, reversible: false }, hold: { rank: 0 } },
};
const stub = (answers, { status = 200, throws = false } = {}) => async () => {
  if (throws) { const e = new Error("fetch failed"); e.cause = { code: "ECONNREFUSED" }; throw e; }
  return { ok: status === 200, status, json: async () => ({ answers, latency_ms: 1 }) };
};
const kevSays = (risky, docs) => ({ risky: { type: "noul", noul: risky }, kind: { type: "choice", probabilities: { docs, code: 1 - docs, noMatch: 0 } } });

async function selfTest() {
  let failed = 0;
  const check = (name, ok) => { if (!ok) failed++; console.log((ok ? "ok   " : "FAIL ") + name); };
  const ids = (g) => lint(g).map((r) => r.id + ":" + r.where);

  check("a well-formed gate lints clean", lint(GOOD).length === 0);
  const bad = ids(BAD);
  check("K1 choice without a way out", bad.includes("K1:route"));
  check("K2 bare instruction", bad.includes("K2:verdict"));
  check("K3 noul without a boundary", bad.includes("K3:verdict"));
  check("K4 verdict wording", bad.includes("K4:verdict"));
  check("K5 irreversible action and undeclared reversibility", bad.includes("K5:merge") && bad.includes("K5:hold"));
  check("K7 unknown fact and unknown action", bad.includes("K7:rule 1") && bad.includes("K7:rule 2"));
  check("K8 unused question", bad.includes("K8:spare"));
  check("K9 mode", bad.includes("K9:mode"));
  check("K1 accepts exhaustive instead of a fallback", !ids({ ...GOOD, questions: { ...GOOD.questions, kind: { ...GOOD.questions.kind, exhaustive: true, criteria: { docs: "d", code: "c" } } } }).some((i) => i.startsWith("K1")));
  check("K6 fail-open must be the top rank", ids({ ...GOOD, unreachable: "light" }).includes("K6:unreachable"));

  check("first matching rule wins", (await ask(GOOD, "s", { fetch: stub(kevSays(0.9, 0.95)) })).action === "deep");
  check("uncertainty band escalates", (await ask(GOOD, "s", { fetch: stub(kevSays(0.4, 0.95)) })).action === "deep");
  check("a choice option is a fact", (await ask(GOOD, "s", { fetch: stub(kevSays(0.1, 0.9)) })).action === "skip");
  check("no rule fired is the default", (await ask(GOOD, "s", { fetch: stub(kevSays(0.1, 0.2)) })).action === "light");
  const down = await ask(GOOD, "s", { fetch: stub(null, { throws: true }) });
  check("unreachable fails open to the top rank", down.action === "deep" && down.kev === false && /ECONNREFUSED/.test(down.reason));
  check("HTTP 500 fails open", (await ask(GOOD, "s", { fetch: stub({}, { status: 500 }) })).action === "deep");
  check("a missing fact fails open", (await ask(GOOD, "s", { fetch: stub({ kind: kevSays(0, 1).kind }) })).action === "deep");
  check("an oversized state fails open", (await ask({ ...GOOD, max_state_chars: 3 }, "long state", { fetch: stub(kevSays(0, 1)) })).action === "deep");
  check("shadow mode never enforces", (await ask(GOOD, "s", { fetch: stub(kevSays(0, 1)) })).enforce === false);
  check("enforce mode enforces, --shadow overrides", (await ask({ ...GOOD, mode: "enforce" }, "s", { fetch: stub(kevSays(0, 1)) })).enforce === true
    && (await ask({ ...GOOD, mode: "enforce" }, "s", { fetch: stub(kevSays(0, 1)), shadow: true })).enforce === false);

  const row = (want, got) => ({ want, got, kev: true, facts: {} });
  const g = grade(GOOD, [row("deep", "light"), row("light", "deep"), row("light", "light")], { minCases: 3, minRisky: 1 });
  check("a miss and an over-escalation are counted apart", g.missed.length === 1 && g.over.length === 1 && g.verdict === "refuse");
  check("zero misses admits", grade(GOOD, [row("deep", "deep"), row("light", "deep"), row("light", "light"), row("skip", "skip")], { minCases: 4, minRisky: 1 }).verdict === "admit");
  check("zero misses of a risk never shown refuses", grade(GOOD, [row("skip", "skip"), row("skip", "light")], { minCases: 2, minRisky: 1 }).verdict === "refuse");
  check("a gate that escalates everything is refused", /saves too little/.test(grade(GOOD, [row("deep", "deep"), row("light", "deep"), row("light", "deep")], { minCases: 3, minRisky: 1 }).reasons.join()));
  check("sum of option probabilities is a fact", holds({ sum: ["kind:docs", "kind:code"], gte: 0.9 }, { "kind:docs": 0.5, "kind:code": 0.45 }) && describe({ sum: ["a", "b"], gte: 0.1 }) === "sum(a+b)>=0.1");
  check("threshold sweep re-decides from facts", decide(GOOD, { risky: 0.45, "kind:docs": 0 }, 0.2).action === "light");

  const sh = shadowReport(GOOD, [
    { id: "a", gate: "t", action: "light", kev: true }, { id: "a", outcome: "deep" },
    { id: "b", gate: "t", action: "deep", kev: true },
  ], { minCases: 1, minRisky: 1 });
  check("shadow joins asks to outcomes and refuses on a miss", sh.logged === 2 && sh.with_outcome === 1 && sh.verdict === "stay-shadow");

  // Run this file through a symlink in a directory with a space in its name:
  // no arguments must reach main() and exit 2 with the usage line.
  const dir = mkdtempSync(join(tmpdir(), "kev gate "));
  try {
    const link = join(dir, "kev.mjs");
    symlinkSync(fileURLToPath(import.meta.url), link);
    const r = spawnSync(process.execPath, [link], { encoding: "utf8" });
    check("runs when invoked through a symlink", r.status === 2 && /usage:/.test(r.stderr));
  } finally { rmSync(dir, { recursive: true, force: true }); }

  console.log(failed ? failed + " failed" : "all passed");
  return failed ? 1 : 0;
}

// Compare real paths: the README installs a skill by symlink, and a guard
// that compares the raw argv path never fires through one — the script then
// prints nothing and exits 0, which `calibrate` callers would read as admit.
const isMain = process.argv[1] && (() => {
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); }
  catch { return false; }
})();
if (isMain) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { console.error(e.message); process.exitCode = 2; });
}
