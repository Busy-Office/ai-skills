#!/usr/bin/env node
// deploy-agents: run references/batch.workflow.js against scripted agents, so
// its stop rules can be checked without spending a token.
//
// Usage: node dry-run.mjs --self-test
//
// Reads the template, replaces agent()/phase()/log() with stubs that answer
// from a scenario, and asserts the status each scenario must end on.

import { readFileSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, "..", "references", "batch.workflow.js"), "utf8")
  .replace("export const meta", "const meta");
const AsyncFunction = (async () => {}).constructor;
const body = new AsyncFunction("agent", "phase", "log", "args", SRC);

const claims = (grade = "Ran") => ({ summary: "did it", claims: [{ claim: "tests pass", grade, check: "npm test" }] });
const f = (id) => ({ id, severity: "should-fix", where: "a.js:1", problem: id });

// reviews: what the reviewer returns each round; held: whether claims re-check
export async function simulate({ reviews, held = true, grade = "Ran" }) {
  let review = 0;
  const calls = [];
  const agent = async (prompt, opts) => {
    const label = opts.label ?? "";
    calls.push(label);
    if (label === "build" || label.startsWith("fix")) return claims(grade);
    if (label.startsWith("verify")) return { results: [{ claim: "tests pass", held, evidence: "…" }] };
    if (label.startsWith("review")) return { findings: reviews[review++] ?? [] };
    if (label === "final check") return { passed: true, tail: "ok" };
    throw new Error(`unexpected agent ${label}`);
  };
  const out = await body(agent, () => {}, () => {}, { goal: "g", worktree: "/w", branch: "b", decisions: "d", finalCheck: "npm test", maxRounds: 3 });
  return { ...out, calls };
}

async function selfTest() {
  const checks = [
    ["clean first review → done, final check runs", async () => { const r = await simulate({ reviews: [[]] }); return r.status === "stop: done" && r.calls.includes("final check"); }],
    ["fixed on round 2 → done", async () => (await simulate({ reviews: [[f("x")], []] })).status === "stop: done"],
    ["a fixed finding returns → plateau", async () => (await simulate({ reviews: [[f("x")], [f("y")], [f("x")]] })).status.startsWith("stop: plateau")],
    ["two rounds fixing nothing new → plateau", async () => (await simulate({ reviews: [[f("x")], [f("x"), f("y")], [f("x"), f("y")]] })).status === "stop: plateau (two rounds fixed nothing new)"],
    ["progress every round → budget after 3 reviews, no final check", async () => { const r = await simulate({ reviews: [[f("a")], [f("b")], [f("c")], [f("d")]] }); return r.status === "stop: budget" && r.calls.filter((c) => c.startsWith("review")).length === 3 && !r.calls.includes("final check"); }],
    ["a claim fails re-checking → cannot verify", async () => (await simulate({ reviews: [[]], held: false })).status.startsWith("stop: cannot verify")],
    ["an Inferred claim is not done", async () => (await simulate({ reviews: [[]], grade: "Inferred" })).status.startsWith("stop: cannot verify")],
  ];
  let failed = 0;
  for (const [name, run] of checks) { const ok = await run(); if (!ok) failed++; console.log(`${ok ? "✓" : "✗"} ${name}`); }
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
