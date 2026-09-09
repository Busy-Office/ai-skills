#!/usr/bin/env node
// green-gate: size the checks a project has, tier them by what a change
// touches, and read the gate ledger to say which of them still earn their
// place in the fast path.
//
// Usage: node gate.mjs [repoPath] [--changed "a.ts,b.ts"] [--since 30d] [--json-only]
//        node gate.mjs --self-test
//
// Read-only by default: it discovers and maps, it does not run the project's
// tests. Timing a tier is opt-in and belongs to the skill, not the collector.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const IGNORE = new Set(["node_modules", ".git", "dist", "build", "__archived", ".next", "coverage", "vendor", "worktrees", "test-results", "playwright-report"]);

const TEST_FILE = /\.(test|spec)\.[jt]sx?$/i;
const E2E_HINT = /(^|\/)(e2e|integration|acceptance|browser)(\/|\.)/i;
const CHECK_SCRIPT = /^(test|tests|typecheck|type-check|tsc|lint|check|verify|e2e|test:e2e|test:unit|test:contract|build|format:check|ui-lint|nav-lint)/i;
// Where a project keeps the record of its own gate runs, if it keeps one.
const LEDGER_PATHS = ["docs/gate-ledger.jsonl", ".claude/gate-ledger.jsonl", "docs/GATE-LEDGER.jsonl", ".agents/gate-ledger.jsonl"];

function walk(root, maxDepth = 7) {
  const out = [];
  const rec = (dir, depth) => {
    if (depth > maxDepth) return;
    let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.isDirectory()) { if (!IGNORE.has(e.name)) rec(join(dir, e.name), depth + 1); }
      else out.push(relative(root, join(dir, e.name)));
    }
  };
  rec(root, 0);
  return out;
}

function readJson(p) { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } }

// ------------------------------------------------------------- the checks
function discover(repoPath, files) {
  const checks = [];
  const seen = new Set();
  for (const f of files.filter((x) => basename(x) === "package.json" && !x.includes("node_modules"))) {
    const pkg = readJson(join(repoPath, f));
    if (!pkg?.scripts) continue;
    const workspace = dirname(f) === "." ? "(root)" : dirname(f);
    for (const [name, cmd] of Object.entries(pkg.scripts)) {
      if (!CHECK_SCRIPT.test(name)) continue;
      const key = `${workspace}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      checks.push({
        workspace, name, command: String(cmd).slice(0, 200),
        kind: /e2e|playwright|cypress/i.test(name + cmd) ? "e2e"
          : /typecheck|tsc/i.test(name + cmd) ? "typecheck"
            : /lint|format/i.test(name + cmd) ? "lint"
              : /build/i.test(name) ? "build" : "unit",
      });
    }
  }
  return checks;
}

// --------------------------------------------------------------- the suite
function suite(repoPath, files) {
  const tests = files.filter((f) => TEST_FILE.test(f) && !f.includes("node_modules"));
  const byKind = { unit: 0, e2e: 0 };
  const byWorkspace = {};
  for (const t of tests) {
    const kind = E2E_HINT.test(t) ? "e2e" : "unit";
    byKind[kind]++;
    const ws = t.split("/").slice(0, 2).join("/");
    (byWorkspace[ws] ??= { unit: 0, e2e: 0 })[kind]++;
  }
  return { total: tests.length, byKind, byWorkspace, files: tests };
}

// ------------------------------------------------- change → tests mapping
// No import graph: a test that names the changed module is the cheap, honest
// approximation, and the report says it is an approximation.
function selectFor(repoPath, changed, tests) {
  const out = [];
  const misses = [];
  for (const c of changed) {
    const stem = basename(c).replace(/\.[jt]sx?$/, "");
    if (!stem || stem.length < 3) continue;
    const hits = tests.filter((t) => {
      if (t === c) return true;
      let text; try { text = readFileSync(join(repoPath, t), "utf8"); } catch { return false; }
      return text.includes(stem) || text.includes(c.replace(/^.*?\//, ""));
    });
    if (hits.length) out.push({ changed: c, tests: hits.slice(0, 12), n: hits.length });
    else misses.push(c);
  }
  const all = [...new Set(out.flatMap((o) => o.tests))];
  return { mapped: out, unmapped: misses, selected: all, selectedCount: all.length };
}

// ------------------------------------------------------------- the ledger
function ledger(repoPath, sinceMs) {
  const path = LEDGER_PATHS.find((p) => existsSync(join(repoPath, p)));
  if (!path) return { present: false, path: null, runs: 0, note: "no gate ledger — nothing has been recorded about what the checks cost or catch" };
  const rows = [];
  try {
    for (const line of readFileSync(join(repoPath, path), "utf8").split("\n")) {
      if (!line.trim()) continue;
      try { rows.push(JSON.parse(line)); } catch { /* skip */ }
    }
  } catch { /* unreadable */ }
  const recent = rows.filter((r) => !r.ts || Date.parse(r.ts) >= sinceMs);
  const byCheck = {};
  for (const r of recent) {
    const k = r.check ?? r.tier ?? "unknown";
    const a = (byCheck[k] ??= { runs: 0, failures: 0, caught: 0, flakes: 0, ms: [], blockedMs: 0 });
    a.runs++;
    if (r.result === "fail") a.failures++;
    if (r.caught) a.caught++;
    if (r.flake) a.flakes++;
    if (typeof r.durationMs === "number") a.ms.push(r.durationMs);
    if (typeof r.blockedMs === "number") a.blockedMs += r.blockedMs;
  }
  for (const [, a] of Object.entries(byCheck)) {
    a.ms.sort((x, y) => x - y);
    a.medianMs = a.ms.length ? a.ms[Math.floor(a.ms.length / 2)] : null;
    a.totalMin = a.ms.length ? Math.round(a.ms.reduce((x, y) => x + y, 0) / 6e4) : null;
    // What the check is worth: real catches per minute spent running it.
    a.catchesPerMin = a.totalMin ? Number((a.caught / Math.max(1, a.totalMin)).toFixed(3)) : null;
    a.flakeRate = a.runs ? Number((a.flakes / a.runs).toFixed(2)) : null;
    delete a.ms;
  }
  return { present: true, path, runs: recent.length, byCheck };
}

// Rebalance proposals — only ever proposals, and only where the ledger has
// enough runs to support one.
function rebalance(led, opts = {}) {
  const MIN_RUNS = Number(opts.minRuns ?? 20);
  const out = [];
  if (!led.present) return out;
  for (const [check, a] of Object.entries(led.byCheck)) {
    if (a.runs < MIN_RUNS) { out.push({ check, action: "keep", why: `only ${a.runs} runs — not enough evidence yet (need ${MIN_RUNS})` }); continue; }
    if (a.flakeRate >= 0.1) { out.push({ check, action: "quarantine", why: `flakes ${a.flakeRate} of runs — it is costing trust and time`, expires: "needs an owner and a date" }); continue; }
    if (a.caught === 0 && (a.medianMs ?? 0) > 120000) { out.push({ check, action: "demote", why: `${a.runs} runs, 0 real catches, median ${Math.round(a.medianMs / 1000)}s — it is not paying for its place in the fast path` }); continue; }
    if (a.caught > 0 && (a.medianMs ?? 0) < 30000) { out.push({ check, action: "promote", why: `${a.caught} real catches at median ${Math.round((a.medianMs ?? 0) / 1000)}s — cheap enough to run earlier` }); continue; }
    out.push({ check, action: "keep", why: `${a.caught} catches over ${a.runs} runs at ${a.catchesPerMin ?? "?"} per minute` });
  }
  return out;
}

export function gate(repoPathIn, opts = {}) {
  const repoPath = resolve(repoPathIn);
  const m = String(opts.since ?? "30d").match(/^(\d+)([dhw])$/);
  const sinceMs = Date.now() - (m ? Number(m[1]) * { h: 36e5, d: 864e5, w: 7 * 864e5 }[m[2]] : 30 * 864e5);
  const files = walk(repoPath);

  const checks = discover(repoPath, files);
  const s = suite(repoPath, files);
  const led = ledger(repoPath, sinceMs);

  const ciFiles = files.filter((f) => /^\.github\/workflows\/.*\.ya?ml$/.test(f) || /^\.gitlab-ci\.yml$/.test(f) || /^(azure-pipelines|\.circleci\/config)\.ya?ml$/.test(f));
  // What CI already does is the strongest evidence available about this
  // project's own tiering — mirror it rather than proposing a rival gate.
  const ci = ciFiles.map((f) => {
    let t; try { t = readFileSync(join(repoPath, f), "utf8"); } catch { return { file: f }; }
    const jobs = [...t.matchAll(/^ {2}([\w-]+):\s*$/gm)].map((m) => m[1]).filter((n) => !/^(on|env|jobs|permissions|concurrency|defaults|push|pull_request|schedule|workflow_dispatch|merge_group|inputs|secrets)$/.test(n));
    return {
      file: f, jobs,
      triggers: [...t.matchAll(/^ {2}(push|pull_request|schedule|workflow_dispatch|merge_group):/gm)].map((m) => m[1]),
      sharded: /--shard=|matrix:\s*[\s\S]{0,200}shard/i.test(t),
      runsE2e: /playwright|cypress|test:e2e/i.test(t),
      gatesDeploy: /needs:\s*\[[^\]]*\]/.test(t) && /deploy|release|publish/i.test(t),
      commands: [...t.matchAll(/run:\s*(.+)/g)].map((m) => m[1].trim().slice(0, 80)).slice(0, 12),
    };
  });

  // What the loop's own rules say about verifying, if anything
  const rules = ["CLAUDE.md", "AGENTS.md", ".claude/CLAUDE.md"].filter((f) => existsSync(join(repoPath, f)));
  const verifyRules = [];
  for (const f of rules) {
    const t = readFileSync(join(repoPath, f), "utf8").split("\n");
    t.forEach((l, i) => {
      if (/\b(test|typecheck|lint|green|verif|definition of done)\b/i.test(l) && l.trim().length > 12 && !/^#/.test(l.trim())) {
        if (verifyRules.length < 8) verifyRules.push({ file: f, line: i + 1, text: l.trim().replace(/\s+/g, " ").slice(0, 140) });
      }
    });
  }

  const changed = (opts.changed ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const selection = changed.length ? selectFor(repoPath, changed, s.files) : null;

  const warnings = [];
  if (!checks.length) warnings.push("no check commands found in any package.json — there is nothing to gate with yet");
  if (!ci.length && s.total > 0) warnings.push(`${s.total} test files and no CI workflow — nothing runs them unless a person or the loop does`);
  if (ci.length && verifyRules.length === 0) warnings.push("CI verifies but the loop's own rules say nothing about verifying — the branch is gated and the tick is not");
  if (ci.some((c) => c.sharded)) warnings.push("CI already shards its slow suite — this project has met the wall-clock problem before; mirror its tiering rather than proposing a different one");
  if (!led.present) warnings.push(led.note);
  if (s.byKind.e2e > 50) warnings.push(`${s.byKind.e2e} end-to-end specs — running these on every change will make the gate the slowest part of a tick`);

  return {
    repoPath, collectedAt: new Date().toISOString(),
    window: { since: new Date(sinceMs).toISOString(), spec: opts.since ?? "30d" },
    checks, ci, verifyRules,
    suite: { total: s.total, byKind: s.byKind, byWorkspace: s.byWorkspace },
    selection,
    ledger: led,
    rebalance: rebalance(led, opts),
    warnings,
  };
}

// --------------------------------------------------------------- self-test
function selfTest() {
  const root = join(HERE, "..", "fixtures");
  let failed = 0, total = 0;
  const get = (o, p) => p.split(".").reduce((x, k) => (x == null ? undefined : x[/^\d+$/.test(k) ? Number(k) : k]), o);
  for (const name of readdirSync(root).sort()) {
    const dir = join(root, name);
    if (!statSync(dir).isDirectory()) continue;
    const exp = JSON.parse(readFileSync(join(dir, "expect.json"), "utf8"));
    const got = gate(dir, { changed: "src/export/csv.ts", minRuns: 5 });
    let bad = 0;
    for (const [p, want] of Object.entries(exp)) {
      total++;
      const g = get(got, p);
      const ok = typeof want === "object" && want !== null ? JSON.stringify(g) === JSON.stringify(want) : g === want;
      if (!ok) { bad++; failed++; console.log(`✗ ${name}: ${p}\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(g)}`); }
    }
    console.log(`${bad ? "·" : "✓"} ${name}`);
  }
  console.log(`\n${total - failed}/${total} assertions passed`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) selfTest();
  else {
    const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
    const flags = new Set(["--changed", "--since", "--min-runs"]);
    const repo = args.find((a, i) => !a.startsWith("--") && !flags.has(args[i - 1])) ?? process.cwd();
    const out = gate(repo, { changed: val("--changed"), since: val("--since"), minRuns: val("--min-runs") });
    if (!args.includes("--json-only") && out.warnings.length) process.stderr.write(out.warnings.map((w) => "! " + w).join("\n") + "\n");
    process.stdout.write(JSON.stringify(out, null, 2));
  }
}
