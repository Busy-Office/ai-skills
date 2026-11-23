#!/usr/bin/env node
// Drift check across collectors.
//
//   node evals/consistency.mjs
//
// The collectors are deliberately self-contained — the README tells you to
// symlink a single skill — so shared knowledge lives as copies, and copies
// drift. This asserts the copies still agree on the things that must not
// differ, and names every collector that would answer a question differently
// from its siblings.
//
// It exists because the record-file pattern was widened in one collector and
// left stale in three others within the hour, which is the exact defect
// loop-doctor was written to find in other people's projects.
//
// Second check: every skill the repo names exists. It reads the files
// `git ls-files` lists (tracked only, symlinks skipped), takes the skill,
// playbook and reference names from that same list, and counts as a name:
// `busy-office:<x>` and a backticked `principle-<x>` anywhere; a backticked
// hyphenated name in a SKILL.md; any backticked lowercase name in the mode's
// SKILL.md and playbooks; and, in README.md, AGENTS.md, CHANGELOG.md and
// skills/*/references/, a backticked hyphenated name within edit distance 2
// of a real skill (a typo such as `loop-docter`).

import { readFileSync, readdirSync, existsSync, lstatSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, basename, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILLS = join(HERE, "..", "skills");

// Each rule: what every collector that has an opinion on this must know.
// A collector with no opinion (no matching source at all) is skipped — not
// every collector needs every concept.
const RULES = [
  {
    name: "excludes git worktree copies",
    // A repo with worktrees duplicates its whole tree; any count that includes
    // them is inflated several-fold. This has produced two wrong numbers.
    applies: (src) => /const IGNORE\s*=\s*new Set/.test(src),
    holds: (src) => /"worktrees"/.test(src),
    why: "a count that walks .claude/worktrees/ reports the tree several times over",
  },
  {
    name: "main guard survives a symlinked install",
    // The README installs a single skill by symlink. A guard that compares the
    // raw argv path to import.meta.url never fires through one: the script
    // prints nothing and exits 0. Found in nine scripts on 2026-09-20.
    applies: (src) => /import\.meta\.url/.test(src) && /process\.argv\[1\]/.test(src),
    holds: (src) => /realpathSync\(fileURLToPath\(import\.meta\.url\)\)\s*===\s*realpathSync\(process\.argv\[1\]\)/.test(src),
    why: "run through a symlink the script silently does nothing and exits 0",
  },
  {
    name: "excludes node_modules",
    applies: (src) => /const IGNORE\s*=\s*new Set/.test(src),
    holds: (src) => /"node_modules"/.test(src),
    why: "vendored trees swamp any file count",
  },
  {
    name: "knows the append-only record files",
    // The loop's own bookkeeping is not code, not a queue, and not churn.
    // Two implementations are legitimate: a name list that must be kept
    // current, or discovery from what the governing docs actually name — which
    // needs no list at all. Only the first can drift, so only it is checked.
    applies: (src) => /\[\s*"record"\s*,\s*\/|RECORDS\s*=\s*\/|RECORD_FILE\s*=\s*\//.test(src),
    holds: (src) => {
      const discovers = /stateCandidates|matchAll\(\/\(\[\\w/.test(src);
      const listed = ["loop-log", "resume", "roundtable"].every((t) => src.toLowerCase().includes(t));
      return discovers || listed;
    },
    why: "a loop's log, resume file or .roundtable/ counted as code inflates churn and dilutes every per-commit rate",
  },
];

const collectors = [];
for (const skill of readdirSync(SKILLS).sort()) {
  const dir = join(SKILLS, skill, "scripts");
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".mjs"))) {
    collectors.push({ skill, file: join(dir, f), name: `${skill}/${basename(f)}` });
  }
}

let failed = 0, checked = 0;
const rows = [];
for (const rule of RULES) {
  const relevant = collectors.filter((c) => rule.applies(readFileSync(c.file, "utf8")));
  if (!relevant.length) continue;
  const bad = relevant.filter((c) => !rule.holds(readFileSync(c.file, "utf8")));
  checked++;
  if (bad.length) failed++;
  rows.push({ rule, of: relevant.length, bad });
}

for (const { rule, of: n, bad } of rows) {
  if (!bad.length) {
    console.log(`✓ ${rule.name} — all ${n} collectors that care agree`);
  } else {
    console.log(`✗ ${rule.name} — ${bad.length} of ${n} drifted`);
    console.log(`    why it matters: ${rule.why}`);
    for (const c of bad) console.log(`    · ${c.name}`);
  }
}
console.log(`\n${checked - failed}/${checked} shared rules consistent across ${collectors.length} collectors`);

// Every skill the repo names must exist. Skills point at each other
// (principles, the mode's playbooks, the loop-family map), so a renamed or
// removed skill leaves dangling pointers; animated-svg was named for months by
// a skill that nothing shipped. What counts as a reference: see the header.
// A one-word backticked name outside the mode cannot be told apart from a
// command, and prose such as "principle-based" is not a name.
const ROOT = join(HERE, "..");
const EXTERNAL_SKILLS = new Set([
  "explain-landing", "loop", // a repository's own skills, named as "the repository's own step"
  "artifact-design",         // Claude Code's own
]);
// Backticked hyphenated words that are not skills at all.
const NOT_SKILLS = new Set(["may-settle", "notion-fetch", "notion-update-page"]);
const BINARY = /\.(png|gif|jpe?g|webp|ico|pdf|woff2?)$/;

const isFile = (f) => { try { return lstatSync(f).isFile(); } catch { return false; } };
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
  .split("\0").filter((f) => f && isFile(join(ROOT, f))).map((f) => f.split("/"));
const files = tracked.map((p) => join(ROOT, ...p)).filter((f) => !BINARY.test(f));
// Names come from the same index as the files: an untracked skill on disk does not exist for a user.
const skillNames = new Set(tracked.filter((p) => p.length === 3 && p[0] === "skills" && p[2] === "SKILL.md").map((p) => p[1]));
const MODE = join(SKILLS, "busy-office-mode");
const playbookNames = new Set(tracked.filter((p) => p.length === 4 && p[1] === "busy-office-mode" && p[2] === "playbooks" && p[3].endsWith(".md")).map((p) => p[3].slice(0, -3)));
const refNames = (skill) => new Set(tracked.filter((p) => p[0] === "skills" && p[1] === skill && p[2] === "references" && p.length === 4).map((p) => p[3].replace(/\.[^.]+$/, "")));
const PROSE = new Set(["README.md", "AGENTS.md", "CHANGELOG.md"]);
const distance = (a, b) => {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
};
const nearMiss = (name) => [...skillNames].some((s) => distance(name, s) <= 2);

const dangling = [];
let refs = 0;
for (const file of files) {
  const rel = relative(ROOT, file);
  const skill = rel.split(sep)[1];
  const isSkill = rel === join("skills", skill ?? "", "SKILL.md");
  const closed = file.startsWith(MODE + sep) && file.endsWith(".md");
  const prose = PROSE.has(rel) || (rel.split(sep)[2] === "references" && rel.endsWith(".md"));
  const ownRefs = isSkill ? refNames(skill) : new Set();
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    const hyphenated = [...line.matchAll(/`([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`/g)].map((m) => m[1]);
    const found = [
      ...[...line.matchAll(/busy-office:([a-z0-9-]+)/g)].map((m) => [m[1], true]),
      ...[...line.matchAll(/`(principle-[a-z0-9]+(?:-[a-z0-9]+)*)`/g)].map((m) => [m[1], true]),
      ...(isSkill || closed ? hyphenated.map((n) => [n, false]) : []),
      ...(prose && !isSkill && !closed ? hyphenated.filter((n) => skillNames.has(n) || nearMiss(n)).map((n) => [n, false]) : []),
      ...(closed ? [...line.matchAll(/`([a-z][a-z0-9]*)`/g)].map((m) => [m[1], false]) : []),
    ];
    const named = new Map();   // one report per name per line; strict wins
    for (const [name, strict] of found) named.set(name, named.get(name) || strict);
    for (const [name, strict] of named) {
      refs++;
      if (skillNames.has(name) || EXTERNAL_SKILLS.has(name)) continue;
      if (!strict && (playbookNames.has(name) || ownRefs.has(name) || NOT_SKILLS.has(name))) continue;
      dangling.push(`${rel}:${i + 1} names \`${name}\``);
    }
  });
}
if (!dangling.length) {
  console.log(`✓ every skill named exists — ${refs} references across ${files.length} files`);
} else {
  console.log(`✗ ${dangling.length} named skills do not exist (add the skill, fix the name, or allow-list a real external one)`);
  for (const d of dangling) console.log(`    · ${d}`);
}
process.exit(failed || dangling.length ? 1 : 0);
