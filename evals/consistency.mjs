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

import { readFileSync, readdirSync, existsSync } from "node:fs";
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
// a skill that nothing shipped. What counts as a reference:
//   - `busy-office:<x>` and `principle-<x>`, in every file of the repo;
//   - in a SKILL.md, a backticked hyphenated name (a one-word one cannot be
//     told apart from a command);
//   - in the mode's SKILL.md and its playbooks, a closed vocabulary, every
//     backticked lowercase name, one word or hyphenated.
const ROOT = join(HERE, "..");
const EXTERNAL_SKILLS = new Set([
  "explain-landing", "loop", // a repository's own skills, named as "the repository's own step"
  "artifact-design",         // Claude Code's own
]);
// Backticked hyphenated words that are not skills at all.
const NOT_SKILLS = new Set(["may-settle", "notion-fetch", "notion-update-page"]);
const BINARY = /\.(png|gif|jpe?g|webp|ico|pdf|woff2?)$/;

const skillNames = new Set(readdirSync(SKILLS).filter((d) => existsSync(join(SKILLS, d, "SKILL.md"))));
const MODE = join(SKILLS, "busy-office-mode");
const playbookNames = new Set(existsSync(join(MODE, "playbooks")) ? readdirSync(join(MODE, "playbooks")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)) : []);
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.name === ".git" || e.name === "node_modules" ? []
  : e.isDirectory() ? walk(join(dir, e.name))
  : BINARY.test(e.name) ? [] : [join(dir, e.name)]);
const files = walk(ROOT);

const dangling = [];
let refs = 0;
for (const file of files) {
  const rel = relative(ROOT, file);
  const skill = rel.split(sep)[1];
  const isSkill = rel === join("skills", skill ?? "", "SKILL.md");
  const closed = file.startsWith(MODE + sep) && file.endsWith(".md");
  const refDir = join(SKILLS, skill ?? "", "references");
  const ownRefs = new Set(isSkill && existsSync(refDir) ? readdirSync(refDir).map((f) => f.replace(/\.[^.]+$/, "")) : []);
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    const named = [
      ...[...line.matchAll(/busy-office:([a-z0-9-]+)/g)].map((m) => [m[1], true]),
      ...[...line.matchAll(/\b(principle-[a-z0-9]+(?:-[a-z0-9]+)*)/g)].map((m) => [m[1], true]),
      ...(isSkill || closed ? [...line.matchAll(/`([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`/g)].map((m) => [m[1], false]) : []),
      ...(closed ? [...line.matchAll(/`([a-z][a-z0-9]*)`/g)].map((m) => [m[1], false]) : []),
    ];
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
