#!/usr/bin/env node
// loop-economist run evidence: what the loop actually did and what it cost.
// Reads Claude Code session transcripts + git history. Evidence only —
// no judgement, no scores.
//
// Usage: node runs.mjs [repoPath] [--since 14d] [--transcripts DIR] [--json-only]
//        node runs.mjs --self-test
//
// Read-only. Never runs anything of the project's except `git log`.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const VAGUE = /\b(improve|look at|consider|explore|clean ?up|review|polish|tidy)\b/i;
const REWORK_SUBJECT = /^(fix|revert|hotfix|redo|retry|correct|repair|undo|amend)\b/i;

function projectSlug(repoPath) { return repoPath.replace(/[/.]/g, "-"); }

function parseSince(s) {
  const m = String(s ?? "14d").match(/^(\d+)([dhw])$/);
  if (!m) return Date.now() - 14 * 864e5;
  const mult = { h: 36e5, d: 864e5, w: 7 * 864e5 }[m[2]];
  return Date.now() - Number(m[1]) * mult;
}

function readJsonl(file) {
  const out = [];
  let text; try { text = readFileSync(file, "utf8"); } catch { return out; }
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* truncated line */ }
  }
  return out;
}

// ------------------------------------------------------------- transcripts
function readSession(file) {
  const rows = readJsonl(file);
  const s = {
    id: basename(file, ".jsonl"), file,
    start: null, end: null, minutes: 0, branch: null, cwd: null,
    models: {}, humanTurns: 0, assistantTurns: 0, sidechainTurns: 0,
    tokens: { in: 0, out: 0, cacheRead: 0, cacheCreate: 0, thinking: 0, sidechain: 0 },
    tools: {}, subagents: {}, toolErrors: 0, interrupts: 0,
    editedFiles: {}, repeatedToolCalls: [],
  };
  const callSig = new Map();
  for (const r of rows) {
    if (r.timestamp) {
      const t = Date.parse(r.timestamp);
      if (!Number.isNaN(t)) { if (s.start == null || t < s.start) s.start = t; if (s.end == null || t > s.end) s.end = t; }
    }
    if (r.cwd) s.cwd = r.cwd;
    if (r.gitBranch) s.branch = r.gitBranch;

    if (r.type === "assistant" && r.message) {
      s.assistantTurns++;
      if (r.isSidechain) s.sidechainTurns++;
      if (r.message.model) s.models[r.message.model] = (s.models[r.message.model] ?? 0) + 1;
      const u = r.message.usage ?? {};
      const billed = (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
      s.tokens.in += u.input_tokens ?? 0;
      s.tokens.out += u.output_tokens ?? 0;
      s.tokens.cacheRead += u.cache_read_input_tokens ?? 0;
      s.tokens.cacheCreate += u.cache_creation_input_tokens ?? 0;
      s.tokens.thinking += u.output_tokens_details?.thinking_tokens ?? 0;
      if (r.isSidechain) s.tokens.sidechain += billed;
      for (const b of r.message.content ?? []) {
        if (b?.type !== "tool_use") continue;
        s.tools[b.name] = (s.tools[b.name] ?? 0) + 1;
        if (/^(Agent|Task)$/.test(b.name)) {
          const kind = b.input?.subagent_type ?? "general-purpose";
          s.subagents[kind] = (s.subagents[kind] ?? 0) + 1;
        }
        const path = b.input?.file_path ?? b.input?.notebook_path;
        if (path && /^(Edit|Write|NotebookEdit|MultiEdit)$/.test(b.name)) s.editedFiles[path] = (s.editedFiles[path] ?? 0) + 1;
        const sig = b.name + "|" + JSON.stringify(b.input?.command ?? b.input?.pattern ?? path ?? b.input?.prompt ?? "").slice(0, 160);
        callSig.set(sig, (callSig.get(sig) ?? 0) + 1);
      }
    } else if (r.type === "user" && r.message) {
      const c = r.message.content;
      const isToolResult = Array.isArray(c) && c.some((b) => b?.type === "tool_result");
      if (isToolResult) {
        if (Array.isArray(c) && c.some((b) => b?.is_error)) s.toolErrors++;
        const txt = JSON.stringify(c);
        if (/interrupted by user|Request interrupted/i.test(txt)) s.interrupts++;
      } else if (!r.isMeta && !r.isSidechain) {
        s.humanTurns++;
      }
    }
  }
  s.minutes = s.start && s.end ? Math.round((s.end - s.start) / 6e4) : 0;
  s.repeatedToolCalls = [...callSig.entries()].filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([sig, n]) => ({ call: sig, times: n }));
  s.billable = s.tokens.in + s.tokens.out + s.tokens.cacheCreate;
  return s;
}

function collectSessions(dir, sinceMs) {
  if (!dir || !existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".jsonl")) continue;
    const p = join(dir, f);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.mtimeMs < sinceMs) continue;
    const s = readSession(p);
    if (s.assistantTurns === 0) continue;
    if (s.start != null && s.start < sinceMs && s.end < sinceMs) continue;
    out.push(s);
  }
  return out.sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
}

// --------------------------------------------------------------------- git
function collectGit(repoPath, sinceMs) {
  const sh = (cmd) => execSync(cmd, { cwd: repoPath, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64e6 });
  const since = new Date(sinceMs).toISOString();
  const g = { commits: [], rework: { reworkCommits: [], churnFiles: [] }, error: null };
  let raw;
  try { raw = sh(`git log --since="${since}" --date=iso-strict --numstat --format="__C__%H|%ad|%an|%s|%b__E__"`); }
  catch (e) { g.error = "git log failed"; return g; }
  const fileCommits = new Map();
  for (const chunk of raw.split("__C__").slice(1)) {
    const [head, rest = ""] = chunk.split("__E__");
    const [sha, date, author, subject, body = ""] = head.split("|");
    const files = []; let ins = 0, del = 0;
    for (const line of rest.split("\n")) {
      const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
      if (!m) continue;
      ins += Number(m[1]) || 0; del += Number(m[2]) || 0; files.push(m[3]);
      fileCommits.set(m[3], (fileCommits.get(m[3]) ?? 0) + 1);
    }
    const coauthor = body.match(/Co-Authored-By:\s*([^<\n]+)/i)?.[1]?.trim() ?? null;
    g.commits.push({ sha: sha.slice(0, 8), date, author, subject, coauthor, files: files.length, insertions: ins, deletions: del, fileList: files });
  }
  const seen = new Set();
  for (const c of [...g.commits].reverse()) { // oldest first
    if (REWORK_SUBJECT.test(c.subject) && c.fileList.some((f) => seen.has(f))) {
      g.rework.reworkCommits.push({ sha: c.sha, subject: c.subject });
    }
    for (const f of c.fileList) seen.add(f);
  }
  g.rework.churnFiles = [...fileCommits.entries()].filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1]).slice(0, 10).map(([file, commits]) => ({ file, commits }));
  for (const c of g.commits) delete c.fileList;
  return g;
}

// ----------------------------------------------------------- loop records
function findRecords(repoPath) {
  const out = [];
  const cands = ["docs", ".claude", "."];
  for (const d of cands) {
    const dir = join(repoPath, d);
    if (!existsSync(dir)) continue;
    let ents; try { ents = readdirSync(dir); } catch { continue; }
    for (const f of ents) {
      if (!/^(LOOP|TICK|RUN|HUMAN|GATE|BACKLOG|ROADMAP|STATUS).*\.md$/i.test(f)) continue;
      const p = join(dir, f);
      let t; try { t = readFileSync(p, "utf8"); } catch { continue; }
      const lines = t.split("\n");
      out.push({
        file: join(d === "." ? "" : d, f),
        lines: lines.length,
        entries: lines.filter((l) => /^\s*[-*|]\s|^\s*#{2,3}\s/.test(l)).length,
        openItems: lines.filter((l) => /^\s*[-*]\s*\[ \]/.test(l)).length,
        doneItems: lines.filter((l) => /^\s*[-*]\s*\[[xX]\]/.test(l)).length,
        vagueItems: lines.filter((l) => /^\s*[-*]\s*\[ \]/.test(l) && VAGUE.test(l)).length,
      });
    }
  }
  return out;
}

// ------------------------------------------------------------------ derive
function derive(sessions, git) {
  const sum = (f) => sessions.reduce((a, s) => a + f(s), 0);
  const billable = sum((s) => s.billable);
  const cacheRead = sum((s) => s.tokens.cacheRead);
  const tools = {}; const agents = {}; const models = {};
  for (const s of sessions) {
    for (const [k, v] of Object.entries(s.tools)) tools[k] = (tools[k] ?? 0) + v;
    for (const [k, v] of Object.entries(s.subagents)) agents[k] = (agents[k] ?? 0) + v;
    for (const [k, v] of Object.entries(s.models)) models[k] = (models[k] ?? 0) + v;
  }
  const edits = Object.values(tools).length ? (tools.Edit ?? 0) + (tools.Write ?? 0) + (tools.MultiEdit ?? 0) : 0;
  const toolCalls = Object.values(tools).reduce((a, b) => a + b, 0);
  const commits = git.commits.length;
  const round = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null);
  return {
    sessions: sessions.length,
    commits,
    billableTokens: billable,
    cacheReadTokens: cacheRead,
    cacheHitRate: round(cacheRead / Math.max(1, cacheRead + sum((s) => s.tokens.cacheCreate + s.tokens.in))),
    tokensPerCommit: commits ? Math.round(billable / commits) : null,
    tokensPerSession: sessions.length ? Math.round(billable / sessions.length) : null,
    outputTokens: sum((s) => s.tokens.out),
    thinkingShare: round(sum((s) => s.tokens.thinking) / Math.max(1, sum((s) => s.tokens.out))),
    sidechainShare: round(sum((s) => s.tokens.sidechain) / Math.max(1, billable)),
    humanTurns: sum((s) => s.humanTurns),
    humanTurnsPerSession: round(sum((s) => s.humanTurns) / Math.max(1, sessions.length)),
    interrupts: sum((s) => s.interrupts),
    toolErrors: sum((s) => s.toolErrors),
    toolErrorRate: round(sum((s) => s.toolErrors) / Math.max(1, toolCalls)),
    toolCalls, edits,
    toolCallsPerEdit: edits ? round(toolCalls / edits, 1) : null,
    minutesTotal: sum((s) => s.minutes),
    reworkCommits: git.rework.reworkCommits.length,
    reworkRate: commits ? round(git.rework.reworkCommits.length / commits) : null,
    thrashSessions: sessions.filter((s) => s.repeatedToolCalls.length > 0).map((s) => s.id),
    zeroCommitSessions: sessions.filter((s) => s.billable > 20000 && Object.keys(s.editedFiles).length === 0).map((s) => s.id),
    topTools: Object.entries(tools).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, n]) => ({ name, n })),
    modelMix: models, subagentMix: agents,
  };
}

export function runs(repoPathIn, opts = {}) {
  const repoPath = resolve(repoPathIn);
  const sinceMs = parseSince(opts.since);
  const tdir = opts.transcripts ?? join(homedir(), ".claude", "projects", projectSlug(repoPath));
  const sessions = collectSessions(tdir, sinceMs);
  const git = opts.git === false ? { commits: [], rework: { reworkCommits: [], churnFiles: [] }, error: "skipped" } : collectGit(repoPath, sinceMs);
  const warnings = [];
  if (!existsSync(tdir)) warnings.push(`no transcripts at ${tdir} — session evidence unavailable, judge from git and records only`);
  else if (sessions.length === 0) warnings.push(`no sessions in window (${opts.since ?? "14d"}) under ${tdir}`);
  return {
    repoPath, collectedAt: new Date().toISOString(),
    window: { since: new Date(sinceMs).toISOString(), spec: opts.since ?? "14d" },
    transcriptDir: tdir,
    sessions: sessions.map((s) => ({ ...s, editedFiles: Object.entries(s.editedFiles).map(([file, n]) => ({ file, n })).sort((a, b) => b.n - a.n).slice(0, 10) })),
    git, records: findRecords(repoPath),
    derived: derive(sessions, git),
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
    const got = runs(dir, { git: false, since: "3650d", transcripts: join(dir, "transcripts") });
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
    const val = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
    const repo = args.find((a, i) => !a.startsWith("--") && !["--since", "--transcripts"].includes(args[i - 1])) ?? process.cwd();
    const out = runs(repo, { since: val("--since"), transcripts: val("--transcripts") });
    if (!args.includes("--json-only") && out.warnings.length) process.stderr.write(out.warnings.map((w) => "! " + w).join("\n") + "\n");
    process.stdout.write(JSON.stringify(out, null, 2));
  }
}
