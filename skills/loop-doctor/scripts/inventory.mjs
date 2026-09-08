#!/usr/bin/env node
// loop-doctor inventory: find the files that govern a scheduled autonomous
// loop and run the cheap, mechanical checks. Evidence only — no judgement.
//
// Usage: node inventory.mjs [repoPath] [--json-only]
//        node inventory.mjs --self-test
//
// Read-only. Never runs anything in the target repo except `git log`/`git show`.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const IGNORE = new Set(["node_modules", ".git", "dist", "build", "__archived", "graphify-out", ".next", "coverage", "vendor", "worktrees"]);

function walk(root, maxDepth = 6) {
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

export function inventory(repoPath, opts = {}) {
  const { git = true, system = true } = opts;
  const t0 = Date.now();
  const read = (p) => { try { return readFileSync(join(repoPath, p), "utf8"); } catch { return null; } };
  const sh = (cmd, cwd = repoPath) => execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64e6 }).trim();
  const files = walk(repoPath);
  const abs = (p) => join(repoPath, p);

  const out = {
    repoPath, collectedAt: new Date().toISOString(),
    triggers: [], drivers: [], docs: [], skills: [], agents: [], stateFiles: [],
    checks: { repeatedSentences: [], danglingRefs: [], numberDisagreements: [], sentinels: [], swallowedErrors: [], singleOsDrivers: [], loadedFiles: [] },
    warnings: [],
  };

  // ------------------------------------------------------------ triggers
  for (const f of files.filter((f) => /^\.github\/workflows\/.*\.ya?ml$/.test(f))) {
    const t = read(f); const m = t?.match(/^\s*schedule:\s*\n(?:\s*-\s*cron:\s*['"]?([^'"\n]+)['"]?\s*\n?)+/m);
    if (m) out.triggers.push({ kind: "github-schedule", file: f, cadence: [...t.matchAll(/-\s*cron:\s*['"]?([^'"\n]+)/g)].map((x) => x[1].trim()) });
  }
  if (system) {
    try { for (const l of sh("crontab -l").split("\n")) if (l.includes(basename(repoPath)) || l.includes(repoPath)) out.triggers.push({ kind: "crontab", line: l.trim() }); } catch { /* none */ }
    const la = join(homedir(), "Library/LaunchAgents");
    if (existsSync(la)) for (const p of readdirSync(la)) { const t = read.call(null, "") ?? ""; try { const body = readFileSync(join(la, p), "utf8"); if (body.includes(repoPath) || body.includes(basename(repoPath))) out.triggers.push({ kind: "launchd", file: join(la, p), interval: body.match(/StartInterval<\/key>\s*<integer>(\d+)/)?.[1] ?? (body.includes("StartCalendarInterval") ? "calendar" : null) }); } catch { /* ignore */ } }
  }
  // Claude Code loop/schedule mentions in docs
  for (const f of files.filter((f) => /\.md$/.test(f))) {
    const t = read(f); if (!t) continue;
    for (const m of t.matchAll(/\/loop\s+(\d+[smh])/g)) out.triggers.push({ kind: "claude-loop-interval", file: f, cadence: m[1] });
    // Cloud routines / scheduled agents are declared outside the repo; the governing docs usually name them.
    // Only governing files count — grill notes and research files mention "routine" constantly.
    if (/(^|\/)(CLAUDE|AGENTS|LOOPS?[-_A-Z]*|LOOP-[A-Z-]+|ORCHESTRATOR[-_A-Z]*|RESUME|README)\.md$/i.test(f))
      for (const m of t.matchAll(/(?:\/schedule(?![\/\w-])|scheduled (?:agent|routine)|cloud routine|routine (?:fires|wakes|runs)|ScheduleWakeup)[^\n]{0,120}/gi)) out.triggers.push({ kind: "cloud-routine-mention", file: f, line: lineOf(t, m.index), text: m[0].slice(0, 140) });
    for (const m of t.matchAll(/(?:tick|wake|cadence)[^\n.]{0,40}?(\d+)\s*(?:-|\s)?(min(?:ute)?s?|hours?|h\b)/gi)) out.triggers.push({ kind: "documented-cadence", file: f, cadence: `${m[1]} ${m[2]}`, line: lineOf(t, m.index) });
  }

  // ------------------------------------------------------------ drivers
  for (const f of files.filter((f) => /\.(sh|ps1|py|mjs|js|ts)$/.test(f) && !/test|spec|node_modules/.test(f))) {
    const t = read(f); if (!t || t.length > 400e3) continue;
    const callsClaude = /\bclaude\s+(-p|--print)/.test(t) || /\bclaude\b.*\/loop/.test(t);
    const loops = /\bwhile\s+(true|\$|\[|:)|\bfor\s+.*\bin\b.*\.\./.test(t) || /for\s*\(\s*\$i|foreach|range\(/.test(t);
    const sleeps = /\bsleep\b|Start-Sleep|time\.sleep/.test(t);
    const namedLikeDriver = /(^|\/)(loop(-run|-driver)?|orchestrat\w*|tick|wake)\.(sh|ps1|py|mjs|js|ts)$/i.test(f);
    if (callsClaude || namedLikeDriver || (loops && sleeps && /loop|tick|wake/i.test(f + t.slice(0, 2000)))) {
      const stops = [...t.matchAll(/(STATUS:\s*[A-Z-]+|MVP-COMPLETE|NEEDS-HUMAN|budget\.exhausted|exit\s+[01])/g)].map((m) => m[1]);
      out.drivers.push({ file: f, callsClaude, loops, sleeps, stopMarkers: [...new Set(stops)], lines: t.split("\n").length });
      const sw = [...t.matchAll(/\|\|\s*true|2>\s*\/dev\/null|-ErrorAction\s+SilentlyContinue|except\s*:\s*pass/g)];
      if (sw.length) out.checks.swallowedErrors.push({ file: f, count: sw.length, lines: sw.slice(0, 5).map((m) => lineOf(t, m.index)) });
    }
  }
  for (const d of out.drivers.filter((d) => d.file.endsWith(".ps1"))) {
    const stem = d.file.replace(/\.ps1$/, "");
    if (!files.some((f) => f === stem + ".sh" || f === stem + ".py" || f === stem + ".mjs")) out.checks.singleOsDrivers.push({ file: d.file, note: "PowerShell-only driver; no .sh/.py sibling" });
  }

  // ------------------------------------------------------------ docs, skills, agents
  const docRe = /(^|\/)(LOOPS?([-_][A-Z-]+)?|LOOP-[A-Z-]+|ORCHESTRATOR[-_A-Z]*|DEFINITION-OF-DONE|HUMAN-GATES-LOG|RESUME|DoD)\.md$/i;
  for (const f of files) {
    if (docRe.test(f)) out.docs.push(docEntry(f, read(f)));
    else if (/(^|\/)(CLAUDE|AGENTS)\.md$/.test(f)) { const t = read(f); const secs = loopSections(t); if (secs.length) out.docs.push({ ...docEntry(f, t), loopSections: secs }); }
    else if (/\.claude\/skills\/[^/]*(loop|orchestrat|tick|routine)[^/]*\/SKILL\.md$/i.test(f) || /\.claude\/commands\/[^/]*(loop|tick)[^/]*\.md$/i.test(f) || /\.agents\/skills\/[^/]*loop[^/]*\/SKILL\.md$/i.test(f)) out.skills.push(docEntry(f, read(f)));
    else if (/\.claude\/agents\/[^/]+\.md$/.test(f)) { const t = read(f) ?? ""; out.agents.push({ file: f, name: basename(f, ".md"), tools: t.match(/^tools:\s*(.+)$/m)?.[1] ?? null, readOnly: /^tools:.*$/m.test(t) && !/Write|Edit|Bash/.test(t.match(/^tools:.*$/m)?.[0] ?? "") }); }
    else if (/docs\/specs\/LOOP_CONTRACT|loop-orchestrator\.md$|LOOP_CONTRACT/i.test(f)) out.docs.push(docEntry(f, read(f)));
  }
  // optional per-project manifest: .claude/loop-doctor.json { intent, queue: [...], governing: [...] }
  let manifest = {};
  try { manifest = JSON.parse(read(".claude/loop-doctor.json") ?? "{}"); } catch { out.warnings.push(".claude/loop-doctor.json is not valid JSON — ignored."); }
  out.manifest = Object.keys(manifest).length ? manifest : null;
  for (const g of manifest.governing ?? []) if (files.includes(g) && !out.docs.some((d) => d.file === g)) out.docs.push({ ...docEntry(g, read(g)), pinned: true });

  // purpose anchor: the project's stated *why* — wherever it lives. Manifest wins; then common file names; then a section.
  out.intent = null;
  let intentFile = manifest.intent && (files.includes(manifest.intent) || existsSync(abs(manifest.intent.split("#")[0]))) ? manifest.intent
    : files.find((f) => /^(intent|INTENT|OBJECTIVE|CHARTER|VISION|PURPOSE|CONTEXT)\.md$/.test(f)) ?? files.find((f) => /^docs\/(intent|INTENT|OBJECTIVE|CHARTER|VISION|PURPOSE|CONTEXT)\.md$/.test(f)) ?? null;
  if (manifest.intent && !intentFile) out.warnings.push(`manifest names intent "${manifest.intent}" but it does not exist.`);
  // Intent is sometimes a section, not a file: "## Objective — …" at the top of the roadmap or README.
  if (!intentFile) for (const f of ["ROADMAP.md", "docs/ROADMAP.md", "README.md", "CLAUDE.md"]) { const t = read(f); const m = t?.match(/^##\s+(Objective|Intent|Purpose|Mission|North star)\b.*$/mi); if (m) { intentFile = `${f}#${m[1]}`; break; } }
  if (intentFile || out.docs.length) {
    const govNames = [...out.docs, ...out.skills].map((d) => d.file);
    const refs = [];
    const needle = !intentFile ? "(intent\\.md|## Objective)" : intentFile.includes("#") ? `\\b${escapeRe(intentFile.split("#")[1])}\\b` : escapeRe(basename(intentFile));
    for (const g of govNames) { if (intentFile && g === intentFile.split("#")[0]) continue; const t = read(g) ?? ""; const m = t.match(new RegExp(needle, "i")); if (m) refs.push({ file: g, line: lineOf(t, m.index) }); }
    const objectiveStep = govNames.some((g) => /objective (loop|review)|re-?plan|empty queue|queue (is|runs|becomes) (empty|dry)|no unblocked|nothing (left|to do)|steady state/i.test(read(g) ?? ""));
    let agentWrites = null;
    if (git && intentFile) { try { const authors = sh(`git log --format=%an -- "${intentFile}"`).split("\n").filter(Boolean); agentWrites = { commits: authors.length, authors: [...new Set(authors)].slice(0, 5) }; } catch { /* none */ } }
    out.intent = { file: intentFile, referencedBy: refs, emptyQueueOrObjectiveRule: objectiveStep, history: agentWrites };
  }

  // what a tick actually loads: CLAUDE.md, @-imports, loop skills
  const claude = read("CLAUDE.md");
  if (claude) { out.checks.loadedFiles.push("CLAUDE.md"); for (const m of claude.matchAll(/^@([\w./-]+)/gm)) out.checks.loadedFiles.push(m[1]); }
  for (const s of out.skills) out.checks.loadedFiles.push(s.file);

  // ------------------------------------------------------------ state files
  const govText = [...out.docs, ...out.skills].map((d) => read(d.file) ?? "").join("\n") + out.drivers.map((d) => read(d.file) ?? "").join("\n");
  const stateCandidates = new Set();
  for (const m of govText.matchAll(/([\w./-]*(?:STATUS|QUEUE|STATE|LOG|RESUME|BACKLOG|journal|loop-log|metrics)[\w.-]*\.(?:md|jsonl?|db|yaml))/gi)) stateCandidates.add(m[1].replace(/^\.\//, ""));
  const seenState = new Set();
  for (const c of stateCandidates) {
    const p = files.find((f) => f === c || f.endsWith("/" + c) || basename(f) === basename(c));
    if (!p || seenState.has(p)) continue; seenState.add(p);
    const t = read(p); if (t == null) continue;
    const lines = t.split("\n").length;
    const entry = { file: p, lines, bytes: Buffer.byteLength(t), readFirst: /read(s)?\s+(this|it|[`'"]?[\w./-]*\/?[\w.-]*[`'"]?)\s+first/i.test(govText) && new RegExp(escapeRe(basename(p)) + "[^\\n]{0,80}first|first[^\\n]{0,80}" + escapeRe(basename(p)), "i").test(govText), growth: null, sentinels: [] };
    if (git) { try { const shas = sh(`git log --format=%h -n 8 -- "${p}"`).split("\n").filter(Boolean); const pts = []; for (const s of shas.reverse()) { try { pts.push({ sha: s, lines: sh(`git show ${s}:"${p}"`).split("\n").length }); } catch { /* skip */ } } if (pts.length > 1) entry.growth = { first: pts[0], last: pts.at(-1), delta: pts.at(-1).lines - pts[0].lines, points: pts.length }; } catch { /* no history */ } }
    // sentinels: terminal markers followed by more content
    const sent = [...t.matchAll(/^(?:#+\s*)?(?:\*\*)?STATUS:\s*([A-Z][A-Z-]+)/gm)].map((m) => ({ line: lineOf(t, m.index), value: m[1] }));
    if (sent.length) {
      const lastTerminalIdx = sent.map((s, i) => (/COMPLETE|DONE|HALT|FINISHED|STOPPED/.test(s.value) ? i : -1)).filter((i) => i >= 0).pop();
      if (lastTerminalIdx != null) { const term = sent[lastTerminalIdx]; const after = t.split("\n").slice(term.line).filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith(">")).length; if (after > 0) out.checks.sentinels.push({ file: p, terminal: term, entriesAfter: after, note: "content appended after a terminal sentinel — a driver that greps for it is permanently tripped" }); }
      entry.sentinels = sent;
    }
    out.stateFiles.push(entry);
  }

  // ------------------------------------------------------------ repeated sentences across governing files
  const govFiles = [...new Set([...out.docs, ...out.skills].map((d) => d.file))];
  const bySentence = new Map();
  for (const f of govFiles) {
    const t = read(f) ?? "";
    const seen = new Set();
    for (const s of t.replace(/```[\s\S]*?```/g, "").split(/(?<=[.!?])\s+|\n+/)) {
      const norm = s.replace(/[`*_>|#-]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
      if (norm.length < 60 || seen.has(norm)) continue; seen.add(norm);
      (bySentence.get(norm) ?? bySentence.set(norm, []).get(norm)).push({ file: f, line: lineOf(t, t.indexOf(s.trim().slice(0, 40))) });
    }
  }
  for (const [norm, where] of bySentence) if (new Set(where.map((w) => w.file)).size > 1) out.checks.repeatedSentences.push({ sentence: norm.slice(0, 140), where });
  out.checks.repeatedSentences.sort((a, b) => b.where.length - a.where.length);
  out.checks.repeatedSentences = out.checks.repeatedSentences.slice(0, 40);

  // ------------------------------------------------------------ dangling references
  for (const f of govFiles) {
    const t = read(f) ?? "";
    for (const m of t.matchAll(/(?<![\w@/])((?:\.{1,2}\/)?(?:[\w.-]+\/)+[\w.-]+\.(?:md|sh|ps1|py|mjs|js|ts|ya?ml|json|sql|db))(?![\w/])/g)) {
      const ref = m[1].replace(/^\.\//, "");
      if (/^https?:|node_modules|\$\{|<|>|\*/.test(ref)) continue;
      if (ref.split("/").slice(0, -1).some((seg) => /\.\w{1,5}$/.test(seg))) continue; // "a.ts/b.ts" is prose listing alternatives, not a path
      if (/^(dist|build|logs?|out|\.cache|coverage|tmp)\//.test(ref)) continue;      // build outputs are generated, not referenced sources
      const cands = [ref, join(dirname(f), ref), ref.replace(/^\.\.\//, "")];
      if (cands.some((c) => existsSync(abs(c)))) continue;
      // Same trailing path exists elsewhere → probably moved or written relative to another root; report as such, not as dead.
      const tail = ref.split("/").slice(-2).join("/");
      const elsewhere = files.find((x) => x.endsWith("/" + tail) || x === tail);
      out.checks.danglingRefs.push({ file: f, line: lineOf(t, m.index), ref, ...(elsewhere ? { existsAt: elsewhere } : {}) });
    }
  }
  const dedup = new Map(); for (const d of out.checks.danglingRefs) { const k = d.file + "|" + d.ref; if (!dedup.has(k)) dedup.set(k, d); } out.checks.danglingRefs = [...dedup.values()].slice(0, 60);

  // ------------------------------------------------------------ number disagreements for the same phrase
  const numByKey = new Map();
  const numRe = /\b(every|max(?:imum)?|at most|≤|<=|no more than|up to|after|within)\s*(\d+)(?:st|nd|rd|th)?\s*([a-z-]+(?:\s+[a-z-]+)?)/gi;
  for (const f of govFiles) {
    const t = read(f) ?? "";
    for (const m of t.matchAll(numRe)) {
      if (/^(min|hour)/i.test(m[3])) continue; // time units are handled as cadence below
      const key = `${m[1].toLowerCase().replace(/maximum/, "max")} … ${m[3].toLowerCase().replace(/s$/, "")}`;
      (numByKey.get(key) ?? numByKey.set(key, []).get(key)).push({ file: f, line: lineOf(t, m.index), value: Number(m[2]), text: m[0] });
    }
    // Cadence only where the sentence is about the schedule — bare "37 minutes" in a log line is a duration, not a cadence.
    for (const m of t.matchAll(/\b(?:every|each|tick(?:s)?|wake(?:s)?|cadence|interval)\b[^\n.]{0,40}?\b(\d+)\s*(min(?:ute)?s?|hours?|h)\b/gi)) { const key = `cadence … ${m[2].toLowerCase().startsWith("h") ? "hour" : "minute"}`; (numByKey.get(key) ?? numByKey.set(key, []).get(key)).push({ file: f, line: lineOf(t, m.index), value: Number(m[1]), text: m[0] }); }
  }
  for (const [key, hits] of numByKey) { const vals = new Set(hits.map((h) => h.value)); if (vals.size > 1 && new Set(hits.map((h) => h.file)).size > 1) out.checks.numberDisagreements.push({ phrase: key, values: [...vals], hits: hits.slice(0, 8) }); }

  // ------------------------------------------------------------ queue sharpness
  // Open items in backlog/roadmap/queue files: how many state an acceptance test, how many are judgement-worded.
  out.sharpness = null;
  const queueFiles = (manifest.queue?.length ? manifest.queue.filter((q) => files.includes(q)) : files.filter((f) => /(^|\/)(BACKLOG|LOOP-QUEUE|ROADMAP|TODO|TASKS)[\w-]*\.md$/i.test(f) && !/archive/i.test(f))).slice(0, 4);
  if (queueFiles.length) {
    const open = [];
    for (const f of queueFiles) {
      const t = read(f) ?? ""; const lines = t.split("\n");
      lines.forEach((l, i) => {
        const box = l.match(/^\s*- \[ \]\s*(.+)$/);
        const row = l.match(/^\|\s*([A-Z]{1,8}-?\d+[\w.-]*)\s*\|(.*)$/);
        let text = null, id = null;
        if (box) { text = box[1]; id = text.match(/^\**([A-Z]{1,8}-?\d+[\w.-]*)/)?.[1] ?? null; }
        else if (row && /\|\s*(open|todo|active|planned|next|doing)\s*\|/i.test(l)) { id = row[1]; text = row[2].split("|")[0].trim(); }
        if (!text) return;
        const plain = stripMd(text).slice(0, 160);
        // continuation lines belong to the item only while they are indented and not a new bullet/row
        const cont = [lines[i + 1], lines[i + 2]].filter((x) => x && /^\s{2,}/.test(x) && !/^\s*- \[|^\s*\|/.test(x)).join(" ");
        const hasAcceptance = /\b(accept(ance)?|exit|done when|until|criteri|test:|assert|verify|measure|≥|<=|>=|\d+\s*%)\b/i.test(l + " " + cont);
        const ambiguous = /\b(improve|look (at|into)|consider|explore|clean ?up|review|investigate|tidy|refactor|better|enhance|polish)\b/i.test(plain) && !/\b(so that|until|to \d|by \d|≥|<=|>=|\d+\s*%)\b/i.test(plain);
        open.push({ file: f, line: i + 1, id, text: plain, hasAcceptance, ambiguous });
      });
    }
    if (open.length) {
      out.sharpness = {
        files: queueFiles, openItems: open.length,
        withAcceptance: open.filter((o) => o.hasAcceptance).length,
        ambiguous: open.filter((o) => o.ambiguous).length,
        ambiguousItems: open.filter((o) => o.ambiguous).slice(0, 12),
        sample: open.slice(0, 5),
      };
    }
  }

  // ------------------------------------------------------------ verdict on presence
  if (!out.triggers.length && !out.drivers.length && !out.docs.length && !out.skills.length) out.warnings.push("No scheduled-loop trigger, driver or loop documents found — this project may not have an autonomous loop.");
  if (!out.triggers.length && (out.drivers.length || out.docs.length)) out.warnings.push("Loop documents/drivers exist but no scheduler entry was found on this machine (no cron, launchd, or workflow schedule) — the cadence may be manual or live elsewhere.");
  if (out.drivers.length > 1) out.warnings.push(`${out.drivers.length} driver-like scripts found — check whether more than one is live.`);
  out.receipt = { filesScanned: files.length, governingFilesRead: [...new Set([...out.docs, ...out.skills, ...out.drivers].map((d) => d.file))].length, stateFilesReadWhole: 0, runtimeMs: Date.now() - t0 };
  return out;
}

function docEntry(f, t) { return { file: f, lines: (t ?? "").split("\n").length, headings: [...(t ?? "").matchAll(/^##\s+(.+)$/gm)].map((m) => m[1]).slice(0, 40) }; }
function loopSections(t) {
  if (!t) return [];
  const out = []; const lines = t.split("\n");
  lines.forEach((l, i) => { const h = l.match(/^#{1,3}\s+(.+)$/); if (h && /loop|tick|wake|cadence|autonom|orchestrat|routine|schedule/i.test(h[1])) out.push({ heading: h[1], line: i + 1 }); });
  return out;
}
function lineOf(t, idx) { return idx < 0 ? null : t.slice(0, idx).split("\n").length; }
function stripMd(s) { return (s ?? "").replace(/\*\*|`|~~/g, "").trim(); }
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// ------------------------------------------------------------ self-test
function selfTest() {
  const root = join(HERE, "..", "fixtures");
  let failed = 0, total = 0;
  const get = (o, p) => p.split(".").reduce((x, k) => (x == null ? undefined : x[/^\d+$/.test(k) ? Number(k) : k]), o);
  for (const name of readdirSync(root).sort()) {
    const dir = join(root, name); if (!statSync(dir).isDirectory()) continue;
    const exp = JSON.parse(readFileSync(join(dir, "expect.json"), "utf8"));
    const inv = inventory(dir, { git: false, system: false });
    let bad = 0;
    for (const [p, want] of Object.entries(exp)) { total++; const got = get(inv, p); const ok = typeof want === "object" && want !== null ? JSON.stringify(got) === JSON.stringify(want) : got === want; if (!ok) { bad++; failed++; console.log(`✗ ${name}: ${p}\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(got)}`); } }
    console.log(`${bad ? "·" : "✓"} ${name}`);
  }
  console.log(`\n${total - failed}/${total} assertions passed`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) selfTest();
  else {
    const repo = args.find((a) => !a.startsWith("--")) ?? process.cwd();
    const inv = inventory(repo);
    if (!args.includes("--json-only") && inv.warnings.length) process.stderr.write(inv.warnings.map((w) => "! " + w).join("\n") + "\n");
    process.stdout.write(JSON.stringify(inv, null, 2));
  }
}
