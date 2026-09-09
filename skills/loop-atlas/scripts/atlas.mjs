#!/usr/bin/env node
// loop-atlas: the cast and the stage. Collects the loop's flow (who acts at
// each step, with real file names) and its agent roster (definitions, tools,
// models, and how often each was actually summoned).
// Evidence only — no judgement, no drawing.
//
// Usage: node atlas.mjs [repoPath] [--since 30d] [--transcripts DIR] [--json-only]
//        node atlas.mjs --self-test
//
// Read-only. Never writes to the target repo; runs only `git log`.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const IGNORE = new Set(["node_modules", ".git", "dist", "build", "__archived", "graphify-out", ".next", "coverage", "vendor", "worktrees"]);

const STAGE_PATTERNS = [
  ["trigger", /(crontab|schedule:|StartInterval|launchd|\/loop\s+\d+[mhd]|every \d+ (minutes?|hours?)|cron)/i],
  ["select", /(pick (up )?the (top|next|first)|select (an?|the) (item|task|story)|next (item|task|ticket|story)|choose the (item|task)|top of the (backlog|queue|list)|highest[- ]priority|first unchecked|read .*(BACKLOG|ROADMAP|QUEUE))/i],
  ["act", /(implement|build|make the change|write the code|apply the fix)/i],
  ["verify", /(run the tests?|npm test|pytest|typecheck|lint|acceptance|definition of done|green)/i],
  ["gate", /(human gate|approval|sign-?off|GATE-|blocked on owner|manual action)/i],
  ["record", /(append to|record the tick|log the run|LOOP-STATUS|status line|write the receipt)/i],
  ["stop", /(stop (when|if)|halt|kill switch|STATUS: COMPLETE|do not continue|exit 1)/i],
];

// Matched against the agent's name first (people name an agent by its job),
// then against what it says it does. Order matters only for ties.
const ROLE_HINTS = [
  ["verify", /(review|verif|audit|check|test|lint|validat|critic|skeptic|sceptic|adversar|red.?team|qa|security|guard)/i],
  ["search", /(search|explore|find|locate|grep|research|investigat|discover|scout)/i],
  ["plan", /(plan|architect|design|strateg|roadmap|decompose|product|manager)/i],
  ["build", /\b(implement|build|write code|edit|refactor|fix|develop|scaffold|engineer|cod(e|er))/i],
  ["record", /(document|report|summari|dashboard|publish|write up|status|scribe|historian)/i],
];

function walk(root, maxDepth = 5, filter = () => true) {
  const out = [];
  const rec = (dir, depth) => {
    if (depth > maxDepth) return;
    let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.isDirectory()) { if (!IGNORE.has(e.name)) rec(join(dir, e.name), depth + 1); }
      else if (filter(e.name)) out.push(relative(root, join(dir, e.name)));
    }
  };
  rec(root, 0);
  return out;
}

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  let key = null;
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) { key = kv[1]; out[key] = kv[2].trim(); }
    else if (key && /^\s+\S/.test(line)) out[key] += " " + line.trim();
  }
  return out;
}

// Refusal clauses describe what an agent must NOT do — scoring them would
// class "refuses to edit code" as a builder.
function stripRefusals(text) {
  return String(text).split(/(?<=[.;!?])\s+|\n/)
    .filter((s) => !/\b(refuses?|never|must not|do not|don't|without) \b/i.test(s))
    .join(" ");
}

// The name is the strongest signal — people name an agent by its job.
// Fall back to counting hints in what it says it does.
function roleOf(text, name = "") {
  for (const [role, re] of ROLE_HINTS) if (re.test(name)) return role;
  text = stripRefusals(text);
  const scores = ROLE_HINTS.map(([role, re]) => [role, (text.match(new RegExp(re.source, "gi")) ?? []).length]);
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][1] > 0 ? scores[0][0] : "general";
}

function readAgents(dir, origin) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    let t; try { t = readFileSync(join(dir, f), "utf8"); } catch { continue; }
    const fm = frontmatter(t);
    const desc = (fm.description ?? "").replace(/\s+/g, " ");
    out.push({
      name: fm.name ?? basename(f, ".md"), origin, file: join(dir, f),
      description: desc.slice(0, 400),
      model: fm.model ?? null,
      tools: fm.tools ? fm.tools.split(/\s*,\s*/).filter(Boolean) : null,
      role: roleOf(`${desc} ${t.slice(0, 1500)}`, fm.name ?? basename(f, ".md")),
      bodyLines: t.split("\n").length,
    });
  }
  return out;
}

function readSkills(dir, origin) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const d of readdirSync(dir)) {
    const p = join(dir, d, "SKILL.md");
    if (!existsSync(p)) continue;
    let t; try { t = readFileSync(p, "utf8"); } catch { continue; }
    const fm = frontmatter(t);
    const desc = (fm.description ?? "").replace(/\s+/g, " ");
    out.push({ name: fm.name ?? d, origin, file: p, description: desc.slice(0, 400), role: roleOf(desc, fm.name ?? d) });
  }
  return out;
}

// Subagent turns live in <transcriptDir>/<sessionId>/subagents/agent-*.jsonl,
// each with a .meta.json naming its agentType — not in the parent transcript.
// This is where a card's real cost and tool mix come from.
function readSubagents(dir, sessionId) {
  const sub = join(dir, sessionId, "subagents");
  const byType = {};
  if (!existsSync(sub)) return byType;
  for (const f of readdirSync(sub)) {
    if (!f.endsWith(".jsonl")) continue;
    let type = "unknown";
    try { type = JSON.parse(readFileSync(join(sub, f.replace(/\.jsonl$/, ".meta.json")), "utf8")).agentType ?? "unknown"; } catch { /* no sidecar */ }
    const rec = (byType[type] ??= { runs: 0, tokens: 0, turns: 0, tools: {}, model: null });
    rec.runs++;
    let text; try { text = readFileSync(join(sub, f), "utf8"); } catch { continue; }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      let r; try { r = JSON.parse(line); } catch { continue; }
      if (r.type !== "assistant" || !r.message) continue;
      const u = r.message.usage ?? {};
      rec.tokens += (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
      rec.turns++;
      if (r.message.model) rec.model = r.message.model;
      for (const b of r.message.content ?? []) if (b?.type === "tool_use") rec.tools[b.name] = (rec.tools[b.name] ?? 0) + 1;
    }
  }
  return byType;
}

// ------------------------------------------------------- observed summons
function observe(transcriptDir, sinceMs) {
  const seen = {
    sessions: 0, summons: {}, skillCalls: {}, modelMix: {},
    sidechainTokens: 0, sidechainTurns: 0, mainTokens: 0, toolsInSidechain: {},
    promptWords: {}, perAgent: {},
  };
  if (!transcriptDir || !existsSync(transcriptDir)) return { ...seen, available: false };
  for (const f of readdirSync(transcriptDir)) {
    if (!f.endsWith(".jsonl")) continue;
    const p = join(transcriptDir, f);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.mtimeMs < sinceMs) continue;
    let text; try { text = readFileSync(p, "utf8"); } catch { continue; }
    for (const [type, rec] of Object.entries(readSubagents(transcriptDir, f.replace(/\.jsonl$/, "")))) {
      const a = (seen.perAgent[type] ??= { runs: 0, tokens: 0, turns: 0, tools: {}, model: null });
      a.runs += rec.runs; a.tokens += rec.tokens; a.turns += rec.turns; a.model ??= rec.model;
      for (const [t, n] of Object.entries(rec.tools)) a.tools[t] = (a.tools[t] ?? 0) + n;
      seen.sidechainTokens += rec.tokens; seen.sidechainTurns += rec.turns;
      for (const [t, n] of Object.entries(rec.tools)) seen.toolsInSidechain[t] = (seen.toolsInSidechain[t] ?? 0) + n;
    }
    let counted = false;
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      let r; try { r = JSON.parse(line); } catch { continue; }
      if (r.type !== "assistant" || !r.message) continue;
      if (!counted) { seen.sessions++; counted = true; }
      const u = r.message.usage ?? {};
      const billed = (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
      if (r.isSidechain) { seen.sidechainTokens += billed; seen.sidechainTurns++; }
      else { seen.mainTokens += billed; if (r.message.model) seen.modelMix[r.message.model] = (seen.modelMix[r.message.model] ?? 0) + 1; }
      for (const b of r.message.content ?? []) {
        if (b?.type !== "tool_use") continue;
        if (r.isSidechain) seen.toolsInSidechain[b.name] = (seen.toolsInSidechain[b.name] ?? 0) + 1;
        if (/^(Agent|Task)$/.test(b.name)) {
          const kind = b.input?.subagent_type ?? "general-purpose";
          seen.summons[kind] = (seen.summons[kind] ?? 0) + 1;
          const words = String(b.input?.prompt ?? "").split(/\s+/).length;
          (seen.promptWords[kind] ??= []).push(words);
        }
        if (b.name === "Skill" && b.input?.skill) seen.skillCalls[b.input.skill] = (seen.skillCalls[b.input.skill] ?? 0) + 1;
      }
    }
  }
  for (const [k, v] of Object.entries(seen.promptWords)) {
    seen.promptWords[k] = Math.round(v.reduce((a, b) => a + b, 0) / v.length);
  }
  for (const a of Object.values(seen.perAgent)) {
    a.avgTokensPerRun = a.runs ? Math.round(a.tokens / a.runs) : null;
    a.topTools = Object.entries(a.tools).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([n, c]) => `${n}×${c}`);
    delete a.tools;
  }
  return { ...seen, available: true };
}

// ------------------------------------------------------------------ flow
function readFlow(repoPath) {
  const mds = walk(repoPath, 4, (n) => /\.mdx?$/i.test(n) || /\.(ya?ml|ps1|sh|mjs|js|ts)$/i.test(n));
  const stages = Object.fromEntries(STAGE_PATTERNS.map(([s]) => [s, []]));
  const interesting = mds.filter((f) =>
    /(CLAUDE|AGENTS|LOOPS?|SKILL|BACKLOG|ROADMAP|STATUS|GATE|HUMAN|DEFINITION|MANUAL|README)/i.test(basename(f)) ||
    /^(\.github\/workflows|scripts|\.claude)\//.test(f));
  for (const f of interesting.slice(0, 120)) {
    let t; try { t = readFileSync(join(repoPath, f), "utf8"); } catch { continue; }
    const lines = t.split("\n");
    for (const [stage, re] of STAGE_PATTERNS) {
      lines.forEach((l, i) => {
        if (l.length > 400 || !re.test(l)) return;
        if (stages[stage].length >= 6) return;
        stages[stage].push({ file: f, line: i + 1, text: l.trim().replace(/\s+/g, " ").slice(0, 160) });
      });
    }
  }
  return { stages, filesConsidered: interesting.length };
}

export function atlas(repoPathIn, opts = {}) {
  const repoPath = resolve(repoPathIn);
  const m = String(opts.since ?? "30d").match(/^(\d+)([dhw])$/);
  const sinceMs = Date.now() - (m ? Number(m[1]) * { h: 36e5, d: 864e5, w: 7 * 864e5 }[m[2]] : 30 * 864e5);
  const tdir = opts.transcripts ?? join(homedir(), ".claude", "projects", repoPath.replace(/[/.]/g, "-"));

  const agents = [
    ...readAgents(join(repoPath, ".claude", "agents"), "project"),
    ...(opts.user === false ? [] : readAgents(join(homedir(), ".claude", "agents"), "user")),
  ];
  const skills = [
    ...readSkills(join(repoPath, ".claude", "skills"), "project"),
    ...readSkills(join(repoPath, "skills"), "project"),
    ...(opts.user === false ? [] : readSkills(join(homedir(), ".claude", "skills"), "user")),
  ];
  const observed = observe(tdir, sinceMs);

  // an agent the runs used but no file defines (built-in or plugin-provided)
  const defined = new Set(agents.map((a) => a.name));
  const undefinedButUsed = Object.keys(observed.summons ?? {}).filter((k) => !defined.has(k));

  const roster = agents.map((a) => ({
    ...a,
    summons: observed.summons?.[a.name] ?? 0,
    avgPromptWords: observed.promptWords?.[a.name] ?? null,
    observed: observed.perAgent?.[a.name] ?? null,   // real cost, turns and tool mix
  })).sort((a, b) => b.summons - a.summons);

  const flow = readFlow(repoPath);
  const emptyStages = Object.entries(flow.stages).filter(([, v]) => !v.length).map(([k]) => k);

  const warnings = [];
  if (!roster.length) warnings.push("no agent definitions found — the roster is whatever the runs summoned, plus the main actor");
  if (!observed.available) warnings.push(`no transcripts at ${tdir} — cards carry abilities but no observed record`);
  if (emptyStages.length) warnings.push(`no evidence in the files for stage(s): ${emptyStages.join(", ")}`);

  return {
    repoPath, collectedAt: new Date().toISOString(),
    window: { since: new Date(sinceMs).toISOString(), spec: opts.since ?? "30d" },
    transcriptDir: tdir,
    roster, undefinedButUsed, skills,
    observed: {
      available: observed.available, sessions: observed.sessions,
      summons: observed.summons, skillCalls: observed.skillCalls, modelMix: observed.modelMix,
      perAgent: observed.perAgent,
      sidechainTokens: observed.sidechainTokens, sidechainTurns: observed.sidechainTurns,
      mainTokens: observed.mainTokens, toolsInSidechain: observed.toolsInSidechain,
    },
    flow, emptyStages, warnings,
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
    const got = atlas(dir, { user: false, since: "3650d", transcripts: join(dir, "transcripts") });
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
    const flags = new Set(["--since", "--transcripts"]);
    const repo = args.find((a, i) => !a.startsWith("--") && !flags.has(args[i - 1])) ?? process.cwd();
    const out = atlas(repo, { since: val("--since"), transcripts: val("--transcripts") });
    if (!args.includes("--json-only") && out.warnings.length) process.stderr.write(out.warnings.map((w) => "! " + w).join("\n") + "\n");
    process.stdout.write(JSON.stringify(out, null, 2));
  }
}
