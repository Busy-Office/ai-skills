// jev — typed second opinions (yes/no, choice, score, with probabilities) from
// jev-ai.pro, for agents, hooks and scripts. Jev recommends; the caller acts.
//
// Run through the plugin's bin/jev launcher. `jev help` lists the commands;
// docs/jev-design.md is the design this implements.
//
// Local state (never inside the plugin, whose folder changes on update):
//   ~/.config/jev/secrets.env    the key (0600), synced from plugin config
//   ~/.config/jev/projects.json  which repos may send, written by `jev allow`
//   ~/.local/state/jev/audit/<project>/<YYYY-MM>.jsonl   one line per call
// JEV_CONFIG_DIR / JEV_STATE_DIR move both (tests); JEV_TEST_BASE_URL moves
// the host (tests only).

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync, chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync,
  readlinkSync, realpathSync, renameSync, statSync, symlinkSync, unlinkSync, writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const HERE = dirname(realpathSync(fileURLToPath(import.meta.url)));
export const SKILL_DIR = resolve(HERE, "..");
const PLUGIN_ROOT = resolve(SKILL_DIR, "..", "..");
const VERSION = (() => {
  try { return JSON.parse(readFileSync(join(PLUGIN_ROOT, ".claude-plugin", "plugin.json"), "utf8")).version; }
  catch { return "dev"; }
})();

export const EXIT = { PASS: 0, NONE: 0, REVIEW: 3, FAIL: 4, UNVERIFIED: 5, REFUSED: 64, INTERNAL: 1 };
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const COND_RE = /^([A-Za-z0-9_-]{1,64})(?:\.([A-Za-z0-9_-]{1,64}))?\s*(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/;
const MAX_BODY = 250_000;
const MAX_STATE_TOKENS = 30_000;
const ATTACH_CHARS = 8_000;
const DEFAULT_TIMEOUT = 20_000;
const ALIASES = {
  completion: "task-completion", router: "task-router", research: "research-sufficiency",
  groundedness: "result-groundedness", retry: "retry-or-escalate", release: "release-gate",
  "tool-guard": "tool-guard",
};
const ALLOWED = { PASS: ["continue"], FAIL: ["retry", "block"], REVIEW: ["escalate", "human_review"] };

const cfgDir = (env) => env.JEV_CONFIG_DIR || join(homedir(), ".config", "jev");
const stateDir = (env) => env.JEV_STATE_DIR || join(homedir(), ".local", "state", "jev");
const baseUrl = (env) => env.JEV_TEST_BASE_URL || "https://jev-ai.pro/api";
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const month = (d = new Date()) => d.toISOString().slice(0, 7);

// ------------------------------------------------------------------ errors --
export class JevError extends Error {
  constructor(kind, code, message) { super(message); this.kind = kind; this.code = code; }
}
const refuse = (code, message) => new JevError("refused", code, message);
const unverified = (code, message) => new JevError("unverified", code, message);

const CONFIGURE = "/plugin configure busy-office";

// --------------------------------------------------------------------- key --
export function parseEnvFile(text) {
  const out = {};
  for (let line of text.replace(/^﻿/, "").split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    let [k, ...rest] = line.split("=");
    k = k.trim().replace(/^export\s+/, "");
    out[k] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

export function readKey(env) {
  const f = join(cfgDir(env), "secrets.env");
  let st;
  try { st = statSync(f); } catch {
    throw refuse("no_key", `jev: no API key. Run ${CONFIGURE} and enter a jev-ai.pro key, then start a new session (or in a Terminal window run: jev setup). Never paste the key into chat.`);
  }
  if (st.mode & 0o077) throw refuse("key_file_mode", `jev: ${f} is readable by others. Run: chmod 600 ${f}`);
  const key = parseEnvFile(readFileSync(f, "utf8")).JEV_AI_API_KEY;
  if (!key) throw refuse("no_key", `jev: ${f} has no JEV_AI_API_KEY line. Run ${CONFIGURE} and enter a jev-ai.pro key, then start a new session.`);
  return key;
}

export function writeKeyFile(env, key) {
  const dir = cfgDir(env);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const f = join(dir, "secrets.env");
  const tmp = `${f}.${process.pid}.tmp`;
  writeFileSync(tmp, `JEV_AI_API_KEY=${key}\n`, { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, f);
  return f;
}

// ---------------------------------------------------------------- identity --
function git(cwd, args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

// The project is the repository, named by the folder that holds its git
// common directory, so every worktree of one repo is the same project.
// .jev.json only supplies a display label; it never changes name or root.
export function identify(cwd) {
  let root, top;
  const common = git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (common) {
    const rc = realpathSync(common);
    root = basename(rc) === ".git" ? dirname(rc) : rc;
    top = realpathSync(git(cwd, ["rev-parse", "--show-toplevel"]) || root);
  } else if (existsSync(join(cwd, ".jev.json"))) {
    root = top = realpathSync(cwd);
  } else {
    throw refuse("no_identity", "jev: can't tell which project this is. Run inside a git repo, or add a .jev.json to this folder.");
  }
  const name = basename(root);
  if (!NAME_RE.test(name)) {
    throw refuse("no_identity", `jev: the folder name "${name}" can't be a project name (letters, digits, . _ - only; at most 64). Rename the folder.`);
  }
  let label = null;
  try { label = JSON.parse(readFileSync(join(top, ".jev.json"), "utf8")).label ?? null; } catch {}
  return { name, root, top, label };
}

// ------------------------------------------------------------------ policy --
// projects.json: {"all": {...}, "projects": {name: {...}}}. "all" (from
// `jev allow --all`) lets any repo send with its settings; a repo listed in
// "projects" always uses its own entry, so `jev deny` still blocks it.
export function loadPolicy(env) {
  const f = join(cfgDir(env), "projects.json");
  if (!existsSync(f)) return { file: f, all: null, projects: {} };
  try {
    const p = JSON.parse(readFileSync(f, "utf8"));
    return { file: f, all: p.all && typeof p.all === "object" ? p.all : null, projects: p.projects || {} };
  } catch (e) {
    throw refuse("policy_invalid", `jev: ${f} is not valid JSON (${e.message}). Fix it, or run jev allow in a Terminal window to rewrite this project's entry.`);
  }
}

function savePolicy(env, pol) {
  const dir = cfgDir(env);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const f = join(dir, "projects.json");
  const tmp = `${f}.${process.pid}.tmp`;
  const out = pol.all ? { all: pol.all, projects: pol.projects } : { projects: pol.projects };
  writeFileSync(tmp, JSON.stringify(out, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, f);
  return f;
}

function realOr(p) { try { return realpathSync(p); } catch { return resolve(p); } }

// The entry that governs this repo: its own, else the allow-all one, else none.
export function policyFor(pol, id) {
  const own = pol.projects[id.name];
  if (own) return { entry: own, via: "project" };
  if (pol.all?.send === true) return { entry: { ...pol.all, root: id.root }, via: "all" };
  return { entry: null, via: null };
}

export function checkPolicy(env, id, { web = false } = {}) {
  const pol = loadPolicy(env);
  const { entry, via } = policyFor(pol, id);
  const allow = "To allow it, in a Terminal window in this repo run: jev allow (or jev allow --all for every repo)";
  if (!entry || entry.send !== true) {
    const denied = entry && pol.all?.send === true ? " It is denied even though all repos are allowed; jev allow in this repo lifts that." : "";
    throw refuse("project_not_allowed", `jev: project "${id.name}" may not send data.${denied} ${allow}`);
  }
  if (via === "project" && (!entry.root || realOr(entry.root) !== id.root)) {
    throw refuse("root_mismatch", `jev: this repo is named "${id.name}" but is at ${id.root}, not ${entry.root ?? "(no root set)"}. Only the user can change this, with jev allow in a Terminal window at the right path.`);
  }
  if (web && entry.web !== true) {
    throw refuse("web_not_allowed", `jev: project "${id.name}" may not use jev web (it also sends the question to a search provider). To allow it, in a Terminal window run: ${via === "all" ? "jev allow --all --web" : "jev allow --web (in this repo)"}`);
  }
  // No cap unless the user set one (design Q36); spending is bounded on jev-ai.pro.
  const cap = Number.isInteger(entry.max_calls_per_day) ? entry.max_calls_per_day : null;
  const used = cap === null ? 0 : callsToday(env, id.name);
  if (cap !== null && used >= cap) {
    throw refuse("daily_cap", `jev: project "${id.name}" has made ${used} calls today (cap ${cap}). If that is expected, in a Terminal window run: ${via === "all" ? "jev allow --all --cap <n>" : "jev allow --cap <n> (in this repo)"}`);
  }
  return entry;
}

function readJsonl(file) {
  if (!existsSync(file)) return [];
  const out = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch {}
  }
  return out;
}

export function callsToday(env, project) {
  const today = new Date().toISOString().slice(0, 10);
  return readJsonl(join(stateDir(env), "audit", project, `${month()}.jsonl`))
    .filter((r) => r.type === "call" && !r.refused && String(r.ts).startsWith(today)).length;
}

// ------------------------------------------------------------- secret scan --
export const SECRET_PATTERNS = [
  ["private_key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["sk_key", /\bsk[-_](?:live_|test_|proj-|ant-)?[A-Za-z0-9_-]{20,}/],
  ["aws_access_key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["github_token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{22,}/],
  ["slack_token", /\bxox[abposr]-[A-Za-z0-9-]{10,}/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
  ["named_secret", /[A-Za-z0-9_]*(?:API_?KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY|ACCESS_KEY)[A-Za-z0-9_]*["']?\s*[:=]\s*["']?[A-Za-z0-9_\-+/.=]{24,}/i],
  ["bearer_token", /\bBearer\s+[A-Za-z0-9_\-.=+/]{20,}/],
  ["url_credentials", /:\/\/[^/\s:@]+:[^/\s@]+@/],
];

// Every string in the request, and every "key: value" pair, so a secret held
// as {"API_KEY": "…"} is caught the same way as API_KEY=… in text.
export function scanSecrets(value, key) {
  const texts = [];
  const walk = (v) => {
    if (typeof v === "string") texts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        texts.push(k);
        if (typeof x === "string" || typeof x === "number") texts.push(`${k}: ${x}`);
        walk(x);
      }
    }
  };
  walk(value);
  for (const t of texts) {
    if (key && t.includes(key)) return "jev_key";
    for (const [name, re] of SECRET_PATTERNS) if (re.test(t)) return name;
  }
  return null;
}

// --------------------------------------------------------------- transport --
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function call(io, method, path, body, key, timeoutMs = DEFAULT_TIMEOUT) {
  const deadline = Date.now() + timeoutMs;
  const fetchImpl = io.fetch || globalThis.fetch;
  let retried = false;
  for (;;) {
    const left = deadline - Date.now();
    if (left <= 0) throw unverified("outcome_uncertain", "jev: timed out; the call may have been processed and billed. Not retried.");
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), left);
    const t0 = Date.now();
    let res;
    try {
      res = await fetchImpl(baseUrl(io.env) + path, {
        method, redirect: "manual", signal: ac.signal,
        headers: {
          authorization: `Bearer ${key}`, "content-type": "application/json",
          "user-agent": `busy-office-jev/${VERSION}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      clearTimeout(timer);
      const code = e?.cause?.code || e?.code;
      const neverSent = ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ENETUNREACH"].includes(code);
      if (neverSent && !retried) { retried = true; await sleep(250 + Math.random() * 500); continue; }
      if (neverSent) throw unverified("upstream_unavailable", `jev: can't reach jev-ai.pro (${code}).`);
      throw unverified("outcome_uncertain", `jev: the connection failed after sending (${e.name === "AbortError" ? "timeout" : code || e.message}); it may have been processed and billed. Not retried.`);
    }
    clearTimeout(timer);
    const latency = Date.now() - t0;
    const s = res.status;
    if (s === 401) throw refuse("key_rejected", `jev: key rejected (wrong or revoked). Create a new key at jev-ai.pro → API Keys and enter it with ${CONFIGURE} (or jev setup in a Terminal window).`);
    if (s === 402) throw refuse("balance", "jev: balance too low or spending paused. Check jev-ai.pro → Billing.");
    if (s === 429) {
      const wait = Number(res.headers.get("retry-after") || 1) * 1000;
      if (!retried && Date.now() + wait < deadline - 1000) { retried = true; await sleep(wait); continue; }
      throw unverified("rate_limited", "jev: rate limited by jev-ai.pro. Try again shortly.");
    }
    if (s === 504) throw unverified("outcome_uncertain", "jev: jev-ai.pro timed out upstream (504); the call may have been processed and billed. Not retried.");
    if (s >= 500) {
      if (!retried) { retried = true; await sleep(250 + Math.random() * 500); continue; }
      throw unverified("upstream_unavailable", `jev: jev-ai.pro is unavailable (${s}).`);
    }
    if (s >= 300 && s < 400) throw unverified("invalid_request", `jev: jev-ai.pro answered with a redirect (${s}); redirects are refused.`);
    if (s >= 400) {
      let detail = "";
      try { detail = (await res.text()).slice(0, 300); } catch {}
      throw unverified("invalid_request", `jev: jev-ai.pro rejected the request (${s}): ${detail}`);
    }
    let json;
    try { json = await res.json(); } catch { throw unverified("bad_response", "jev: jev-ai.pro answered with something that is not JSON."); }
    return {
      json, latency,
      runId: res.headers.get("x-jev-run-id"),
      billing: res.headers.get("x-jev-billing"),
      credits: res.headers.get("x-jev-credits-charged"),
    };
  }
}

// ------------------------------------------------------------------ judges --
export function resolveJudge(ref, top) {
  if (ALIASES[ref]) ref = `agent/${ALIASES[ref]}`;
  let m;
  if ((m = /^agent\/([A-Za-z0-9_-]+)$/.exec(ref))) return { id: ref, file: join(SKILL_DIR, "judges", "agent", `${m[1]}.json`) };
  if ((m = /^local\/([A-Za-z0-9_-]+)$/.exec(ref))) {
    if (!top) throw refuse("no_identity", "jev: local/ judges need a project. Run inside a git repo.");
    return { id: ref, file: join(top, ".jev", "judges", `${m[1]}.json`) };
  }
  if (ref.endsWith(".json") || ref.includes("/")) return { id: `file:${resolve(ref)}`, file: resolve(ref) };
  throw refuse("usage", `jev: no judge "${ref}". Run jev judges to list them.`);
}

export function parseCondition(c) {
  const m = COND_RE.exec(String(c).trim());
  if (!m) return null;
  return { text: String(c).trim(), q: m[1], opt: m[2] ?? null, op: m[3], n: Number(m[4]) };
}

// Everything the loader rejects is named with its file and field, so an agent
// writing a project judge can fix it without reading this code.
export function validateQuestions(qs, where) {
  const bad = (field, msg) => { throw refuse("usage", `jev: ${where}: ${field}: ${msg}`); };
  if (!qs || typeof qs !== "object" || Array.isArray(qs)) bad("questions", "must be an object of id → question");
  const ids = Object.keys(qs);
  if (ids.length < 1 || ids.length > 64) bad("questions", "needs 1–64 questions");
  for (const id of ids) {
    const q = qs[id];
    if (!ID_RE.test(id)) bad(`questions.${id}`, "id must match [A-Za-z0-9_-]{1,64}");
    if (id === "pick" || id === "fallback") bad(`questions.${id}`, "pick and fallback are reserved");
    if (!["noul", "choice", "score"].includes(q?.type)) bad(`questions.${id}.type`, "must be noul, choice or score");
    if (!q.instructions) bad(`questions.${id}.instructions`, "required");
    if (q.type === "choice") {
      const opts = q.criteria && !Array.isArray(q.criteria) ? Object.keys(q.criteria) : [];
      if (opts.length < 2 || opts.length > 255) bad(`questions.${id}.criteria`, "a choice needs 2–255 options as option → description");
      for (const o of opts) if (!ID_RE.test(o)) bad(`questions.${id}.criteria.${o}`, "option names must match [A-Za-z0-9_-]{1,64}");
    }
    if (q.type === "score" && (!Array.isArray(q.criteria) || q.criteria.length < 2 || q.criteria.length > 10)) {
      bad(`questions.${id}.criteria`, "a score needs 2–10 levels, low to high");
    }
  }
  return qs;
}

export function validateJudge(j, where) {
  const bad = (field, msg) => { throw refuse("usage", `jev: judge ${where}: ${field}: ${msg}`); };
  if (!j || typeof j !== "object") bad("(file)", "not a JSON object");
  if (!Number.isInteger(j.revision) || j.revision < 1) bad("revision", "must be an integer ≥ 1");
  const qs = validateQuestions(j.questions, `judge ${where}`);
  const checkCond = (field, c) => {
    const p = parseCondition(c);
    if (!p) bad(field, `"${c}" is not <question>[.<option>] <op> <number>`);
    const q = qs[p.q];
    if (!q) bad(field, `"${c}" names unknown question ${p.q}`);
    if (q.type === "choice" && !p.opt) bad(field, `"${c}": a choice condition names an option (${p.q}.<option>)`);
    if (q.type !== "choice" && p.opt) bad(field, `"${c}": only choice questions take .<option>`);
    if (p.opt && !(p.opt in q.criteria)) bad(field, `"${c}" names unknown option ${p.opt}`);
  };
  const pair = (field, d, a) => {
    if (!ALLOWED[d] || !ALLOWED[d].includes(a)) bad(field, `${d}+${a} is not allowed (PASS→continue, FAIL→retry|block, REVIEW→escalate|human_review)`);
  };
  if (j.pick) {
    const pk = j.pick;
    if (qs[pk.question]?.type !== "choice") bad("pick.question", "must name a choice question");
    if (typeof pk.min_p !== "number" || pk.min_p < 0 || pk.min_p > 1) bad("pick.min_p", "must be a number 0–1");
    const bf = pk.below_floor || {};
    if (bf.decision === "PASS") bad("pick.below_floor", "is never PASS");
    pair("pick.below_floor", bf.decision, bf.action);
    for (const [o, v] of Object.entries(pk.outcomes || {})) {
      if (!(o in qs[pk.question].criteria)) bad(`pick.outcomes.${o}`, "not an option of the pick question");
      pair(`pick.outcomes.${o}`, v?.decision, v?.action);
    }
  } else {
    if (!Array.isArray(j.pass) || j.pass.length === 0) bad("pass", "a gate judge needs at least one pass condition");
    j.pass.forEach((c, i) => checkCond(`pass[${i}]`, c));
    (j.fail || []).forEach((c, i) => checkCond(`fail[${i}]`, c));
    pair("on_fail", "FAIL", j.on_fail ?? "retry");
    pair("on_review", "REVIEW", j.on_review ?? "human_review");
  }
  if (j.main !== undefined && !qs[j.main]) bad("main", `unknown question ${j.main}`);
  if (j.pass_requires_attached !== undefined && !(Number.isInteger(j.pass_requires_attached) && j.pass_requires_attached >= 0)) {
    bad("pass_requires_attached", "must be an integer ≥ 0");
  }
  if (j.state && !Array.isArray(j.state.required || [])) bad("state.required", "must be a list");
  return j;
}

export function loadJudge(ref, top) {
  const { id, file } = resolveJudge(ref, top);
  let text;
  try { text = readFileSync(file, "utf8"); } catch {
    throw refuse("usage", `jev: no judge file at ${file}. Run jev judges to list judges.`);
  }
  let j;
  try { j = JSON.parse(text); } catch (e) { throw refuse("usage", `jev: judge ${file} is not valid JSON (${e.message}).`); }
  validateJudge(j, file);
  return { id, file, hash: `sha256:${sha256(text)}`, judge: j };
}

function listJudgeFiles(dir) {
  try { return readdirSync(dir).filter((f) => f.endsWith(".json")).sort(); } catch { return []; }
}

// ------------------------------------------------------------ evaluation --
// Answers come back as {type, noul} | {type, choice, probabilities} |
// {type, score}. A missing or mistyped answer is bad_response, never 0.
export function readAnswers(questions, raw) {
  const out = {};
  for (const [id, q] of Object.entries(questions)) {
    const a = raw?.[id];
    if (!a) throw unverified("bad_response", `jev: the response has no answer for "${id}".`);
    if (q.type === "noul") {
      const p = typeof a.noul === "number" ? a.noul : a.probability;
      if (typeof p !== "number") throw unverified("bad_response", `jev: answer "${id}" has no yes-probability.`);
      out[id] = { type: "noul", value: p };
    } else if (q.type === "choice") {
      const probs = a.probabilities;
      if (!probs || typeof probs !== "object") throw unverified("bad_response", `jev: answer "${id}" has no probabilities.`);
      const top = Object.entries(probs).sort((x, y) => y[1] - x[1])[0];
      out[id] = { type: "choice", value: a.choice ?? top?.[0], probabilities: probs };
    } else {
      if (typeof a.score !== "number") throw unverified("bad_response", `jev: answer "${id}" has no score.`);
      out[id] = { type: "score", value: a.score, ...(a.probabilities ? { probabilities: a.probabilities } : {}) };
    }
  }
  return out;
}

function condValue(c, answers) {
  const a = answers[c.q];
  if (!a) return undefined;
  if (c.opt) return a.probabilities?.[c.opt] ?? 0;
  return a.value;
}

function holds(c, v) {
  if (typeof v !== "number") return false;
  return c.op === ">=" ? v >= c.n : c.op === "<=" ? v <= c.n : c.op === ">" ? v > c.n : v < c.n;
}

const fmt = (v) => (typeof v === "number" ? Number(v.toFixed(2)) : v);

export function mainQuestion(j) {
  if (j.main) return j.main;
  if (j.pick) return j.pick.question;
  const qs = Object.entries(j.questions);
  return (qs.find(([, q]) => q.type === "choice") || qs[0])[0];
}

function confidenceOf(a) {
  if (!a) return null;
  if (a.type === "choice") return Math.max(...Object.values(a.probabilities));
  if (a.type === "noul") return Math.max(a.value, 1 - a.value);
  return a.probabilities ? Math.max(...Object.values(a.probabilities)) : null;
}

// Gate: any fail condition → FAIL; else every pass condition → PASS; else
// REVIEW. Pick: the top option at or above the floor picks its outcome.
export function decide(j, answers) {
  const result = {};
  for (const [id, a] of Object.entries(answers)) result[id] = a.value;
  if (j.pick) {
    const pk = j.pick;
    const a = answers[pk.question];
    const [opt, p] = Object.entries(a.probabilities).sort((x, y) => y[1] - x[1])[0];
    if (p < pk.min_p) {
      result.pick = null;
      if (pk.fallback) result.fallback = pk.fallback;
      return { decision: pk.below_floor.decision, action: pk.below_floor.action, result, reasons: [`${pk.question}.${opt} ${fmt(p)} < ${pk.min_p} (floor)`] };
    }
    result.pick = opt;
    if (pk.fallback) result.fallback = pk.fallback;
    const o = pk.outcomes?.[opt] || { decision: "PASS", action: "continue" };
    return { decision: o.decision, action: o.action, result, reasons: [`${pk.question}.${opt} ${fmt(p)} >= ${pk.min_p}`] };
  }
  const fails = (j.fail || []).map(parseCondition).filter((c) => holds(c, condValue(c, answers)));
  if (fails.length) {
    return { decision: "FAIL", action: j.on_fail ?? "retry", result, reasons: fails.map((c) => `${c.q}${c.opt ? "." + c.opt : ""} ${fmt(condValue(c, answers))} ${c.op} ${c.n}`) };
  }
  const pass = j.pass.map(parseCondition);
  const unmet = pass.filter((c) => !holds(c, condValue(c, answers)));
  const describe = (c, prefix = "") => `${prefix}${c.q}${c.opt ? "." + c.opt : ""} ${fmt(condValue(c, answers))} ${c.op} ${c.n}`;
  if (!unmet.length) return { decision: "PASS", action: "continue", result, reasons: pass.map((c) => describe(c)) };
  return { decision: "REVIEW", action: j.on_review ?? "human_review", result, reasons: unmet.map((c) => describe(c, "not: ")) };
}

// ------------------------------------------------------------------ inputs --
function readInput(spec, io, what) {
  if (spec === undefined) return undefined;
  let text;
  try {
    text = spec !== "-" ? readFileSync(resolve(io.cwd, spec), "utf8")
      : io.stdinText !== undefined ? io.stdinText : readFileSync(0, "utf8");
  } catch { throw refuse("usage", `jev: can't read ${what} from ${spec}.`); }
  try { return JSON.parse(text); } catch (e) { throw refuse("usage", `jev: ${what} is not valid JSON (${e.message}). Pass it with a quoted heredoc (<<'JSON') or a file.`); }
}

export function splitCommand(s) {
  const out = [];
  let cur = "", q = null, any = false;
  for (const ch of s) {
    if (q) { if (ch === q) q = null; else cur += ch; continue; }
    if (ch === "'" || ch === '"') { q = ch; any = true; continue; }
    if (/\s/.test(ch)) { if (cur || any) { out.push(cur); cur = ""; any = false; } continue; }
    cur += ch;
  }
  if (cur || any) out.push(cur);
  return out;
}

const clip = (s) => (s.length > ATTACH_CHARS ? s.slice(0, ATTACH_CHARS) + `\n…[truncated ${s.length - ATTACH_CHARS} chars]` : s);

// Evidence the CLI reads itself is "attached"; anything the caller typed into
// the state is "stated". Judges can refuse to PASS on stated evidence alone.
export function attachEvidence(state, flags, top) {
  const provenance = {};
  const attachments = [];
  const warnings = [];
  let ev = state.evidence;
  if (ev !== undefined && (typeof ev !== "object" || ev === null || Array.isArray(ev))) ev = { stated: ev };
  ev = { ...(ev || {}) };
  for (const k of Object.keys(ev)) provenance[k] = "stated";
  const put = (name, text, kind, exit) => {
    if (!ID_RE.test(name)) throw refuse("usage", `jev: evidence name "${name}" must match [A-Za-z0-9_-]{1,64}.`);
    if (provenance[name] === "stated") warnings.push(`attached_replaced_stated:${name}`);
    ev[name] = clip(text);
    provenance[name] = "attached";
    attachments.push({ name, kind, sha256: sha256(text), bytes: Buffer.byteLength(text), exit, truncated: text.length > ATTACH_CHARS });
  };
  for (const spec of flags.attach || []) {
    const i = spec.indexOf("=");
    if (i < 1) throw refuse("usage", `jev: --attach takes name=file, got "${spec}".`);
    const name = spec.slice(0, i), file = resolve(top, spec.slice(i + 1));
    let text;
    try { text = readFileSync(file, "utf8"); } catch { throw refuse("usage", `jev: --attach ${name}: can't read ${file}.`); }
    put(name, text, "file", null);
  }
  for (const spec of flags["attach-cmd"] || []) {
    const i = spec.indexOf("=");
    if (i < 1) throw refuse("usage", `jev: --attach-cmd takes name="command args", got "${spec}".`);
    const name = spec.slice(0, i), argv = splitCommand(spec.slice(i + 1));
    if (!argv.length) throw refuse("usage", `jev: --attach-cmd ${name}: empty command.`);
    const r = spawnSync(argv[0], argv.slice(1), { cwd: top, encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 });
    if (r.error && r.error.code === "ENOENT") throw refuse("usage", `jev: --attach-cmd ${name}: command not found: ${argv[0]}`);
    const timedOut = r.error?.code === "ETIMEDOUT" || r.signal === "SIGTERM";
    const text = `${r.stdout || ""}${r.stderr || ""}${timedOut ? "\n[timed out after 30 s]" : ""}\n[exit ${r.status ?? "none"}]`;
    put(name, text, "command", r.status ?? null);
  }
  const out = { ...state };
  if (Object.keys(ev).length) out.evidence = ev;
  return { state: out, provenance, attachments, warnings };
}

// ------------------------------------------------------------------- audit --
function audit(env, project, rec) {
  const dir = join(stateDir(env), "audit", project || "_unresolved");
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    appendFileSync(join(dir, `${month()}.jsonl`), JSON.stringify(rec) + "\n", { mode: 0o600 });
    return true;
  } catch { return false; }
}

function keepCase(env, project, rec) {
  const dir = join(stateDir(env), "cases", project);
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    appendFileSync(join(dir, `${month()}.jsonl`), JSON.stringify(rec) + "\n", { mode: 0o600 });
  } catch {}
}

// ------------------------------------------------------------------- flags --
const BOOLEAN = new Set(["json", "help", "all", "web", "no-web", "keep-cases", "no-keep-cases"]);
const REPEAT = new Set(["pass", "fail", "attach", "attach-cmd"]);

export function parseArgs(argv) {
  const _ = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h") { flags.help = true; continue; }
    if (a === "--self-test") { _.push(a); continue; }
    if (!a.startsWith("--") || a === "--") { _.push(a); continue; }
    let name = a.slice(2), val;
    const eq = name.indexOf("=");
    if (eq >= 0) { val = name.slice(eq + 1); name = name.slice(0, eq); }
    if (BOOLEAN.has(name)) { flags[name] = true; continue; }
    if (val === undefined) {
      if (i + 1 >= argv.length) throw refuse("usage", `jev: --${name} needs a value.`);
      val = argv[++i];
    }
    if (REPEAT.has(name)) (flags[name] ||= []).push(val);
    else flags[name] = val;
  }
  return { _, flags };
}

// ----------------------------------------------------------- evaluations --
function agentName(flags, env) {
  return flags.agent || env.JEV_AGENT || (env.CLAUDECODE ? "claude-code" : "cli");
}

function envelope(base, err) {
  return {
    decision: base.decisionOnError, action: base.decisionOnError ? "human_review" : null,
    confidence: null, unverified: true, calibrated: false, evidence_provenance: base.provenance || {},
    advice: err.message, result: {}, answers: {}, reasons: [],
    judge: base.judgeInfo || null, project: base.project || null, agent: base.agent, model: base.model || null,
    jev_run_id: null, usage: null, latency_ms: null, warnings: base.warnings || [],
    error: { code: err.code, message: err.message },
  };
}

// judge, ask and web share one path: identify → policy → build → scan →
// send → decide → audit → print. Every failure still prints an envelope and
// an audit line, and never becomes a PASS.
async function evaluate(kind, args, io) {
  const { flags } = args;
  const env = io.env;
  const agent = agentName(flags, env);
  const ctx = { agent, decisionOnError: kind === "ask" ? null : "REVIEW", warnings: [] };
  const t0 = Date.now();
  let id = null, cases = false;
  const rec = { type: "call", ts: new Date().toISOString(), agent, run: flags.run ?? null, command: kind };
  try {
    id = identify(io.cwd);
    ctx.project = id.name;
    let judgeInfo, questions, conditions = null, model, state, provenance = {}, attachments = [], j = null;

    if (kind === "judge") {
      const ref = args._[1];
      if (!ref) throw refuse("usage", "jev: which judge? Usage: jev judge <name> --state <file|->. Run jev judges to list them.");
      const loaded = loadJudge(ref, id.top);
      j = loaded.judge;
      judgeInfo = { id: loaded.id, revision: j.revision, hash: loaded.hash };
      ctx.judgeInfo = judgeInfo;
      if (j.pick) ctx.decisionOnError = "REVIEW";
      questions = j.questions;
      model = j.model || "jev-1.13.0";
      state = readInput(flags.state, io, "the state") ?? {};
    } else if (kind === "ask") {
      if (flags.questions === "-" && flags.state === "-") throw refuse("usage", "jev: only one of --questions and --state can read stdin.");
      questions = readInput(flags.questions, io, "the questions");
      if (!questions) throw refuse("usage", "jev: jev ask needs --questions <file|-> (JSON: id → {type, instructions, criteria}).");
      state = readInput(flags.state, io, "the state") ?? {};
      model = flags.model || "jev-latest";
      const hasCond = (flags.pass || []).length || (flags.fail || []).length;
      j = { revision: 1, questions, pass: flags.pass || [], fail: flags.fail || [], on_fail: "retry", on_review: "human_review" };
      if (hasCond) {
        if (!j.pass.length) throw refuse("usage", "jev: jev ask with conditions needs at least one --pass.");
        validateJudge(j, "jev ask");
        conditions = true;
        ctx.decisionOnError = "REVIEW";
      } else {
        validateQuestions(questions, "jev ask");
      }
      judgeInfo = { id: "ask", revision: null, hash: `sha256:${sha256(JSON.stringify({ questions, pass: j.pass, fail: j.fail }))}` };
      ctx.judgeInfo = judgeInfo;
    } else {
      judgeInfo = { id: "web", revision: null, hash: null };
      ctx.judgeInfo = judgeInfo;
    }
    // Policy before anything runs or leaves: no --attach-cmd for a repo that may not send.
    const entry = checkPolicy(env, id, { web: kind === "web" });
    cases = entry.keep_cases === true;
    if (kind !== "web") {
      if (typeof state !== "object" || state === null || Array.isArray(state)) throw refuse("usage", "jev: the state must be a JSON object.");
      const at = attachEvidence(state, flags, id.top);
      state = at.state; provenance = at.provenance; attachments = at.attachments; ctx.warnings.push(...at.warnings);
      ctx.provenance = provenance;
      const missing = (j?.state?.required || []).filter((f) => state[f] === undefined || state[f] === "");
      if (missing.length) throw refuse("missing_state_fields", `jev: the state is missing ${missing.join(", ")}. See: jev judge ${args._[1]} --help`);
    }

    const key = readKey(env);
    ctx.model = model;

    let body, path;
    if (kind === "web") {
      const question = flags.question;
      if (!question) throw refuse("usage", "jev: jev web needs --question \"<a yes/no claim to check>\".");
      if (question.length > 300) throw refuse("usage", `jev: --question is ${question.length} characters; the limit is 300.`);
      body = { question };
      if (flags["num-results"]) body.num_results = Math.max(1, Math.min(10, Number(flags["num-results"])));
      if (flags.criteria) body.criteria = flags.criteria;
      if (flags.sources) {
        const src = readInput(flags.sources, io, "the sources");
        if (!Array.isArray(src) || src.length > 10) throw refuse("usage", "jev: --sources must be a JSON array of at most 10 sources.");
        body.sources = src;
      }
      path = "/v1/web-context";
      state = body;
    } else {
      body = { model, state, questions: Object.fromEntries(Object.entries(questions).map(([k, q]) => [k, { type: q.type, instructions: q.instructions, ...(q.criteria ? { criteria: q.criteria } : {}) }])) };
      path = "/v1/systemone";
    }

    const hit = scanSecrets(body, key);
    if (hit) throw refuse("secret_detected", `jev: the request contains what looks like a secret (${hit}). Remove it from the state or evidence and call again.`);
    const bytes = Buffer.byteLength(JSON.stringify(body));
    if (bytes > MAX_BODY) throw refuse("too_large", `jev: the request is ${bytes} bytes; the limit is ${MAX_BODY}. Trim the evidence.`);
    const tokens = Math.ceil(JSON.stringify(state).length / 4);
    if (tokens > MAX_STATE_TOKENS) throw refuse("too_large", `jev: the state is about ${tokens} tokens; the limit is about ${MAX_STATE_TOKENS}. Trim the evidence.`);

    const timeout = Math.min(Number(flags.timeout) || DEFAULT_TIMEOUT, DEFAULT_TIMEOUT);
    const resp = await call(io, "POST", path, body, key, timeout);
    const warnings = [...ctx.warnings];
    let out;

    if (kind === "web") {
      out = webVerdict(resp.json, body);
    } else {
      const answers = readAnswers(questions, resp.json.answers);
      const respModel = resp.json.model ?? null;
      let d;
      if (kind === "ask" && !conditions) {
        d = { decision: null, action: null, result: Object.fromEntries(Object.entries(answers).map(([k, a]) => [k, a.value])), reasons: [] };
      } else {
        d = decide(j, answers);
      }
      if (kind === "judge") {
        if (respModel === null) warnings.push("model_unreported");
        else if (respModel !== model) {
          warnings.push("model_unexpected");
          if (d.decision === "PASS") {
            d = { ...d, decision: "REVIEW", action: j.on_review ?? j.pick?.below_floor?.action ?? "human_review", reasons: [...d.reasons, `capped: answered by ${respModel}, not the pinned ${model}`] };
          }
        }
        const need = j.pass_requires_attached ?? 0;
        const got = Object.values(provenance).filter((p) => p === "attached").length;
        if (d.decision === "PASS" && got < need) {
          warnings.push("stated_evidence_only");
          d = { ...d, decision: "REVIEW", action: j.on_review ?? "human_review", reasons: [...d.reasons, `capped: ${got} attached evidence item(s), this judge needs ${need} to PASS`] };
        }
      } else if (respModel && !/^(jev|laya)-/.test(respModel)) {
        warnings.push("model_unexpected");
      }
      const adv = j?.advice?.[d.decision];
      out = {
        decision: d.decision, action: d.action, result: d.result, reasons: d.reasons,
        confidence: d.decision === null ? null : fmt(confidenceOf(answers[mainQuestion(j)])),
        answers, model: respModel ?? model,
        advice: d.decision === null ? "Answers only; no decision was asked for."
          : (warnings.includes("stated_evidence_only") ? `${d.decision}: only stated evidence was sent; attach real evidence (--attach / --attach-cmd) and ask again.`
            : warnings.includes("model_unexpected") && d.decision === "REVIEW" && d.reasons.some((r) => r.startsWith("capped: answered"))
              ? `REVIEW: a different model answered than this judge was set up for; treat as unchecked.`
              : adv || `${d.decision}: ${d.reasons[0] ?? ""}`),
      };
    }
    const result = {
      decision: out.decision, action: out.action, confidence: out.confidence ?? null,
      unverified: false, calibrated: false, evidence_provenance: provenance,
      advice: out.advice, result: out.result, answers: out.answers ?? {}, reasons: out.reasons,
      judge: judgeInfo, project: id.name, ...(id.label ? { label: id.label } : {}), agent,
      model: out.model ?? null, jev_run_id: resp.runId,
      usage: { input_tokens: resp.json.usage?.input_tokens ?? null, billing: resp.billing, credits_charged: resp.credits != null ? Number(resp.credits) : null },
      latency_ms: resp.latency, warnings, error: null,
    };
    const ok = audit(env, id.name, {
      ...rec, project: id.name, judge: judgeInfo, model: result.model, decision: result.decision, action: result.action,
      confidence: result.confidence, unverified: false, refused: false, calibrated: false, error_code: null,
      warnings, reasons: result.reasons, answers: result.answers, jev_run_id: resp.runId, billing: resp.billing,
      input_tokens: result.usage.input_tokens, credits_charged: result.usage.credits_charged, latency_ms: resp.latency,
      evidence_provenance: provenance, attachments, state_sha256: sha256(JSON.stringify(state)),
      state_bytes: Buffer.byteLength(JSON.stringify(state)), state_fields: Object.keys(state),
      web_sources: kind === "web" ? (out.result.sources || []).map((s) => s?.url).filter(Boolean) : undefined,
    });
    if (!ok) { result.warnings.push("audit_failed"); io.err.write("jev: could not write the audit log.\n"); }
    if (cases) keepCase(env, id.name, { ts: rec.ts, jev_run_id: resp.runId, judge: judgeInfo, state, decision: result.decision, answers: result.answers });
    return print(io, flags, result, result.decision === null ? EXIT.NONE : EXIT[result.decision]);
  } catch (e) {
    const err = e instanceof JevError ? e : new JevError("internal", "internal", `jev: internal error: ${e?.message || e}`);
    const env2 = envelope(ctx, err);
    audit(env, id?.name ?? null, {
      ...rec, project: id?.name ?? null, judge: ctx.judgeInfo ?? null, model: ctx.model ?? null,
      decision: env2.decision, action: env2.action, confidence: null, unverified: true, refused: err.kind === "refused",
      calibrated: false, error_code: err.code, warnings: ctx.warnings, reasons: [], latency_ms: Date.now() - t0,
    });
    const code = err.kind === "refused" ? EXIT.REFUSED : err.kind === "unverified" ? EXIT.UNVERIFIED : EXIT.INTERNAL;
    return print(io, flags, env2, code);
  }
}

// /v1/web-context answers the question twice — with the web evidence and
// without it. The field names are read defensively; an unknown shape is a
// bad_response that names the fields it did get.
export function webVerdict(json) {
  const p = (v) => (typeof v === "number" ? v : typeof v?.noul === "number" ? v.noul : typeof v?.probability === "number" ? v.probability : undefined);
  const pickField = (names) => { for (const n of names) { const v = p(json?.[n]); if (v !== undefined) return v; } return undefined; };
  const withP = pickField(["with_evidence", "with_context", "withEvidence", "withContext", "grounded", "with_web"]);
  const withoutP = pickField(["without_evidence", "without_context", "withoutEvidence", "withoutContext", "prior", "without_web"]);
  if (withP === undefined) {
    throw unverified("bad_response", `jev: unrecognised web-context response (fields: ${Object.keys(json || {}).join(", ")}).`);
  }
  const sources = json.sources || json.results || [];
  let decision, action, verdict;
  if (withP >= 0.8) { decision = "PASS"; action = "continue"; verdict = "SUPPORTED"; }
  else if (1 - withP >= 0.8) { decision = "FAIL"; action = "retry"; verdict = "UNSUPPORTED"; }
  else { decision = "REVIEW"; action = "human_review"; verdict = "INSUFFICIENT"; }
  return {
    decision, action, confidence: fmt(Math.max(withP, 1 - withP)),
    result: { verdict, with_evidence: withP, without_evidence: withoutP ?? null, evidence_shift: withoutP === undefined ? null : fmt(withP - withoutP), sources },
    reasons: [`with evidence: yes ${fmt(withP)}`], model: null,
    advice: verdict === "SUPPORTED" ? "SUPPORTED: the sources back the claim." : verdict === "UNSUPPORTED" ? "UNSUPPORTED: revise or drop the claim." : "INSUFFICIENT: the sources don't settle it; ask a person or find better sources.",
  };
}

// ------------------------------------------------------------------ output --
function print(io, flags, result, code) {
  const json = flags.json || !io.isTTY;
  if (json) io.out.write(JSON.stringify(result, null, 2) + "\n");
  else {
    const lines = [];
    if (result.error) lines.push(result.error.message);
    else {
      lines.push(`${result.decision ?? "ANSWERS"}${result.action ? " · " + result.action : ""} — ${result.advice}`);
      for (const r of result.reasons || []) lines.push(`  ${r}`);
      for (const [k, a] of Object.entries(result.answers || {})) lines.push(`  ${k}: ${a.type === "choice" ? `${a.value} ${JSON.stringify(Object.fromEntries(Object.entries(a.probabilities).map(([o, p]) => [o, fmt(p)])))}` : fmt(a.value)}`);
      if (result.warnings?.length) lines.push(`  warnings: ${result.warnings.join(", ")}`);
      if (!result.calibrated) lines.push("  (thresholds are provisional — treat this as advice)");
    }
    io.out.write(lines.join("\n") + "\n");
  }
  if (json && result.error) io.err.write(result.error.message + "\n");
  return code;
}

function say(io, text) { io.out.write(text + "\n"); }

// ------------------------------------------------------- local commands --
function needTTY(io, what) {
  if (!io.isTTY || !io.stdinTTY) {
    throw refuse("usage", `jev: ${what} must be run by you in a Terminal window (not through an agent or Claude Code's ! mode).`);
  }
}

async function ask(io, prompt, { hidden = false } = {}) {
  if (io.prompt) return io.prompt(prompt, { hidden });
  if (!hidden) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((r) => rl.question(prompt, r));
    rl.close();
    return answer;
  }
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((done) => {
    let buf = "";
    const onData = (ch) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off("data", onData); process.stdout.write("\n"); return done(buf); }
        if (c === "\u0003") { process.stdin.setRawMode(false); process.stdout.write("\n"); process.exit(130); }
        if (c === "\u007f") buf = buf.slice(0, -1); else buf += c;
      }
    };
    process.stdin.on("data", onData);
  });
}

async function cmdSetup(args, io) {
  needTTY(io, "jev setup");
  const key = (await ask(io, "jev-ai.pro API key (input hidden): ", { hidden: true })).trim();
  if (!key) throw refuse("no_key", "jev: no key entered; nothing written.");
  await call(io, "GET", "/v1/models", undefined, key, 10_000);
  const f = writeKeyFile(io.env, key);
  say(io, `jev: key checked and saved to ${f} (0600).`);
  return 0;
}

function applySettings(next, flags) {
  if (flags.web) next.web = true;
  if (flags["no-web"]) next.web = false;
  if (flags.cap !== undefined) {
    const n = Number(flags.cap);
    if (!Number.isInteger(n) || n < 1) throw refuse("usage", "jev: --cap takes a whole number ≥ 1.");
    next.max_calls_per_day = n;
  }
  if (flags["keep-cases"]) next.keep_cases = true;
  if (flags["no-keep-cases"]) next.keep_cases = false;
  return next;
}

const SENDS = [
  `         (an independent reseller of TypeSafe's Jev; it may use OpenRouter as a fallback and keep run history).`,
];

async function cmdAllowAll(args, io) {
  const pol = loadPolicy(io.env);
  const next = applySettings({ ...(pol.all || {}), send: true }, args.flags);
  const denied = Object.entries(pol.projects).filter(([, p]) => p.send !== true).map(([n]) => n);
  say(io, [
    `Scope:   every repo on this machine, except ones you deny (jev deny in that repo).`,
    `Sends:   the state, evidence and questions agents pass to jev, from any of those repos, to jev-ai.pro`,
    ...SENDS,
    next.web ? `Web:     jev web also sends its question to a search provider, from any repo.` : `Web:     not allowed (jev allow --all --web to allow).`,
    `Cap:     ${next.max_calls_per_day ? `${next.max_calls_per_day} calls a day per repo` : "none (--cap n to set one)"}.${next.keep_cases ? " Sent states are also kept locally for calibration." : ""}`,
    denied.length ? `Denied:  ${denied.join(", ")} (stay denied)` : `Denied:  none`,
    `Repos you allowed one by one keep their own settings.`,
  ].join("\n"));
  const a = (await ask(io, "Allow all repos? [y/N] ")).trim().toLowerCase();
  if (a !== "y" && a !== "yes") { say(io, "jev: nothing changed."); return 0; }
  pol.all = next;
  say(io, `jev: all repos allowed. Saved to ${savePolicy(io.env, pol)}. Undo with: jev deny --all`);
  return 0;
}

async function cmdAllow(args, io) {
  needTTY(io, "jev allow");
  const { flags } = args;
  if (flags.all) return cmdAllowAll(args, io);
  const id = identify(io.cwd);
  const pol = loadPolicy(io.env);
  const cur = pol.projects[id.name] || {};
  const next = { ...cur, send: true, root: id.root };
  if (flags.web) next.web = true;
  if (flags["no-web"]) next.web = false;
  if (flags.cap !== undefined) {
    const n = Number(flags.cap);
    if (!Number.isInteger(n) || n < 1) throw refuse("usage", "jev: --cap takes a whole number ≥ 1.");
    next.max_calls_per_day = n;
  }
  if (flags["keep-cases"]) next.keep_cases = true;
  if (flags["no-keep-cases"]) next.keep_cases = false;
  if (cur.root && realOr(cur.root) !== id.root) say(io, `Note: "${id.name}" was allowed at ${cur.root}; this moves it to ${id.root}.`);
  say(io, [
    `Project: ${id.name}`,
    `Root:    ${id.root}`,
    `Sends:   the state, evidence and questions agents pass to jev, from this repo, to jev-ai.pro`,
    `         (an independent reseller of TypeSafe's Jev; it may use OpenRouter as a fallback and keep run history).`,
    next.web ? `Web:     jev web also sends its question to a search provider.` : `Web:     not allowed (jev allow --web to allow).`,
    `Cap:     ${next.max_calls_per_day ? `${next.max_calls_per_day} calls a day` : "none (--cap n to set one)"}.${next.keep_cases ? " Sent states are also kept locally for calibration." : ""}`,
  ].join("\n"));
  const a = (await ask(io, "Allow? [y/N] ")).trim().toLowerCase();
  if (a !== "y" && a !== "yes") { say(io, "jev: nothing changed."); return 0; }
  pol.projects[id.name] = next;
  say(io, `jev: allowed. Saved to ${savePolicy(io.env, pol)}.`);
  return 0;
}

function cmdDeny(args, io) {
  const pol = loadPolicy(io.env);
  if (args.flags.all) {
    pol.all = null;
    say(io, `jev: allow-all is off; only repos allowed one by one may send. Saved to ${savePolicy(io.env, pol)}.`);
    return 0;
  }
  const id = identify(io.cwd);
  pol.projects[id.name] = { ...(pol.projects[id.name] || {}), send: false };
  say(io, `jev: "${id.name}" may no longer send${pol.all?.send === true ? ", even with all repos allowed" : ""}. Saved to ${savePolicy(io.env, pol)}.`);
  return 0;
}

const linkPath = (env) => join(env.HOME || homedir(), ".local", "bin", "jev");
const launcher = () => join(PLUGIN_ROOT, "bin", "jev");

function cmdLink(args, io) {
  const lp = linkPath(io.env);
  mkdirSync(dirname(lp), { recursive: true });
  try {
    const st = lstatSync(lp);
    if (!st.isSymbolicLink()) throw refuse("usage", `jev: ${lp} exists and is not a link; not touching it.`);
    unlinkSync(lp);
  } catch (e) { if (e instanceof JevError) throw e; }
  symlinkSync(launcher(), lp);
  mkdirSync(cfgDir(io.env), { recursive: true, mode: 0o700 });
  writeFileSync(join(cfgDir(io.env), "linked"), lp + "\n", { mode: 0o600 });
  say(io, `jev: ${lp} → ${launcher()}. The plugin's startup hook keeps it pointed at the current version.`);
  return 0;
}

function cmdUnlink(args, io) {
  const lp = linkPath(io.env);
  try { if (lstatSync(lp).isSymbolicLink()) unlinkSync(lp); } catch {}
  try { unlinkSync(join(cfgDir(io.env), "linked")); } catch {}
  say(io, `jev: removed ${lp}.`);
  return 0;
}

function cmdForget(args, io) {
  const f = join(cfgDir(io.env), "secrets.env");
  try { unlinkSync(f); say(io, `jev: removed ${f}. If the key is also in plugin config, the next session writes it back — clear it with ${CONFIGURE}.`); }
  catch { say(io, "jev: no key file to remove."); }
  return 0;
}

function cmdOutcome(args, io) {
  const [, runId, ...label] = args._;
  if (!runId || !label.length) throw refuse("usage", "jev: usage: jev outcome <jev_run_id> <what happened> [--note \"…\"]");
  const id = identify(io.cwd);
  const ok = audit(io.env, id.name, { type: "outcome", ts: new Date().toISOString(), jev_run_id: runId, label: label.join(" "), note: args.flags.note ?? null });
  if (!ok) throw new JevError("internal", "internal", "jev: could not write the audit log.");
  say(io, `jev: outcome recorded for ${runId}.`);
  return 0;
}

function cmdJudges(args, io) {
  const lines = ["Shared judges (jev judge <alias>):"];
  const rev = Object.fromEntries(Object.entries(ALIASES).map(([a, f]) => [f, a]));
  for (const f of listJudgeFiles(join(SKILL_DIR, "judges", "agent"))) {
    const name = f.replace(/\.json$/, "");
    let d = "";
    try { d = JSON.parse(readFileSync(join(SKILL_DIR, "judges", "agent", f), "utf8")).description || ""; } catch {}
    lines.push(`  ${(rev[name] || "").padEnd(13)} agent/${name.padEnd(22)} ${d}`);
  }
  let top = null;
  try { top = identify(io.cwd).top; } catch {}
  const local = top ? listJudgeFiles(join(top, ".jev", "judges")) : [];
  if (local.length) {
    lines.push("Project judges (jev judge local/<name>):");
    for (const f of local) {
      let d = "";
      try { d = JSON.parse(readFileSync(join(top, ".jev", "judges", f), "utf8")).description || ""; } catch {}
      lines.push(`  local/${f.replace(/\.json$/, "").padEnd(28)} ${d}`);
    }
  }
  lines.push("Details: jev judge <name> --help");
  say(io, lines.join("\n"));
  return 0;
}

function judgeHelp(ref, io) {
  let top = null;
  try { top = identify(io.cwd).top; } catch {}
  const { id, judge: j } = loadJudge(ref, top);
  say(io, [
    `${id} (revision ${j.revision}, model ${j.model || "jev-1.13.0"})`,
    j.description || "",
    `State fields — required: ${(j.state?.required || []).join(", ") || "none"}; optional: ${(j.state?.optional || []).join(", ") || "none"}`,
    j.pass_requires_attached ? `PASS needs at least ${j.pass_requires_attached} attached evidence item(s): --attach name=file or --attach-cmd name="command".` : "",
    "Example state:",
    JSON.stringify(j.example ?? {}, null, 2),
    `Call: jev judge ${ref} --state - <<'JSON'`, "{…}", "JSON",
  ].filter((l) => l !== "").join("\n"));
  return 0;
}

async function cmdDoctor(args, io) {
  const env = io.env;
  const rows = [];
  const row = (ok, text) => rows.push(`${ok === true ? "ok  " : ok === "warn" ? "warn" : "FAIL"}  ${text}`);
  const major = Number(process.versions.node.split(".")[0]);
  row(major >= 22, `node ${process.versions.node} (needs 22+)`);
  let key = null;
  try { key = readKey(env); row(true, `key file ${join(cfgDir(env), "secrets.env")} (0600)`); }
  catch (e) { row(false, e.message); }
  try {
    const s = JSON.parse(readFileSync(join(cfgDir(env), ".synced"), "utf8"));
    row(true, `key source: plugin config, last synced ${s.ts}`);
  } catch { if (key) row("warn", "key source: jev setup (not plugin config)"); }
  if (env.JEV_AI_API_KEY) row("warn", "JEV_AI_API_KEY is set in the environment; jev ignores it — remove it so the key lives in one place");
  if (key) {
    try { await call(io, "GET", "/v1/models", undefined, key, 10_000); row(true, "key accepted by jev-ai.pro"); }
    catch (e) { row(false, e.message); }
    try {
      const c = await call(io, "GET", "/v1/credits", undefined, key, 10_000);
      row(true, `credits: ${JSON.stringify(c.json)}`);
    } catch (e) { row("warn", `credits: ${e.message}`); }
  }
  try {
    const pol = loadPolicy(env);
    const names = Object.keys(pol.projects);
    row(true, `projects.json: ${names.length} project(s)${pol.all?.send === true ? `; all repos allowed (web ${pol.all.web === true ? "on" : "off"}, cap ${pol.all.max_calls_per_day ? pol.all.max_calls_per_day + "/day" : "none"})` : ""}`);
    for (const [n, p] of Object.entries(pol.projects)) {
      if (p.send === true && (!p.root || !existsSync(p.root))) row("warn", `project "${n}": root ${p.root ?? "(none)"} does not exist`);
    }
  } catch (e) { row(false, e.message); }
  try {
    const dir = join(stateDir(env), "audit");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const probe = join(dir, ".probe");
    writeFileSync(probe, ""); unlinkSync(probe);
    row(true, `audit directory ${dir}`);
  } catch (e) { row(false, `audit directory not writable: ${e.message}`); }
  if (existsSync(join(cfgDir(env), "linked"))) {
    const lp = linkPath(env);
    let target = null;
    try { target = readlinkSync(lp); } catch {}
    row(target === launcher() ? true : "warn", `${lp} → ${target ?? "(missing)"}${target === launcher() ? "" : " (start a new session to re-point it, or run jev link)"}`);
  }
  try {
    const id = identify(io.cwd);
    const { entry, via } = policyFor(loadPolicy(env), id);
    const ok = entry?.send === true && realOr(entry.root || "") === id.root;
    row(ok ? true : "warn",
      `this repo: ${id.name} at ${id.root} — ${entry?.send === true ? (ok ? (via === "all" ? "allowed (all repos)" : "allowed") : "allowed at another path") : entry ? "denied (jev allow in this repo lifts it)" : "not allowed (jev allow, or jev allow --all, in a Terminal window)"}`);
    if (key) {
      const places = [join(env.HOME || homedir(), ".zshrc"), join(env.HOME || homedir(), ".bashrc"), join(env.HOME || homedir(), ".profile")];
      try { for (const f of readdirSync(id.top)) if (f.startsWith(".env")) places.push(join(id.top, f)); } catch {}
      for (const f of places) {
        let text; try { text = readFileSync(f, "utf8"); } catch { continue; }
        text.split("\n").forEach((l, i) => { if (l.includes(key)) row("warn", `a copy of the key is in ${f}:${i + 1}`); });
      }
    }
  } catch { row("warn", "not inside a project (identity checks skipped)"); }
  say(io, rows.join("\n"));
  return rows.some((r) => r.startsWith("FAIL")) ? EXIT.REFUSED : 0;
}

function pct(xs, p) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

function cmdReport(args, io) {
  const { flags } = args;
  const root = join(stateDir(io.env), "audit");
  let projects = [];
  try { projects = readdirSync(root); } catch {}
  if (flags.project) projects = projects.filter((p) => p === flags.project);
  const since = flags.since || "0000";
  const lines = [];
  for (const p of projects.sort()) {
    const recs = readdirSync(join(root, p)).filter((f) => f.endsWith(".jsonl")).flatMap((f) => readJsonl(join(root, p, f))).filter((r) => String(r.ts) >= since);
    const outcomes = new Map(recs.filter((r) => r.type === "outcome").map((r) => [r.jev_run_id, r.label]));
    const by = new Map();
    for (const r of recs.filter((x) => x.type === "call")) {
      const k = r.judge?.id ?? r.command;
      if (!by.has(k)) by.set(k, { PASS: 0, REVIEW: 0, FAIL: 0, NONE: 0, unverified: 0, refused: 0, tokens: 0, lat: [], out: {} });
      const b = by.get(k);
      if (r.refused) b.refused++;
      else if (r.unverified) b.unverified++;
      else b[r.decision ?? "NONE"]++;
      b.tokens += r.input_tokens || 0;
      if (typeof r.latency_ms === "number" && !r.refused) b.lat.push(r.latency_ms);
      const o = r.jev_run_id && outcomes.get(r.jev_run_id);
      if (o) { const key = `${r.decision}→${o}`; b.out[key] = (b.out[key] || 0) + 1; }
    }
    if (!by.size) continue;
    lines.push(`${p}`);
    for (const [k, b] of by) {
      lines.push(`  ${k}: PASS ${b.PASS} · REVIEW ${b.REVIEW} · FAIL ${b.FAIL}${b.NONE ? ` · answers ${b.NONE}` : ""} · unverified ${b.unverified} · refused ${b.refused} · ${b.tokens} input tokens · latency p50 ${pct(b.lat, 50) ?? "–"} ms, p95 ${pct(b.lat, 95) ?? "–"} ms`);
      if (Object.keys(b.out).length) lines.push(`    outcomes: ${Object.entries(b.out).map(([o, n]) => `${o} ${n}`).join(" · ")}`);
    }
  }
  say(io, lines.length ? lines.join("\n") : "jev: no calls recorded yet.");
  return 0;
}

const HELP = `jev — typed second opinions from jev-ai.pro. Jev recommends; you act.

  jev judges                              list judges
  jev judge <name> --state <file|->       run a judge (PASS / REVIEW / FAIL)
      --attach name=file  --attach-cmd name="command"   evidence jev reads itself
  jev judge <name> --help                 state fields and an example
  jev ask --questions <file|-> [--state <file|->] [--pass "q >= 0.8"] [--fail …] [--model m]
  jev web --question "<claim>" [--sources file] [--num-results n]
  jev outcome <jev_run_id> <what happened> [--note …]
  jev report [--project p] [--since YYYY-MM-DD]
  jev doctor                              check setup
  jev allow [--web] [--cap n] [--keep-cases]   (you, in a Terminal) let this repo send
  jev allow --all [--web] [--cap n]       (you, in a Terminal) let every repo send, except denied ones
  jev deny | deny --all                   stop this repo sending | turn allow-all off
  jev setup                               (you, in a Terminal) save a key without plugin config
  jev link | unlink                       add/remove ~/.local/bin/jev for scripts and hooks
  jev forget                              remove the saved key file

Common: --json  --agent <name>  --run <id>  --timeout <ms, max 20000>
Exit: 0 PASS/answers · 3 REVIEW · 4 FAIL · 5 not checked · 64 refused (message says how to fix) · 1 internal`;

// ------------------------------------------------------------------- main --
export async function main(argv, io = {}) {
  io = {
    out: process.stdout, err: process.stderr, cwd: process.cwd(), env: process.env,
    isTTY: !!process.stdout.isTTY, stdinTTY: !!process.stdin.isTTY, ...io,
  };
  let args;
  try { args = parseArgs(argv); } catch (e) { io.err.write(e.message + "\n"); return EXIT.REFUSED; }
  const cmd = args._[0];
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 22) { io.err.write(`jev: needs Node 22 or later; found ${process.versions.node}. Install a newer Node and put it first on PATH.\n`); return EXIT.REFUSED; }
  try {
    if (!cmd || cmd === "help" || (args.flags.help && cmd !== "judge")) { say(io, HELP); return 0; }
    if (cmd === "--self-test" || argv[0] === "--self-test") {
      const r = spawnSync(process.execPath, ["--test", join(SKILL_DIR, "test")], { stdio: "inherit" });
      return r.status ?? EXIT.INTERNAL;
    }
    if (cmd === "judge" && args.flags.help && args._[1]) return judgeHelp(args._[1], io);
    if (cmd === "judge" || cmd === "ask" || cmd === "web") return await evaluate(cmd, args, io);
    const table = { judges: cmdJudges, setup: cmdSetup, allow: cmdAllow, deny: cmdDeny, link: cmdLink, unlink: cmdUnlink, forget: cmdForget, outcome: cmdOutcome, doctor: cmdDoctor, report: cmdReport };
    if (!table[cmd]) throw refuse("usage", `jev: unknown command "${cmd}". Run jev help.`);
    return await table[cmd](args, io);
  } catch (e) {
    const err = e instanceof JevError ? e : new JevError("internal", "internal", `jev: internal error: ${e?.message || e}`);
    io.err.write(err.message + "\n");
    return err.kind === "refused" ? EXIT.REFUSED : err.kind === "unverified" ? EXIT.UNVERIFIED : EXIT.INTERNAL;
  }
}

const invoked = process.argv[1] && (() => { try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); } catch { return false; } })();
if (invoked) main(process.argv.slice(2)).then((c) => { process.exitCode = c; });
