#!/usr/bin/env node
// deploy-agents: run references/batch.workflow.js against scripted agents, so
// its stop rules can be checked without spending a token.
//
// Usage: node dry-run.mjs --self-test
//
// Reads the template, replaces agent()/phase()/log()/budget with stubs that
// answer from a scenario, and asserts the status each scenario must end on.

import { readFileSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, "..", "references", "batch.workflow.js"), "utf8")
  .replace("export const meta", "const meta");
const AsyncFunction = (async () => {}).constructor;
const body = new AsyncFunction("agent", "phase", "log", "args", "budget", SRC);
const STATUSES = ["done", "plateau", "budget", "scope growth", "cannot verify", "unproven", "final red", "agent failed"];

const f = (id) => ({ id, severity: "should-fix", where: "a.js:1", problem: id });
const held = (grade = "Ran") => ({ results: [{ claim: "tests pass", held: true, couldRun: true, grade, evidence: "…" }] });

// reviews: findings per review round; verify(round): the verifier's answer; the rest as named
export async function simulate({ reviews = [[]], verify = () => held(), grade = "Ran", scope = [], reviewScope = [],
  final = { passed: true, tail: "ok" }, args = {}, budget = { total: null, remaining: () => Infinity } } = {}) {
  let review = 0;
  const calls = [], prompts = {}, logs = [];
  const agent = async (prompt, opts) => {
    const label = opts.label ?? "";
    calls.push(label);
    prompts[label] = prompt;
    if (label === "build" || label.startsWith("fix")) return { summary: "did it", claims: [{ claim: "tests pass", grade, check: "npm test" }], scopeGrowth: label === "build" ? scope : [] };
    if (label.startsWith("verify")) return verify(Number(label.slice(8)));
    if (label.startsWith("review")) return { findings: reviews[review++] ?? [], scopeGrowth: reviewScope };
    if (label === "final check") return final;
    throw new Error(`unexpected agent ${label}`);
  };
  const out = await body(agent, () => {}, (m) => logs.push(m),
    { goal: "g", worktree: "/w", branch: "b", decisions: "d", testCommands: ["npm test -- a"], finalCheck: "npm test", ...args }, budget);
  return { ...out, calls, prompts, logs };
}

async function selfTest() {
  const s = simulate;
  const checks = [
    ["clean first review → done, final check runs and passes", async () => { const r = await s(); return r.status === "done" && r.calls.includes("final check"); }],
    ["fixed on round 2 → done", async () => (await s({ reviews: [[f("x")], []] })).status === "done"],
    ["a fixed finding returns → plateau", async () => (await s({ reviews: [[f("x")], [f("y")], [f("x")]] })).status === "plateau"],
    ["the reviewer sees fixed findings as objects, with their ids", async () => /"fixed":\[\{"id":"x"/.test((await s({ reviews: [[f("x")], [f("y")], [f("z")]] })).prompts["review r3"].replace(/\s/g, ""))],
    ["two rounds fixing nothing new → plateau", async () => (await s({ reviews: [[f("x")], [f("x"), f("y")], [f("x"), f("y")]] })).status === "plateau"],
    ["progress every round → budget after 3 reviews, no final check", async () => { const r = await s({ reviews: [[f("a")], [f("b")], [f("c")], [f("d")]] }); return r.status === "budget" && r.calls.filter((c) => c.startsWith("review")).length === 3 && !r.calls.includes("final check"); }],
    ["token budget below one round → budget before the next round", async () => { const r = await s({ budget: { total: 1000, remaining: () => 10 } }); return r.status === "budget" && !r.calls.some((c) => c.startsWith("verify")); }],
    ["final check red → final red, not done", async () => (await s({ final: { passed: false, tail: "1 failed" } })).status === "final red"],
    ["final check did not return → cannot verify", async () => (await s({ final: null })).status === "cannot verify"],
    ["verifier did not return → cannot verify", async () => (await s({ verify: () => null })).status === "cannot verify"],
    ["a check could not run → cannot verify", async () => (await s({ verify: () => ({ results: [{ claim: "tests pass", held: false, couldRun: false, grade: "Inferred", evidence: "no db" }] }) })).status === "cannot verify"],
    ["a claim that fails re-checking is a finding for the next round", async () => { const r = await s({ verify: (n) => (n === 1 ? { results: [{ claim: "tests pass", held: false, couldRun: true, grade: "Ran", evidence: "1 failed" }] } : held()) }); return r.status === "done" && /tests pass/.test(r.prompts["fix r1"]); }],
    ["an Inferred claim the verifier upgrades → done", async () => (await s({ grade: "Inferred", verify: () => held("Read") })).status === "done"],
    ["an Inferred claim left Inferred with a clean review → unproven", async () => (await s({ grade: "Inferred", verify: () => held("Inferred") })).status === "unproven"],
    ["builder reports scope growth → scope growth, no review", async () => { const r = await s({ scope: ["new package left-pad"] }); return r.status === "scope growth" && !r.calls.some((c) => c.startsWith("review")); }],
    ["reviewer reports scope growth → scope growth", async () => (await s({ reviewScope: ["new permission"] })).status === "scope growth"],
    ["reviewer and verifier get the rules", async () => { const r = await s(); return ["review r1", "verify r1"].every((l) => /Never push/.test(r.prompts[l]) && /Never run the full suite/.test(r.prompts[l])); }],
    ["same model for builder and reviewer → logged", async () => (await s({ args: { buildModel: "m", reviewModel: "m" } })).logs.some((l) => /same model/.test(l))],
    ["every status is one of the stop rules", async () => { const all = await Promise.all([s(), s({ final: null }), s({ scope: ["x"] }), s({ grade: "Inferred", verify: () => held("Inferred") })]); return all.every((r) => STATUSES.includes(r.status) && typeof r.why === "string"); }],
  ];
  let failed = 0;
  for (const [name, run] of checks) {
    let ok = false;
    try { ok = await run(); } catch (e) { console.log(`  ${e.message}`); }
    if (!ok) failed++;
    console.log(`${ok ? "✓" : "✗"} ${name}`);
  }
  console.log(`\n${checks.length - failed}/${checks.length} assertions passed`);
  process.exit(failed ? 1 : 0);
}

const isMain = process.argv[1] && (() => {
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); }
  catch { return false; }
})();
if (isMain) {
  if (process.argv.includes("--self-test")) await selfTest();
  else { console.error("usage: node dry-run.mjs --self-test"); process.exit(2); }
}
