#!/usr/bin/env node
// kev-gate harvest: labelled review-depth cases from a repo's own history.
//
// Usage: node harvest.mjs <repo> [--since 180.days] [--settle-days 14]
//          [--window-days 7] [--exclude <regex>] [--max 120] [--hub 0.1]
//          [--labels <file.jsonl>] [--fit]
//        node harvest.mjs --self-test
//
// --fit     Run this BEFORE designing a gate. Prints the label's base rate,
//           the rate per area of the repo, and how well a zero-cost path
//           prior ranks the cases (AUC, leave-one-out). No model calls.
//             AUC >= 0.70  the paths predict the label: write a glob (tier 0)
//             AUC <  0.60  nothing cheap predicts it: the label is probably
//                          noise for this repo; do not design a gate on it
//           These cuts are rules of thumb, stated so they can be argued with.
// --labels  Use the project's own outcome record instead of the fix-blame
//           proxy: JSONL rows {"sha": "...", "want": "<action>", "why": "..."}
//           (a review that found something, a grill that refuted a slice).
//           A recorded outcome beats an inferred one whenever it exists.
//
// Read-only: runs `git log` and `git show --stat` in <repo>, writes JSONL to
// stdout. A case is one commit; its state is what a driver would send
// (subject + `--stat`, cut to 1500 chars).
//
// The label is a PROXY and the note on every line says which one fired:
//   deep-review   the commit was reverted, or it was the MOST RECENT earlier
//                 commit to touch a code file that a fix-like commit then
//                 touched within --window-days (a fix blames the last
//                 toucher, not everyone who was near the file that week)
//   light-review  neither happened, and the commit is older than
//                 --settle-days so a follow-up had time to appear
// "Needed a follow-up" is not "was risky": churny files attract fixes whatever
// the change was. Hub files (touched by more than --hub of all commits:
// roadmaps, logs, changelogs) and prose files (--prose, default md/mdx/txt/
// log) are ignored when matching, and bookkeeping commits can be dropped with
// --exclude. Read a sample before trusting it — the first version of this
// rule labelled 57% of a real repo deep off one fix to one governance file.

import { execFileSync } from "node:child_process";
import { realpathSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FIXLIKE = /^(fix|hotfix|bugfix)\b|^revert\b|\bregression\b|\bbroke\b|\bbroken by\b|\bfix-?up\b/i;
const MAX_STATE = 1500;
const PROSE = /\.(md|mdx|txt|log)$/i;

const git = (repo, args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", maxBuffer: 1 << 28 });

export function parseLog(text) {
  // records separated by \x1e; header "sha\tct\tsubject", then file names
  return text.split("\x1e").map((r) => r.trim()).filter(Boolean).map((r) => {
    const [head, ...files] = r.split("\n");
    const [sha, ct, ...subj] = head.split("\t");
    return { sha, ct: Number(ct), subject: subj.join("\t"), files: files.map((f) => f.trim()).filter(Boolean) };
  });
}

export function label(commits, { windowDays = 7, settleDays = 14, hub = 0.1, exclude = null, prose = PROSE, now = Date.now() / 1000 } = {}) {
  const freq = new Map();
  for (const c of commits) for (const f of c.files) freq.set(f, (freq.get(f) || 0) + 1);
  const hubs = new Set([...freq].filter(([, n]) => n / commits.length > hub).map(([f]) => f));
  const byTime = [...commits].sort((a, b) => a.ct - b.ct);
  const reverted = new Map();
  for (const d of byTime) {
    const m = d.subject.match(/^Revert "(.*)"$/);
    if (m) reverted.set(m[1], d.sha);
  }
  const matchable = (f) => !hubs.has(f) && !prose.test(f);
  const isCase = (c) => !(exclude && exclude.test(c.subject)) && !FIXLIKE.test(c.subject);
  // Walk forward keeping, per file, the last non-fix commit that touched it.
  // When a fix-like commit touches that file inside the window, blame that one.
  const lastToucher = new Map(), blamed = new Map();
  for (const d of byTime) {
    if (FIXLIKE.test(d.subject)) {
      for (const f of d.files.filter(matchable)) {
        const c = lastToucher.get(f);
        if (c && d.ct - c.ct <= windowDays * 86400 && !blamed.has(c.sha))
          blamed.set(c.sha, "fix-like " + d.sha.slice(0, 8) + " touched " + f + " within " + Math.ceil((d.ct - c.ct) / 86400) + "d");
      }
    } else if (isCase(d)) for (const f of d.files.filter(matchable)) lastToucher.set(f, d);
  }
  const out = [];
  for (const c of byTime) {
    if (!isCase(c)) continue;
    if (!c.files.some(matchable)) continue;             // only hub or prose files: nothing to match on
    const why = reverted.has(c.subject) ? "reverted by " + reverted.get(c.subject).slice(0, 8) : blamed.get(c.sha) || null;
    if (!why && now - c.ct < settleDays * 86400) continue; // too recent to call quiet
    out.push({ sha: c.sha, subject: c.subject, want: why ? "deep-review" : "light-review", why: why || "no revert or fix-like follow-up" });
  }
  return { cases: out, hubs: [...hubs] };
}

// Keep every deep case (newest first) up to half of max, then an evenly
// spaced sample of light ones — deterministic, no Math.random.
export function sample(cases, max) {
  const deep = cases.filter((c) => c.want === "deep-review").reverse().slice(0, Math.floor(max / 2));
  const light = cases.filter((c) => c.want === "light-review");
  const n = Math.min(light.length, max - deep.length);
  const step = light.length / Math.max(n, 1);
  const picked = Array.from({ length: n }, (_, k) => light[Math.floor(k * step)]);
  return [...deep, ...picked];
}

// Area of a path: two segments, three under a monorepo's packages/ or apps/.
export function area(path, prose = PROSE) {
  if (prose.test(path)) return "(prose)";
  const parts = path.replace(/^\.\//, "").split("/");
  if (parts.length === 1) return parts[0];
  return parts.slice(0, parts[0] === "packages" || parts[0] === "apps" ? 3 : 2).join("/");
}

// Exact AUC by rank-sum (ties get the mean rank): the chance a positive case
// outranks a negative one. 0.5 is a coin.
export function auc(scores, labels) {
  const idx = scores.map((s, i) => i).sort((a, b) => scores[a] - scores[b]);
  const rank = new Array(scores.length);
  for (let i = 0; i < idx.length;) {
    let j = i; while (j + 1 < idx.length && scores[idx[j + 1]] === scores[idx[i]]) j++;
    for (let k = i; k <= j; k++) rank[idx[k]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  const pos = labels.filter(Boolean).length, neg = labels.length - pos;
  if (!pos || !neg) return null;
  const sum = labels.reduce((t, l, i) => t + (l ? rank[i] : 0), 0);
  return (sum - pos * (pos + 1) / 2) / (pos * neg);
}

// cases: [{files, positive}]. The prior for a case is the highest positive
// rate among the areas it touches, computed WITHOUT that case.
export function fit(cases, { minArea = 5 } = {}) {
  const n = new Map(), d = new Map();
  const areasOf = cases.map((c) => [...new Set(c.files.map((f) => area(f)))]);
  cases.forEach((c, i) => areasOf[i].forEach((a) => { n.set(a, (n.get(a) || 0) + 1); if (c.positive) d.set(a, (d.get(a) || 0) + 1); }));
  const scores = cases.map((c, i) => Math.max(0, ...areasOf[i].map((a) => {
    const nn = n.get(a) - 1, dd = (d.get(a) || 0) - (c.positive ? 1 : 0);
    return nn >= minArea ? dd / nn : 0;
  })));
  const labels = cases.map((c) => c.positive);
  const pos = labels.filter(Boolean).length;
  const a = auc(scores, labels);
  const verdict = a === null ? "one class only: nothing to predict"
    : a >= 0.7 ? "paths predict the label: write a glob (tier 0), not a gate"
    : a < 0.6 ? "nothing cheap predicts this label: it is probably noise for this repo; do not design a gate on it"
    : "weak path signal: a gate must beat this AUC on the tune set to be worth a moving part";
  return {
    cases: cases.length, positive: pos, base_rate: +(pos / cases.length).toFixed(2),
    path_prior_auc: a === null ? null : +a.toFixed(2), verdict,
    areas: [...n].sort((x, y) => y[1] - x[1]).slice(0, 12).map(([name, k]) => ({ area: name, n: k, rate: +((d.get(name) || 0) / k).toFixed(2) })),
  };
}

const flag = (argv, name, dflt) => { const i = argv.indexOf(name); return i < 0 ? dflt : argv[i + 1]; };

function main(argv) {
  if (argv[0] === "--self-test") return selfTest();
  const repo = argv[0];
  if (!repo) { console.error("usage: harvest.mjs <repo> [--since 180.days] [--settle-days 14] [--window-days 7] [--exclude <regex>] [--max 120] [--hub 0.1]"); return 2; }
  const opts = {
    windowDays: Number(flag(argv, "--window-days", 7)), settleDays: Number(flag(argv, "--settle-days", 14)),
    hub: Number(flag(argv, "--hub", 0.1)), exclude: flag(argv, "--exclude") ? new RegExp(flag(argv, "--exclude")) : null,
    prose: flag(argv, "--prose") ? new RegExp(flag(argv, "--prose")) : PROSE,
  };
  const log = git(repo, ["log", "--no-merges", "--since=" + flag(argv, "--since", "180.days"), "--format=%x1e%H%x09%ct%x09%s", "--name-only"]);
  const commits = parseLog(log);
  let { cases, hubs } = label(commits, opts);
  const lowest = flag(argv, "--lowest", "light-review");
  if (flag(argv, "--labels")) {
    // The project's own outcomes replace the proxy. Match on sha prefix.
    const own = readFileSync(flag(argv, "--labels"), "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("//")).map((l) => JSON.parse(l));
    cases = own.map((o) => { const c = commits.find((x) => x.sha.startsWith(o.sha)); return c && { sha: c.sha, subject: c.subject, want: o.want, why: o.why || "recorded outcome" }; }).filter(Boolean);
  }
  if (argv.includes("--fit")) {
    const files = new Map(commits.map((c) => [c.sha, c.files]));
    console.log(JSON.stringify({ label: flag(argv, "--labels") ? "recorded outcomes" : "fix-blame proxy", ...fit(cases.map((c) => ({ files: files.get(c.sha), positive: c.want !== lowest }))) }, null, 2));
    return 0;
  }
  // Recorded outcomes may use any action names; only the proxy is sampled.
  const max = Number(flag(argv, "--max", 120));
  const picked = flag(argv, "--labels") ? cases.slice(0, max) : sample(cases, max);
  for (const c of picked) {
    const stat = git(repo, ["show", "--stat=100", "--format=", c.sha]).split("\n").slice(0, 11).join("\n");
    const diff = (c.subject + "\n" + stat).slice(0, MAX_STATE);
    console.log(JSON.stringify({ state: { change: { diff } }, want: c.want, note: c.sha.slice(0, 8) + " " + c.why }));
  }
  const deep = picked.filter((c) => c.want !== lowest).length;
  console.error(JSON.stringify({ labelled: cases.length, deep_total: cases.filter((c) => c.want === "deep-review").length, written: picked.length, written_deep: deep, hub_files_ignored: hubs.slice(0, 8) }));
  return 0;
}

function selfTest() {
  let failed = 0;
  const check = (name, ok) => { if (!ok) failed++; console.log((ok ? "ok   " : "FAIL ") + name); };
  const day = 86400, t0 = 1_000_000;
  const log = [
    "\x1eaaa\t" + t0 + "\tfeat: cart total\nsrc/cart.ts\nROADMAP.md",
    "\x1ebbb\t" + (t0 + day) + "\tfix: cart total rounds wrong\nsrc/cart.ts",
    "\x1eccc\t" + (t0 + 2 * day) + "\tfeat: quiet helper\nsrc/quiet.ts\nROADMAP.md",
    "\x1ehhh\t" + (t0 - 2 * day) + "\tfeat: cart skeleton\nsrc/cart.ts",
    "\x1eiii\t" + (t0 + 2 * day) + "\tdocs: readme\nREADME.md",
    "\x1eddd\t" + (t0 + 3 * day) + "\tfeat: tooltip\nsrc/tip.ts\nROADMAP.md",
    "\x1eeee\t" + (t0 + 20 * day) + "\tRevert \"feat: tooltip\"\nsrc/tip.ts",
    "\x1efff\t" + (t0 + 4 * day) + "\tchore(loops): record\nROADMAP.md",
    "\x1eggg\t" + (t0 + 40 * day) + "\tfeat: brand new\nsrc/new.ts\nROADMAP.md",
  ].join("\n");
  const commits = parseLog(log);
  check("parses sha, time, subject with tabs-free fields, files", commits.length === 9 && commits[0].files.length === 2 && commits[0].ct === t0);
  const { cases, hubs } = label(commits, { hub: 0.5, now: t0 + 41 * day });
  const by = Object.fromEntries(cases.map((c) => [c.sha, c]));
  check("hub file is ignored for matching", hubs.includes("ROADMAP.md") && !hubs.includes("src/cart.ts"));
  check("fix-like follow-up on the same file → deep", by.aaa?.want === "deep-review" && /bbb/.test(by.aaa.why));
  check("a fix blames only the last toucher, not everyone in the window", by.hhh?.want === "light-review");
  check("a fix is not itself a case", !by.bbb);
  check("prose-only commit is dropped", !by.iii);
  check("quiet commit → light", by.ccc?.want === "light-review");
  check("revert outside the window still → deep", by.ddd?.want === "deep-review" && /reverted/.test(by.ddd.why));
  check("hub-only commit is dropped", !by.fff);
  check("too recent to call quiet is dropped", !by.ggg);
  check("exclude drops bookkeeping", !label(commits, { hub: 0.5, now: t0 + 41 * day, exclude: /quiet/ }).cases.some((c) => c.sha === "ccc"));
  check("area: two segments, three under packages/ and apps/, prose folded", area("src/cart/a.ts") === "src/cart" && area("packages/core/src/x.css") === "packages/core/src" && area("docs/a.md") === "(prose)" && area("README") === "README");
  check("auc: perfect, inverted, tied, one-class", auc([1, 2, 3, 4], [false, false, true, true]) === 1 && auc([4, 3, 2, 1], [false, false, true, true]) === 0 && auc([1, 1, 1, 1], [false, true, false, true]) === 0.5 && auc([1, 2], [true, true]) === null);
  const hot = Array.from({ length: 12 }, (_, i) => ({ files: ["db/migrations/" + i + ".sql"], positive: i < 10 }));
  const cold = Array.from({ length: 12 }, (_, i) => ({ files: ["src/ui/" + i + ".css"], positive: i < 1 }));
  const f1 = fit([...hot, ...cold]);
  check("fit: a hot area is found and the verdict says glob", f1.path_prior_auc >= 0.7 && /glob/.test(f1.verdict) && f1.areas.some((a) => a.area === "db/migrations" && a.rate > 0.5));
  const flat = Array.from({ length: 40 }, (_, i) => ({ files: [(i % 2 ? "a/x/" : "b/y/") + i + ".ts"], positive: i % 4 < 2 }));   // half of each area: no area is hotter
  check("fit: a flat label is called noise", fit(flat).path_prior_auc < 0.6 && /noise/.test(fit(flat).verdict));
  const many = Array.from({ length: 50 }, (_, i) => ({ sha: "s" + i, want: i % 10 === 0 ? "deep-review" : "light-review" }));
  const s = sample(many, 10);
  check("sample keeps deep cases and is deterministic", s.filter((c) => c.want === "deep-review").length === 5 && s.length === 10 && JSON.stringify(s) === JSON.stringify(sample(many, 10)));
  console.log(failed ? failed + " failed" : "all passed");
  return failed ? 1 : 0;
}

const isMain = process.argv[1] && (() => {
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); }
  catch { return false; }
})();
if (isMain) process.exitCode = main(process.argv.slice(2));
