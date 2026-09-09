#!/usr/bin/env node
// wake-weight: what a run pays before it does any work.
//
// Finds the files an actor loads at wake — the rules it is given, the imports
// those pull in, the records the rules tell it to read, the playbooks it opens
// every time — and reports what each costs, how fast each is growing, and what
// the whole preamble costs across a window of ticks.
//
// Usage: node weight.mjs [repoPath] [--ticks 54] [--since 30d] [--json-only]
//        node weight.mjs --self-test
//
// Read-only. Never writes to the target repo; runs only `git log`.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const IGNORE = new Set(["node_modules", ".git", "dist", "build", "__archived", "graphify-out", ".next", "coverage", "vendor", "worktrees"]);

// Files an actor is handed without asking.
const ALWAYS_LOADED = ["CLAUDE.md", "AGENTS.md", ".claude/CLAUDE.md", ".cursorrules", "GEMINI.md"];
// A rule that tells the actor to open something, every tick. Rules name files
// in lists — "Read `A.md` + `B.md`", "read A, B and C" — so a line carrying a
// read verb contributes every path on it, not just the first.
const READ_VERB = /\b(read|open|load|consult|check|reads?|append to|update|driven by|against)\b/i;
const PATH_ON_LINE = /(?:^|[\s`"'(])((?:[\w.-]+\/)*[\w.-]+\.(?:md|json|ya?ml|txt))/g;
const IMPORT = /^@([\w./-]+)\s*$/gm;
// A rule can name a file and read only part of it — "tail of X (last 5
// entries)", "the top section of Y". Counting the whole file then overstates
// the wake, badly: on the first real project this was 90k of a claimed 172k.
const SCOPED = /\b(tail|head|top section|first \d+|last ~?\d+|latest \d+|most recent|excerpt|summary of|section of|top of)\b/i;
const CLASSES = [
  ["queue", /(BACKLOG|ROADMAP|TODO|TASKS?|MILESTONES?|QUEUE|SCENARIOS)/i],
  ["record", /(LOOP-STATUS|ORCHESTRATOR-STATE|STATUS|STATE|INBOX|GATES?|HUMAN|LOG|HISTORY|JOURNAL|SESSION|CHANGELOG|MANUAL-ACTIONS)/i],
  ["rules", /(CLAUDE|AGENTS|LOOPS?|SKILL|DEFINITION|CONTRIBUTING|ORCHESTRATOR|RULES?)/i],
  ["intent", /(INTENT|CONTEXT|VISION|PURPOSE|CHARTER|MISSION|PRD)/i],
  ["playbook", /(PLAYBOOK|GUIDE|HANDBOOK|REFERENCE|PATTERNS?|ADR|DECISION)/i],
  ["map", /(GRAPH|MAP|ARCHITECTURE|SCHEMA|MODEL|DESIGN|STRUCTURE|INDEX)/i],
];

// Chars per token: a rough, honest constant for English markdown. Tables and
// code push it lower, prose higher. Every token figure here is an estimate and
// the report must say so.
const CHARS_PER_TOKEN = 4;

function walk(root, maxDepth = 4) {
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

function classify(file) {
  const b = basename(file);
  for (const [name, re] of CLASSES) if (re.test(b)) return name;
  return "other";
}

function measure(repoPath, rel) {
  let text; try { text = readFileSync(join(repoPath, rel), "utf8"); } catch { return null; }
  const lines = text.split("\n").length;
  return { file: rel, lines, chars: text.length, tokensEst: Math.round(text.length / CHARS_PER_TOKEN), class: classify(rel), text };
}

function growth(repoPath, rel, sinceMs, git) {
  if (git === false) return null;
  try {
    const since = new Date(sinceMs).toISOString();
    const raw = execSync(`git log --since="${since}" --numstat --format="" -- "${rel}"`,
      { cwd: repoPath, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32e6 });
    let added = 0, removed = 0, commits = 0;
    for (const line of raw.split("\n")) {
      const m = line.match(/^(\d+|-)\t(\d+|-)\t/);
      if (!m) continue;
      added += Number(m[1]) || 0; removed += Number(m[2]) || 0; commits++;
    }
    return { added, removed, net: added - removed, commits };
  } catch { return null; }
}

export function weight(repoPathIn, opts = {}) {
  const repoPath = resolve(repoPathIn);
  const m = String(opts.since ?? "30d").match(/^(\d+)([dhw])$/);
  const sinceMs = Date.now() - (m ? Number(m[1]) * { h: 36e5, d: 864e5, w: 7 * 864e5 }[m[2]] : 30 * 864e5);
  const files = walk(repoPath);
  const has = (f) => files.includes(f) || existsSync(join(repoPath, f));

  const loaded = new Map();          // file -> {why, viaFile}
  const add = (f, why, via) => { if (!loaded.has(f) && has(f)) loaded.set(f, { why, via, scoped: null }); };

  // 1. handed over without asking
  for (const f of ALWAYS_LOADED) add(f, "always loaded", null);

  // 2. what those import (@path)
  for (const [f] of [...loaded]) {
    const t = measure(repoPath, f);
    if (!t) continue;
    for (const im of t.text.matchAll(IMPORT)) add(im[1].replace(/^\.?\//, ""), "@import", f);
  }

  // 3. the loop's own skill / driver, when there is one
  for (const f of files) {
    if (/^\.claude\/skills\/[^/]*(loop|orchestr|tick|cycle)[^/]*\/SKILL\.md$/i.test(f)) add(f, "loop skill", null);
    if (/^(scripts|bin)\/.*(loop|orchestr|tick|cycle)[^/]*\.(sh|ps1|py|mjs|js|ts)$/i.test(f)) add(f, "driver", null);
  }

  // 4. what the loaded files tell the actor to read, every tick
  for (const [f] of [...loaded]) {
    const t = measure(repoPath, f);
    if (!t) continue;
    for (const line of t.text.split("\n")) {
      if (!READ_VERB.test(line)) continue;
      for (const p of line.matchAll(PATH_ON_LINE)) {
        const target = p[1].replace(/^\.?\//, "");
        const hit = files.find((x) => x === target || x.endsWith("/" + target));
        if (!hit) continue;
        add(hit, `named in ${basename(f)}`, f);
        // Scope belongs to the file, not the line: "read A, tail of B, and the
        // top section of C" scopes B and C only. Read the clause around this
        // path — bounded by the commas either side, not by a character count,
        // or "tail of X" leaks onto the file listed just before it.
        const at = p.index ?? 0;
        const before = line.slice(Math.max(0, at - 40), at);
        const clauseBefore = before.slice(before.lastIndexOf(",") + 1);
        const after = line.slice(at + p[1].length).replace(/^[`"']/, "");
        const clauseAfter = after.slice(0, Math.min(after.search(/[,;]|$/) < 0 ? 20 : after.search(/[,;]|$/), 20));
        const scope = `${clauseBefore} ${clauseAfter}`.match(SCOPED)?.[0]?.toLowerCase() ?? null;
        const row = loaded.get(hit);
        if (scope && !row.scoped) row.scoped = scope;
        else if (!scope && row.scoped) row.conflict = `${basename(f)} reads it whole; another rule reads only the ${row.scoped}`;
      }
    }
  }

  const rows = [];
  for (const [file, meta] of loaded) {
    const mm = measure(repoPath, file);
    if (!mm) continue;
    delete mm.text;
    // A scoped read charges an unknown fraction of the file. Keep the full
    // size for reference, but never let it into the headline total.
    rows.push({
      ...mm, why: meta.why, via: meta.via, scoped: meta.scoped, conflict: meta.conflict ?? null,
      tokensEstFull: mm.tokensEst,
      tokensEst: meta.scoped ? null : mm.tokensEst,
      growth: growth(repoPath, file, sinceMs, opts.git),
    });
  }
  rows.sort((a, b) => (b.tokensEst ?? 0) - (a.tokensEst ?? 0) || b.tokensEstFull - a.tokensEstFull);

  const total = rows.reduce((a, r) => a + (r.tokensEst ?? 0), 0);
  const scopedRows = rows.filter((r) => r.scoped);
  const byClass = {};
  for (const r of rows) if (r.tokensEst) byClass[r.class] = (byClass[r.class] ?? 0) + r.tokensEst;
  const grew = rows.filter((r) => r.growth && r.growth.net > 0)
    .sort((a, b) => b.growth.net - a.growth.net)
    .map((r) => ({ file: r.file, netLines: r.growth.net, commits: r.growth.commits }));

  // Archivable: a queue or record whose finished entries could leave. Counted
  // as done-marked lines, which is the cut that needs no judgement.
  const archivable = [];
  for (const r of rows) {
    if (!["queue", "record"].includes(r.class)) continue;
    let text; try { text = readFileSync(join(repoPath, r.file), "utf8"); } catch { continue; }
    const lines = text.split("\n");
    const done = lines.filter((l) => /^\s*[-*]\s*\[[xX]\]/.test(l) || /\bdone\b.*20\d\d|✅/i.test(l)).length;
    if (done >= 10) {
      archivable.push({ file: r.file, doneLines: done, ofLines: r.lines, tokensEst: Math.round(done / r.lines * r.tokensEst) });
    }
  }

  const ticks = Number(opts.ticks ?? 0) || null;
  const warnings = [];
  if (!rows.length) warnings.push("nothing is loaded at wake that this collector can see — no CLAUDE.md, AGENTS.md or loop skill found");
  for (const r of scopedRows) if (r.conflict) warnings.push(`rules disagree on how much of ${r.file} is read: ${r.conflict} — the heavier reading is the one that decides the cost`);
  if (scopedRows.length) warnings.push(`${scopedRows.length} file(s) are read partially by rule (${scopedRows.map((r) => `${basename(r.file)}: ${r.scoped}`).join(", ")}) — counted as unknown, not as their full size`);
  if (total > 40000) warnings.push(`the preamble is ~${Math.round(total / 1000)}k tokens before any work starts`);
  const projected = grew.length && rows.length
    ? Math.round(total + grew.reduce((a, g) => a + g.netLines, 0) * 3 * (total / rows.reduce((a, r) => a + r.lines, 0)))
    : null;

  return {
    repoPath, collectedAt: new Date().toISOString(),
    window: { since: new Date(sinceMs).toISOString(), spec: opts.since ?? "30d" },
    estimator: { charsPerToken: CHARS_PER_TOKEN, note: "token figures are estimates from character counts, not billed numbers" },
    files: rows,
    summary: {
      filesLoaded: rows.length,
      totalLines: rows.filter((r) => !r.scoped).reduce((a, r) => a + r.lines, 0),
      scopedFiles: scopedRows.length,
      totalTokensEst: total,
      byClass,
      heaviest: rows.filter((r) => r.tokensEst).slice(0, 3).map((r) => ({ file: r.file, tokensEst: r.tokensEst, share: Number((r.tokensEst / total).toFixed(2)) })),
      ticks,
      windowCostEst: ticks ? total * ticks : null,
      projectedIn90d: projected,
    },
    scopedReads: scopedRows.map((r) => ({ file: r.file, scoped: r.scoped, tokensEstFull: r.tokensEstFull, why: r.why, conflict: r.conflict })),
    grew, archivable, warnings,
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
    const got = weight(dir, { git: false, ticks: 10 });
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
    const flags = new Set(["--ticks", "--since"]);
    const repo = args.find((a, i) => !a.startsWith("--") && !flags.has(args[i - 1])) ?? process.cwd();
    const out = weight(repo, { ticks: val("--ticks"), since: val("--since") });
    if (!args.includes("--json-only") && out.warnings.length) process.stderr.write(out.warnings.map((w) => "! " + w).join("\n") + "\n");
    process.stdout.write(JSON.stringify(out, null, 2));
  }
}
