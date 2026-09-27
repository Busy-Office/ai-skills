// node --test skills/jev/test/   — no network, no key: fetch is mocked and
// every run gets its own config, state and git repo under a temp folder.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, statSync, symlinkSync, writeFileSync, chmodSync, readlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  main, EXIT, SKILL_DIR, loadJudge, validateJudge, parseCondition, decide, readAnswers, scanSecrets,
  splitCommand, identify, webVerdict, materialize, extractRules, rulesJudge,
} from "../scripts/jev.mjs";
import { sync, syncLink, syncAllowAll, configKey, flag } from "../scripts/sync-key.mjs";

const KEY = "jev_test_key_0123456789abcdefghij";

function sandbox({ allow = true, web = false, cap, keepCases = false, key = KEY } = {}) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "jev-")));
  const cfg = join(base, "config"), state = join(base, "state"), repo = join(base, "shop-api"), home = join(base, "home");
  mkdirSync(cfg, { recursive: true }); mkdirSync(repo); mkdirSync(home);
  spawnSync("git", ["init", "-q", repo]);
  if (key) writeFileSync(join(cfg, "secrets.env"), `JEV_AI_API_KEY=${key}\n`, { mode: 0o600 });
  if (allow) {
    const entry = { send: true, root: repo, ...(web ? { web: true } : {}), ...(cap ? { max_calls_per_day: cap } : {}), ...(keepCases ? { keep_cases: true } : {}) };
    writeFileSync(join(cfg, "projects.json"), JSON.stringify({ projects: { "shop-api": entry } }));
  }
  return { base, cfg, state, repo, home, env: { JEV_CONFIG_DIR: cfg, JEV_STATE_DIR: state, JEV_TEST_BASE_URL: "https://jev.test/api", HOME: home, PATH: process.env.PATH } };
}

function response(body, { status = 200, headers = {} } = {}) {
  return {
    status, ok: status < 300,
    headers: { get: (h) => ({ "x-jev-run-id": "run-1", "x-jev-billing": "tokens", "x-jev-credits-charged": "0", ...headers })[h.toLowerCase()] ?? null },
    json: async () => body, text: async () => JSON.stringify(body),
  };
}

// A fetch that answers every systemone call from `answers` and records what it was sent.
function jev(answers, opts = {}) {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined });
    if (typeof answers === "function") return answers(calls.length, url, init);
    return response({ model: opts.model ?? "jev-1.13.0", answers, usage: { input_tokens: 612 } }, opts);
  };
  f.calls = calls;
  return f;
}

async function run(sb, argv, { fetch, stdin, isTTY = false, stdinTTY = false, prompt } = {}) {
  let out = "", err = "";
  const code = await main(argv, {
    env: sb.env, cwd: sb.repo, fetch, stdinText: stdin, isTTY, stdinTTY, prompt,
    out: { write: (s) => { out += s; } }, err: { write: (s) => { err += s; } },
  });
  let json = null;
  try { json = JSON.parse(out); } catch {}
  return { code, out, err, json };
}

const auditLines = (sb, project = "shop-api") => {
  const dir = join(sb.state, "audit", project);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => readFileSync(join(dir, f), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)));
};

const completionPass = {
  completion: { type: "choice", choice: "complete", probabilities: { complete: 0.94, incomplete: 0.04, insufficient_evidence: 0.02 } },
  unsupported_claim: { type: "noul", noul: 0.08 },
  scope_respected: { type: "noul", noul: 0.92 },
};
const completionState = JSON.stringify({ objective: "Add CSV export", agent_claim: "Done", evidence: { tests: "PASS 12/12" } });

// ------------------------------------------------------------------ judges --
test("every shared judge loads and validates", () => {
  const files = readdirSync(join(SKILL_DIR, "judges", "agent"));
  assert.equal(files.length, 13);
  for (const f of files) {
    const { judge } = loadJudge(`agent/${f.replace(/\.json$/, "")}`, null);
    assert.ok(judge.example, `${f} has an example`);
    const req = judge.state.required;
    for (const r of req) assert.ok(r in judge.example || judge.pass_requires_attached, `${f} example has ${r}`);
  }
});

test("aliases resolve", () => {
  for (const a of ["completion", "router", "research", "groundedness", "retry", "release", "tool-guard", "pick", "item-check", "progress", "slice-check", "critique-check", "injection"]) loadJudge(a, null);
});

test("loader rejects bad judges with file and field", () => {
  const ok = { revision: 1, questions: { q: { type: "noul", instructions: "x" } }, pass: ["q >= 0.5"] };
  const bad = (j, re) => assert.throws(() => validateJudge(j, "t.json"), (e) => re.test(e.message) && /t\.json/.test(e.message));
  validateJudge(ok, "t.json");
  bad({ ...ok, questions: { "a.b": { type: "noul", instructions: "x" } } }, /questions\.a\.b/);
  bad({ ...ok, questions: { pick: { type: "noul", instructions: "x" } }, pass: ["pick >= 1"] }, /reserved/);
  bad({ ...ok, pass: [] }, /pass/);
  bad({ ...ok, pass: ["nope >= 0.5"] }, /unknown question/);
  bad({ ...ok, on_fail: "continue" }, /on_fail/);
  bad({ ...ok, on_review: "block" }, /on_review/);
  bad({ ...ok, questions: { c: { type: "choice", instructions: "x", criteria: { only: "one" } } }, pass: ["c.only >= 1"] }, /2–255/);
  bad({ ...ok, questions: { s: { type: "score", instructions: "x", criteria: ["a"] } }, pass: ["s >= 1"] }, /2–10/);
  bad({ ...ok, questions: { c: { type: "choice", instructions: "x", criteria: { a: "", b: "" } } }, pass: ["c >= 0.5"] }, /names an option/);
  bad({ ...ok, questions: { c: { type: "choice", instructions: "x", criteria: { a: "", b: "" } } }, pass: ["c.z >= 0.5"] }, /unknown option/);
  const pick = { revision: 1, questions: { r: { type: "choice", instructions: "x", criteria: { a: "", b: "" } } }, pick: { question: "r", min_p: 0.6, below_floor: { decision: "PASS", action: "continue" } } };
  bad(pick, /never PASS/);
  bad({ ...pick, pick: { ...pick.pick, below_floor: { decision: "REVIEW", action: "retry" } } }, /not allowed/);
  bad({ ...ok, revision: 0 }, /revision/);
  bad({ ...ok, questions: Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`q${i}`, { type: "noul", instructions: "x" }])) }, /1–64/);
});

test("conditions parse", () => {
  assert.deepEqual(parseCondition("completion.complete >= 0.85"), { text: "completion.complete >= 0.85", q: "completion", opt: "complete", op: ">=", n: 0.85 });
  assert.equal(parseCondition("a.b.c >= 1"), null);
  assert.equal(parseCondition("a == 1"), null);
});

// --------------------------------------------------------------- decisions --
const completion = loadJudge("completion", null).judge;
const ans = (over = {}) => readAnswers(completion.questions, { ...completionPass, ...over });

test("gate: fail beats pass, pass needs all, else review", () => {
  assert.equal(decide(completion, ans()).decision, "PASS");
  const f = decide(completion, ans({ unsupported_claim: { type: "noul", noul: 0.7 } }));
  assert.equal(f.decision, "FAIL"); assert.equal(f.action, "retry");
  assert.match(f.reasons[0], /unsupported_claim 0.7 >= 0.7/);
  const r = decide(completion, ans({ completion: { type: "choice", probabilities: { complete: 0.84, incomplete: 0.1, insufficient_evidence: 0.06 } } }));
  assert.equal(r.decision, "REVIEW"); assert.equal(r.action, "human_review");
  assert.match(r.reasons[0], /^not: completion.complete 0.84 >= 0.85/);
  assert.equal(decide(completion, ans({ scope_respected: { type: "noul", noul: 0.65 } })).decision, "PASS", "edge: 0.65 >= 0.65");
  assert.equal(decide(completion, ans({ unsupported_claim: { type: "noul", noul: 0.35 } })).decision, "PASS", "edge: 0.35 <= 0.35");
});

test("every gate judge: threshold edges from its own conditions", () => {
  for (const name of ["research", "groundedness", "release", "tool-guard", "item-check", "injection"]) {
    const j = loadJudge(name, null).judge;
    // Build answers exactly at each pass threshold → PASS; then one step past a fail threshold → FAIL.
    const raw = {};
    for (const [id, q] of Object.entries(j.questions)) {
      if (q.type === "choice") { const o = Object.keys(q.criteria); raw[id] = { type: "choice", probabilities: Object.fromEntries(o.map((x) => [x, 0])) }; }
      else if (q.type === "noul") raw[id] = { type: "noul", noul: 0.5 };
      else raw[id] = { type: "score", score: 0 };
    }
    for (const c of j.pass.map(parseCondition)) {
      if (c.opt) raw[c.q].probabilities[c.opt] = c.n;
      else if (raw[c.q].type === "noul") raw[c.q].noul = c.n;
      else raw[c.q].score = c.n;
    }
    assert.equal(decide(j, readAnswers(j.questions, raw)).decision, "PASS", `${name} at pass edges`);
    const fc = parseCondition(j.fail[0]);
    const failing = structuredClone(raw);
    if (fc.opt) failing[fc.q].probabilities[fc.opt] = fc.n;
    else failing[fc.q].noul = fc.n;
    const d = decide(j, readAnswers(j.questions, failing));
    assert.equal(d.decision, "FAIL", `${name} at fail edge`);
    assert.equal(d.action, j.on_fail);
  }
});

test("pick: floor, outcomes, fallback, never PASS for retry", () => {
  const router = loadJudge("router", null).judge;
  const base = { reasoning_need: { type: "score", score: 1 }, needs_research: { type: "noul", noul: 0.1 } };
  const r1 = decide(router, readAnswers(router.questions, { ...base, route: { type: "choice", probabilities: { small_model: 0.7, coding_agent: 0.1, research_agent: 0.1, strong_model: 0.05, human_review: 0.05 } } }));
  assert.deepEqual([r1.decision, r1.action, r1.result.pick, r1.result.fallback], ["PASS", "continue", "small_model", "strong_model"]);
  const r2 = decide(router, readAnswers(router.questions, { ...base, route: { type: "choice", probabilities: { small_model: 0.5, coding_agent: 0.2, research_agent: 0.1, strong_model: 0.1, human_review: 0.1 } } }));
  assert.deepEqual([r2.decision, r2.action, r2.result.pick, r2.result.fallback], ["REVIEW", "escalate", null, "strong_model"]);
  const r3 = decide(router, readAnswers(router.questions, { ...base, route: { type: "choice", probabilities: { small_model: 0, coding_agent: 0, research_agent: 0, strong_model: 0.2, human_review: 0.8 } } }));
  assert.deepEqual([r3.decision, r3.action], ["REVIEW", "human_review"]);
  const retry = loadJudge("retry", null).judge;
  for (const opt of Object.keys(retry.questions.next_step.criteria)) {
    const probs = Object.fromEntries(Object.keys(retry.questions.next_step.criteria).map((o) => [o, o === opt ? 0.9 : 0.1 / 3]));
    const d = decide(retry, readAnswers(retry.questions, { next_step: { type: "choice", probabilities: probs }, progress: { type: "noul", noul: 0.5 } }));
    assert.notEqual(d.decision, "PASS", `retry never PASS (${opt})`);
  }
});

test("missing or mistyped answers are bad_response, never 0", () => {
  assert.throws(() => readAnswers(completion.questions, { ...completionPass, scope_respected: undefined }), (e) => e.code === "bad_response");
  assert.throws(() => readAnswers(completion.questions, { ...completionPass, scope_respected: { type: "noul" } }), (e) => e.code === "bad_response");
  assert.throws(() => readAnswers(completion.questions, { ...completionPass, completion: { type: "choice" } }), (e) => e.code === "bad_response");
});

// ------------------------------------------------------------------ secrets --
test("secret scan: catches secrets, passes ordinary code", () => {
  const hits = {
    private_key: "-----BEGIN RSA PRIVATE KEY-----",
    sk_key: "key sk-proj-abcdefghijklmnopqrstuvwx",
    aws_access_key: "AKIAABCDEFGHIJKLMNOP",
    github_token: "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
    slack_token: "xoxb-1234567890-abcdef",
    jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
    named_secret: "STRIPE_API_KEY=abcdefghijklmnopqrstuvwxyz12",
    bearer_token: "Authorization: Bearer abcdefghijklmnopqrstuvwxyz",
    url_credentials: "postgres://admin:hunter2@db.local/app",
  };
  for (const [name, text] of Object.entries(hits)) assert.equal(scanSecrets({ evidence: { x: text } }), name, name);
  assert.equal(scanSecrets({ env: { DATABASE_PASSWORD: "abcdefghijklmnopqrstuvwxyz12" } }), "named_secret", "as a key/value pair");
  assert.equal(scanSecrets({ x: `hello ${KEY}` }, KEY), "jev_key");
  for (const ok of ["const token = getToken()", "password: z.string()", "Authorization: Bearer ${token}", '"input_tokens": 612', "the risk_assessment_for_deployment_step is fine"]) {
    assert.equal(scanSecrets({ code: ok }), null, ok);
  }
});

test("splitCommand keeps quoted arguments", () => {
  assert.deepEqual(splitCommand(`git diff --stat "main branch" ''`), ["git", "diff", "--stat", "main branch", ""]);
});

// -------------------------------------------------------------- CLI: judge --
test("judge PASS with attached evidence: result, exit 0, audit line", async () => {
  const sb = sandbox();
  writeFileSync(join(sb.repo, "tests.log"), "PASS 12/12\n");
  const f = jev(completionPass);
  const r = await run(sb, ["judge", "completion", "--state", "-", "--attach", "tests=tests.log"], { fetch: f, stdin: completionState });
  assert.equal(r.code, EXIT.PASS, r.out + r.err);
  assert.equal(r.json.decision, "PASS");
  assert.equal(r.json.calibrated, false);
  assert.deepEqual(r.json.evidence_provenance, { tests: "attached" });
  assert.equal(r.json.jev_run_id, "run-1");
  assert.equal(r.json.project, "shop-api");
  assert.equal(r.json.judge.id, "agent/task-completion");
  assert.match(r.json.judge.hash, /^sha256:/);
  const sent = f.calls[0].body;
  assert.equal(sent.model, "jev-1.13.0");
  assert.equal(sent.state.evidence.tests, "PASS 12/12\n");
  assert.equal(f.calls[0].init.headers.authorization, `Bearer ${KEY}`);
  assert.match(f.calls[0].init.headers["user-agent"], /^busy-office-jev\//);
  assert.equal(f.calls[0].init.redirect, "manual");
  const [line] = auditLines(sb);
  assert.equal(line.decision, "PASS");
  assert.equal(line.attachments[0].name, "tests");
  assert.ok(!JSON.stringify(line).includes("PASS 12/12"), "no raw state in the audit");
  assert.ok(!JSON.stringify(line).includes(KEY), "never the key");
  assert.equal(statSync(join(sb.state, "audit", "shop-api")).mode & 0o777, 0o700);
});

test("stated evidence only caps PASS at REVIEW; never touches FAIL", async () => {
  const sb = sandbox();
  const r = await run(sb, ["judge", "completion", "--state", "-"], { fetch: jev(completionPass), stdin: completionState });
  assert.equal(r.code, EXIT.REVIEW);
  assert.ok(r.json.warnings.includes("stated_evidence_only"));
  const r2 = await run(sb, ["judge", "completion", "--state", "-"], { fetch: jev({ ...completionPass, unsupported_claim: { type: "noul", noul: 0.9 } }), stdin: completionState });
  assert.equal(r2.code, EXIT.FAIL);
});

test("attach-cmd runs without a shell and keeps the exit code", async () => {
  const sb = sandbox();
  const f = jev(completionPass);
  const r = await run(sb, ["judge", "completion", "--state", "-", "--attach-cmd", `tests=node -e "console.log('ok; rm -rf /'); process.exit(3)"`], { fetch: f, stdin: completionState });
  assert.equal(r.code, EXIT.PASS, r.err);
  assert.match(f.calls[0].body.state.evidence.tests, /ok; rm -rf \/\n\n\[exit 3\]/);
  assert.equal(auditLines(sb)[0].attachments[0].exit, 3);
});

test("a different model than the pinned one caps PASS at REVIEW", async () => {
  const sb = sandbox();
  writeFileSync(join(sb.repo, "t.log"), "ok");
  const r = await run(sb, ["judge", "completion", "--state", "-", "--attach", "tests=t.log"], { fetch: jev(completionPass, { model: "openrouter/some-model" }), stdin: completionState });
  assert.equal(r.code, EXIT.REVIEW);
  assert.ok(r.json.warnings.includes("model_unexpected"));
});

test("missing required state fields are refused before sending", async () => {
  const sb = sandbox();
  const f = jev(completionPass);
  const r = await run(sb, ["judge", "completion", "--state", "-"], { fetch: f, stdin: JSON.stringify({ objective: "x" }) });
  assert.equal(r.code, EXIT.REFUSED);
  assert.equal(r.json.error.code, "missing_state_fields");
  assert.equal(r.json.decision, "REVIEW");
  assert.equal(r.json.unverified, true);
  assert.equal(f.calls.length, 0);
});

test("a secret in the state is refused, naming the pattern not the value", async () => {
  const sb = sandbox();
  const f = jev(completionPass);
  const r = await run(sb, ["judge", "completion", "--state", "-"], { fetch: f, stdin: JSON.stringify({ objective: "x", agent_claim: "y", evidence: "token ghp_abcdefghijklmnopqrstuvwxyz0123456789" }) });
  assert.equal(r.json.error.code, "secret_detected");
  assert.match(r.json.error.message, /github_token/);
  assert.ok(!r.out.includes("ghp_abc"));
  assert.equal(f.calls.length, 0);
});

test("too large is refused", async () => {
  const sb = sandbox();
  const r = await run(sb, ["judge", "completion", "--state", "-"], { fetch: jev(completionPass), stdin: JSON.stringify({ objective: "x", agent_claim: "y", evidence: "a ".repeat(130_000) }) });
  assert.equal(r.json.error.code, "too_large");
});

// ---------------------------------------------------------- identity/policy --
test("unknown project is refused before anything is sent", async () => {
  const sb = sandbox({ allow: false });
  const f = jev(completionPass);
  const r = await run(sb, ["judge", "completion", "--state", "-"], { fetch: f, stdin: completionState });
  assert.equal(r.code, EXIT.REFUSED);
  assert.equal(r.json.error.code, "project_not_allowed");
  assert.match(r.json.error.message, /jev"? allow/);
  assert.equal(f.calls.length, 0);
});

test("a same-named clone elsewhere is not the allowed project", async () => {
  const sb = sandbox();
  const other = join(sb.base, "elsewhere", "shop-api");
  mkdirSync(other, { recursive: true });
  spawnSync("git", ["init", "-q", other]);
  const f = jev(completionPass);
  let out = "";
  const code = await main(["judge", "completion", "--state", "-"], { env: sb.env, cwd: other, fetch: f, stdinText: completionState, isTTY: false, out: { write: (s) => { out += s; } }, err: { write() {} } });
  assert.equal(code, EXIT.REFUSED);
  assert.equal(JSON.parse(out).error.code, "root_mismatch");
  assert.equal(f.calls.length, 0);
});

test(".jev.json is a label; it cannot change the project", async () => {
  const sb = sandbox();
  writeFileSync(join(sb.repo, ".jev.json"), JSON.stringify({ label: "Shop", project_id: "someone-else" }));
  const id = identify(sb.repo);
  assert.equal(id.name, "shop-api");
  assert.equal(id.label, "Shop");
});

test("worktrees share the main repo's identity", () => {
  const sb = sandbox();
  spawnSync("git", ["-C", sb.repo, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init"]);
  const wt = join(sb.base, "wt");
  const r = spawnSync("git", ["-C", sb.repo, "worktree", "add", "-q", wt]);
  assert.equal(r.status, 0, r.stderr?.toString());
  const id = identify(wt);
  assert.equal(id.name, "shop-api");
  assert.equal(id.root, sb.repo);
  assert.equal(id.top, realpathSync(wt));
});

test("outside git without .jev.json: no_identity, audited as _unresolved", async () => {
  const sb = sandbox();
  const plain = join(sb.base, "plain");
  mkdirSync(plain);
  let out = "";
  const code = await main(["judge", "completion", "--state", "-"], { env: sb.env, cwd: plain, stdinText: completionState, isTTY: false, out: { write: (s) => { out += s; } }, err: { write() {} } });
  assert.equal(code, EXIT.REFUSED);
  assert.equal(JSON.parse(out).error.code, "no_identity");
  assert.equal(auditLines(sb, "_unresolved").length, 1);
});

test("daily cap counts today's sent calls", async () => {
  const sb = sandbox({ cap: 2 });
  writeFileSync(join(sb.repo, "t.log"), "ok");
  const args = ["judge", "completion", "--state", "-", "--attach", "tests=t.log"];
  assert.equal((await run(sb, args, { fetch: jev(completionPass), stdin: completionState })).code, 0);
  assert.equal((await run(sb, args, { fetch: jev(completionPass), stdin: completionState })).code, 0);
  const r = await run(sb, args, { fetch: jev(completionPass), stdin: completionState });
  assert.equal(r.json.error.code, "daily_cap");
});

test("no cap unless one is set", async () => {
  const sb = sandbox();
  mkdirSync(join(sb.state, "audit", "shop-api"), { recursive: true });
  const line = JSON.stringify({ type: "call", ts: new Date().toISOString(), refused: false }) + "\n";
  writeFileSync(join(sb.state, "audit", "shop-api", `${new Date().toISOString().slice(0, 7)}.jsonl`), line.repeat(1000));
  const r = await run(sb, ["judge", "completion", "--state", "-"], { fetch: jev(completionPass), stdin: completionState });
  assert.equal(r.json.unverified, false, "1000 calls today and still not refused");
});

test("keep_cases saves the state locally", async () => {
  const sb = sandbox({ keepCases: true });
  await run(sb, ["judge", "completion", "--state", "-"], { fetch: jev(completionPass), stdin: completionState });
  const dir = join(sb.state, "cases", "shop-api");
  const [f] = readdirSync(dir);
  assert.match(readFileSync(join(dir, f), "utf8"), /Add CSV export/);
});

// ---------------------------------------------------------------- transport --
test("transport: each failure is unverified, never PASS", async () => {
  const cases = [
    [504, "outcome_uncertain", 1],
    [503, "upstream_unavailable", 2],
    [422, "invalid_request", 1],
    [302, "invalid_request", 1],
  ];
  for (const [status, code, n] of cases) {
    const sb = sandbox();
    const f = jev(() => response({ error: "x" }, { status }));
    const r = await run(sb, ["judge", "completion", "--state", "-"], { fetch: f, stdin: completionState });
    assert.equal(r.code, EXIT.UNVERIFIED, `${status}`);
    assert.equal(r.json.error.code, code, `${status}`);
    assert.equal(r.json.decision, "REVIEW");
    assert.equal(r.json.action, "human_review");
    assert.equal(f.calls.length, n, `${status} tries`);
  }
});

test("transport: 429 retries once after Retry-After", async () => {
  const sb = sandbox();
  const f = jev((n) => (n === 1 ? response({}, { status: 429, headers: { "retry-after": "0" } }) : response({ model: "jev-1.13.0", answers: completionPass })));
  const r = await run(sb, ["judge", "completion", "--state", "-"], { fetch: f, stdin: completionState });
  assert.equal(f.calls.length, 2);
  assert.equal(r.code, EXIT.REVIEW, "stated evidence → REVIEW, but it was checked");
  assert.equal(r.json.unverified, false);
});

test("transport: 401 and 402 are refusals with a fix", async () => {
  for (const [status, code] of [[401, "key_rejected"], [402, "balance"]]) {
    const sb = sandbox();
    const r = await run(sb, ["judge", "completion", "--state", "-"], { fetch: jev(() => response({}, { status })), stdin: completionState });
    assert.equal(r.code, EXIT.REFUSED);
    assert.equal(r.json.error.code, code);
  }
});

test("transport: connection refused retries once, then upstream_unavailable; a reset after sending is never retried", async () => {
  const sb = sandbox();
  const refused = jev(() => { const e = new TypeError("fetch failed"); e.cause = { code: "ECONNREFUSED" }; throw e; });
  let r = await run(sb, ["judge", "completion", "--state", "-"], { fetch: refused, stdin: completionState });
  assert.equal(r.json.error.code, "upstream_unavailable");
  assert.equal(refused.calls.length, 2);
  const reset = jev(() => { const e = new TypeError("fetch failed"); e.cause = { code: "ECONNRESET" }; throw e; });
  r = await run(sb, ["judge", "completion", "--state", "-"], { fetch: reset, stdin: completionState });
  assert.equal(r.json.error.code, "outcome_uncertain");
  assert.equal(reset.calls.length, 1);
});

test("no key and a loose key file are refusals", async () => {
  const sb = sandbox({ key: null });
  let r = await run(sb, ["judge", "completion", "--state", "-"], { fetch: jev(completionPass), stdin: completionState });
  assert.equal(r.json.error.code, "no_key");
  assert.match(r.json.error.message, /\/plugin configure busy-office/);
  const sb2 = sandbox();
  chmodSync(join(sb2.cfg, "secrets.env"), 0o644);
  r = await run(sb2, ["judge", "completion", "--state", "-"], { fetch: jev(completionPass), stdin: completionState });
  assert.equal(r.json.error.code, "key_file_mode");
});

test("the environment variable is not a key source", async () => {
  const sb = sandbox({ key: null });
  sb.env.JEV_AI_API_KEY = KEY;
  const r = await run(sb, ["judge", "completion", "--state", "-"], { fetch: jev(completionPass), stdin: completionState });
  assert.equal(r.json.error.code, "no_key");
});

// ---------------------------------------------------------------- ask / web --
test("ask without conditions: answers only, exit 0, decision null", async () => {
  const sb = sandbox();
  const qs = JSON.stringify({ risky: { type: "noul", instructions: "Is this risky?" } });
  const r = await run(sb, ["ask", "--questions", "-"], { fetch: jev({ risky: { type: "noul", noul: 0.2 } }, { model: "jev-1.13.0" }), stdin: qs });
  assert.equal(r.code, 0, r.err);
  assert.equal(r.json.decision, null);
  assert.equal(r.json.result.risky, 0.2);
  assert.equal(r.json.judge.id, "ask");
});

test("ask with conditions decides; only one stdin", async () => {
  const sb = sandbox();
  writeFileSync(join(sb.repo, "q.json"), JSON.stringify({ risky: { type: "noul", instructions: "Is this risky?" } }));
  const r = await run(sb, ["ask", "--questions", "q.json", "--pass", "risky <= 0.3", "--fail", "risky >= 0.7"], { fetch: jev({ risky: { type: "noul", noul: 0.8 } }) });
  assert.equal(r.code, EXIT.FAIL);
  const r2 = await run(sb, ["ask", "--questions", "-", "--state", "-"], { fetch: jev({}), stdin: "{}" });
  assert.equal(r2.code, EXIT.REFUSED);
});

test("web: needs web permission; verdict from the with-evidence answer", async () => {
  let sb = sandbox();
  let r = await run(sb, ["web", "--question", "Node 22 is LTS"], { fetch: jev({}) });
  assert.equal(r.json.error.code, "web_not_allowed");
  sb = sandbox({ web: true });
  const f = jev(() => response({ with_evidence: { noul: 0.9 }, without_evidence: { noul: 0.6 }, sources: [{ url: "https://nodejs.org" }] }));
  r = await run(sb, ["web", "--question", "Node 22 is LTS"], { fetch: f });
  assert.equal(r.code, 0, r.err);
  assert.equal(r.json.result.verdict, "SUPPORTED");
  assert.equal(r.json.result.evidence_shift, 0.3);
  assert.equal(f.calls[0].url, "https://jev.test/api/v1/web-context");
  assert.equal(webVerdict({ with_evidence: 0.1 }).result.verdict, "UNSUPPORTED");
  assert.equal(webVerdict({ with_evidence: 0.5 }).result.verdict, "INSUFFICIENT");
  assert.throws(() => webVerdict({ surprise: 1 }), (e) => e.code === "bad_response" && /surprise/.test(e.message));
});

// ------------------------------------------------------- local commands --
test("Terminal commands in messages work before and after jev link", async () => {
  const sb = sandbox({ allow: false });
  let r = await run(sb, ["judge", "completion", "--state", "-"], { fetch: jev(completionPass), stdin: completionState });
  assert.match(r.json.error.message, /run: ".*\/bin\/jev" allow/, "full launcher path when not linked");
  r = await run(sb, ["allow"]);
  assert.match(r.err, /jev link/);
  await run(sb, ["link"]);
  r = await run(sb, ["judge", "completion", "--state", "-"], { fetch: jev(completionPass), stdin: completionState });
  assert.match(r.json.error.message, /run: jev allow \(/, "plain jev once linked");
});

test("allow and setup refuse without a terminal", async () => {
  const sb = sandbox({ allow: false });
  assert.equal((await run(sb, ["allow"])).code, EXIT.REFUSED);
  assert.equal((await run(sb, ["setup"])).code, EXIT.REFUSED);
});

test("allow writes this repo's root after a yes; no means nothing changes", async () => {
  const sb = sandbox({ allow: false });
  let r = await run(sb, ["allow", "--web", "--cap", "50"], { isTTY: true, stdinTTY: true, prompt: async () => "n" });
  assert.equal(existsSync(join(sb.cfg, "projects.json")), false);
  r = await run(sb, ["allow", "--web", "--cap", "50"], { isTTY: true, stdinTTY: true, prompt: async () => "y" });
  assert.equal(r.code, 0, r.err);
  const p = JSON.parse(readFileSync(join(sb.cfg, "projects.json"), "utf8")).projects["shop-api"];
  assert.deepEqual(p, { send: true, root: sb.repo, web: true, max_calls_per_day: 50 });
  await run(sb, ["allow", "--keep-cases"], { isTTY: true, stdinTTY: true, prompt: async () => "y" });
  assert.equal(JSON.parse(readFileSync(join(sb.cfg, "projects.json"), "utf8")).projects["shop-api"].keep_cases, true, "--keep-cases is saved, other settings kept");
  assert.equal(JSON.parse(readFileSync(join(sb.cfg, "projects.json"), "utf8")).projects["shop-api"].web, true);
  await run(sb, ["deny"]);
  assert.equal(JSON.parse(readFileSync(join(sb.cfg, "projects.json"), "utf8")).projects["shop-api"].send, false);
});

test("allow --all: any repo may send, denied repos stay blocked, web needs its own opt-in", async () => {
  const sb = sandbox({ allow: false });
  const tty = { isTTY: true, stdinTTY: true };
  assert.equal((await run(sb, ["allow", "--all"])).code, EXIT.REFUSED, "needs a terminal");
  await run(sb, ["allow", "--all"], { ...tty, prompt: async () => "n" });
  assert.equal(existsSync(join(sb.cfg, "projects.json")), false, "no means nothing changes");
  const r = await run(sb, ["allow", "--all", "--cap", "40"], { ...tty, prompt: async () => "y" });
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(readFileSync(join(sb.cfg, "projects.json"), "utf8")).all, { send: true, max_calls_per_day: 40 });

  // a repo never allowed one by one now sends
  const other = join(sb.base, "elsewhere", "docs-site");
  mkdirSync(other, { recursive: true });
  spawnSync("git", ["init", "-q", other]);
  const call = async (cwd, argv = ["judge", "completion", "--state", "-"]) => {
    let out = "";
    const f = jev(completionPass);
    const code = await main(argv, { env: sb.env, cwd, fetch: f, stdinText: completionState, isTTY: false, out: { write: (s) => { out += s; } }, err: { write() {} } });
    return { code, json: JSON.parse(out), calls: f.calls.length };
  };
  let c = await call(other);
  assert.equal(c.calls, 1, "sent under allow-all");
  assert.equal(c.json.unverified, false);

  // web is off unless allow --all --web
  c = await call(other, ["web", "--question", "x"]);
  assert.equal(c.json.error.code, "web_not_allowed");
  assert.match(c.json.error.message, /jev"? allow --all --web/);

  // a denied repo stays blocked, and the message says why
  await run(sb, ["deny"]);
  c = await call(sb.repo);
  assert.equal(c.json.error.code, "project_not_allowed");
  assert.match(c.json.error.message, /denied even though all repos are allowed/);
  assert.equal(c.calls, 0);

  // deny --all turns it off; per-repo entries survive
  await run(sb, ["deny", "--all"]);
  const pol = JSON.parse(readFileSync(join(sb.cfg, "projects.json"), "utf8"));
  assert.equal(pol.all, undefined);
  assert.equal(pol.projects["shop-api"].send, false);
  c = await call(other);
  assert.equal(c.json.error.code, "project_not_allowed");
});

test("a repo allowed one by one keeps its own root check under allow-all", async () => {
  const sb = sandbox();
  const pol = JSON.parse(readFileSync(join(sb.cfg, "projects.json"), "utf8"));
  pol.all = { send: true };
  writeFileSync(join(sb.cfg, "projects.json"), JSON.stringify(pol));
  const clone = join(sb.base, "elsewhere", "shop-api");
  mkdirSync(clone, { recursive: true });
  spawnSync("git", ["init", "-q", clone]);
  let out = "";
  await main(["judge", "completion", "--state", "-"], { env: sb.env, cwd: clone, fetch: jev(completionPass), stdinText: completionState, isTTY: false, out: { write: (s) => { out += s; } }, err: { write() {} } });
  assert.equal(JSON.parse(out).error.code, "root_mismatch");
});

test("setup checks the key before writing it", async () => {
  const sb = sandbox({ key: null });
  let r = await run(sb, ["setup"], { isTTY: true, stdinTTY: true, prompt: async () => "bad", fetch: jev(() => response({}, { status: 401 })) });
  assert.equal(r.code, EXIT.REFUSED);
  assert.equal(existsSync(join(sb.cfg, "secrets.env")), false);
  r = await run(sb, ["setup"], { isTTY: true, stdinTTY: true, prompt: async () => KEY, fetch: jev(() => response({ data: [] })) });
  assert.equal(r.code, 0);
  assert.equal(statSync(join(sb.cfg, "secrets.env")).mode & 0o777, 0o600);
});

test("outcome is joined to its call in the report", async () => {
  const sb = sandbox();
  await run(sb, ["judge", "completion", "--state", "-"], { fetch: jev(completionPass), stdin: completionState });
  assert.equal((await run(sb, ["outcome", "run-1", "tests", "failed", "later"])).code, 0);
  const r = await run(sb, ["report"]);
  assert.match(r.out, /agent\/task-completion: PASS 0 · REVIEW 1/);
  assert.match(r.out, /REVIEW→tests failed later 1/);
});

test("a local judge is found under .jev/judges and can't shadow a shared one", async () => {
  const sb = sandbox();
  mkdirSync(join(sb.repo, ".jev", "judges"), { recursive: true });
  writeFileSync(join(sb.repo, ".jev", "judges", "completion.json"), JSON.stringify({ revision: 1, questions: { ok: { type: "noul", instructions: "ok?" } }, pass: ["ok >= 0.5"] }));
  const r = await run(sb, ["judge", "local/completion", "--state", "-"], { fetch: jev({ ok: { type: "noul", noul: 0.9 } }, { model: "jev-1.13.0" }), stdin: "{}" });
  assert.equal(r.code, 0, r.err);
  assert.equal(r.json.judge.id, "local/completion");
  assert.equal(loadJudge("completion", sb.repo).id, "agent/task-completion");
});

// --------------------------------------------------------------- the hook --
test("hook: writes the key from plugin config, silently, 0600", () => {
  const sb = sandbox({ key: null });
  let said = "";
  const env = { ...sb.env, CLAUDE_PLUGIN_OPTION_API_KEY: KEY };
  assert.equal(sync(env, (s) => { said += s; }), "written");
  assert.equal(said, "");
  assert.equal(readFileSync(join(sb.cfg, "secrets.env"), "utf8"), `JEV_AI_API_KEY=${KEY}\n`);
  assert.equal(statSync(join(sb.cfg, "secrets.env")).mode & 0o777, 0o600);
  assert.equal(sync(env, (s) => { said += s; }), "same");
  assert.equal(sync({ ...env, CLAUDE_PLUGIN_OPTION_API_KEY: KEY + "x" }), "written", "a changed config key replaces the file");
});

test("hook: one line when there is no key anywhere; never prints a key", () => {
  const sb = sandbox({ key: null });
  let said = "";
  assert.equal(sync(sb.env, (s) => { said += s; }), "not_set_up");
  assert.match(said, /\/plugin configure busy-office/);
  const sb2 = sandbox();
  said = "";
  assert.equal(sync(sb2.env, (s) => { said += s; }), "file_only");
  assert.equal(said, "");
  assert.equal(configKey({ CLAUDE_PLUGIN_OPTION_API_KEY: "${user_config.api_key}" }), null);
  assert.equal(configKey({ CLAUDE_PLUGIN_OPTION_api_key: " k " }), "k");
});

test("hook: run as a process it exits 0 and prints nothing when set up", () => {
  const sb = sandbox();
  const r = spawnSync(process.execPath, [join(SKILL_DIR, "scripts", "sync-key.mjs")], { env: { ...sb.env, CLAUDE_PLUGIN_OPTION_API_KEY: KEY }, encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
  const t0 = Date.now();
  spawnSync(process.execPath, [join(SKILL_DIR, "scripts", "sync-key.mjs")], { env: { HOME: "/nonexistent/x", JEV_CONFIG_DIR: "/nonexistent/x" } });
  assert.ok(Date.now() - t0 < 2000);
});

test("hook: add_to_path creates, re-points and removes only its own link", () => {
  const sb = sandbox();
  const lp = join(sb.home, ".local", "bin", "jev");
  const on = { ...sb.env, CLAUDE_PLUGIN_OPTION_ADD_TO_PATH: "true" };
  const off = { ...sb.env, CLAUDE_PLUGIN_OPTION_ADD_TO_PATH: "false" };
  assert.equal(syncLink(off, "/v1/bin/jev"), "off", "off: nothing made");
  assert.equal(existsSync(lp), false);
  assert.equal(syncLink(sb.env, "/v1/bin/jev"), "linked", "default is on");
  assert.equal(readlinkSync(lp), "/v1/bin/jev");
  assert.equal(syncLink(on, "/v1/bin/jev"), "same");
  assert.equal(syncLink(on, "/v2/bin/jev"), "relinked", "follows plugin updates");
  assert.equal(readlinkSync(lp), "/v2/bin/jev");
  assert.equal(syncLink(off, "/v2/bin/jev"), "removed", "turning it off removes the hook's own link");
  assert.equal(existsSync(lp), false);
});

test("hook: never touches a file or link it didn't make; keeps the user's jev link", () => {
  const sb = sandbox();
  const lp = join(sb.home, ".local", "bin", "jev");
  mkdirSync(dirname(lp), { recursive: true });
  writeFileSync(lp, "#!/bin/sh\necho mine\n");
  assert.equal(syncLink(sb.env, "/v1/bin/jev"), "not_a_link");
  assert.equal(readFileSync(lp, "utf8"), "#!/bin/sh\necho mine\n");
  const sb2 = sandbox();
  const lp2 = join(sb2.home, ".local", "bin", "jev");
  mkdirSync(dirname(lp2), { recursive: true });
  symlinkSync("/someone/else/jev", lp2);
  assert.equal(syncLink(sb2.env, "/v1/bin/jev"), "foreign_link");
  assert.equal(readlinkSync(lp2), "/someone/else/jev");
  const sb3 = sandbox();
  const lp3 = join(sb3.home, ".local", "bin", "jev");
  mkdirSync(dirname(lp3), { recursive: true });
  symlinkSync("/old/bin/jev", lp3);
  writeFileSync(join(sb3.cfg, "linked"), "user\n");
  const off = { ...sb3.env, CLAUDE_PLUGIN_OPTION_ADD_TO_PATH: "false" };
  assert.equal(syncLink(off, "/v2/bin/jev"), "relinked", "a jev link the user made is kept current even with the setting off");
});

test("hook: allow_all_repos sets and clears only its own allow-all", () => {
  const sb = sandbox();
  const read = () => JSON.parse(readFileSync(join(sb.cfg, "projects.json"), "utf8"));
  const on = { ...sb.env, CLAUDE_PLUGIN_OPTION_ALLOW_ALL_REPOS: "true" };
  const off = { ...sb.env, CLAUDE_PLUGIN_OPTION_ALLOW_ALL_REPOS: "false" };
  assert.equal(syncAllowAll(sb.env), "same", "default is off");
  assert.equal(syncAllowAll(on), "allowed_all");
  assert.deepEqual(read().all, { send: true, by: "config" });
  assert.equal(read().projects["shop-api"].send, true, "per-repo entries kept");
  assert.equal(syncAllowAll(on), "same");
  assert.equal(syncAllowAll(off), "removed_all");
  assert.equal(read().all, undefined);
  // an allow-all the user set by hand is not the setting's to remove
  const pol = read(); pol.all = { send: true }; writeFileSync(join(sb.cfg, "projects.json"), JSON.stringify(pol));
  assert.equal(syncAllowAll(off), "same");
  assert.deepEqual(read().all, { send: true });
  assert.equal(flag({ CLAUDE_PLUGIN_OPTION_allow_all_repos: "1" }, "ALLOW_ALL_REPOS", false), true, "option name matched in any case");
});

test("hook-set allow-all lets an unlisted repo send; jev allow --all takes ownership", async () => {
  const sb = sandbox({ allow: false });
  syncAllowAll({ ...sb.env, CLAUDE_PLUGIN_OPTION_ALLOW_ALL_REPOS: "true" });
  const r = await run(sb, ["judge", "completion", "--state", "-"], { fetch: jev(completionPass), stdin: completionState });
  assert.equal(r.json.unverified, false);
  await run(sb, ["allow", "--all", "--web"], { isTTY: true, stdinTTY: true, prompt: async () => "y" });
  const all = JSON.parse(readFileSync(join(sb.cfg, "projects.json"), "utf8")).all;
  assert.deepEqual(all, { send: true, web: true });
  assert.equal(syncAllowAll({ ...sb.env, CLAUDE_PLUGIN_OPTION_ALLOW_ALL_REPOS: "false" }), "same", "turning the setting off leaves a hand-set allow-all");
});

test("the launcher runs through a symlink", () => {
  const sb = sandbox();
  const launcher = join(SKILL_DIR, "..", "..", "bin", "jev");
  const link = join(sb.base, "jev");
  symlinkSync(launcher, link);
  const r = spawnSync(link, ["help"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /typed second opinions/);
});

// ------------------------------------------------------------ loop judges --
test("criteria_from: options come from the state; conditions can't name them", async () => {
  const q = { next: { type: "choice", instructions: "x", criteria_from: "candidates" } };
  const m = materialize(q, { candidates: { "UI-12": "date picker", "API-4": "pagination" } });
  assert.deepEqual(Object.keys(m.next.criteria), ["UI-12", "API-4"]);
  assert.equal(m.next.criteria_from, undefined);
  assert.deepEqual(Object.keys(materialize(q, { candidates: [{ id: "a1", text: "x" }, { id: "b2", title: "y" }] }).next.criteria), ["a1", "b2"]);
  assert.throws(() => materialize(q, { candidates: { only: "one" } }), (e) => e.code === "missing_state_fields");
  assert.throws(() => materialize(q, { candidates: { "bad id!": "x", ok: "y" } }), (e) => e.code === "usage");
  assert.throws(() => validateJudge({ revision: 1, questions: q, pass: ["next.x >= 0.5"] }, "t"), /come from the state/);

  const sb = sandbox();
  const f = jev({ next: { type: "choice", probabilities: { "UI-12": 0.8, "API-4": 0.2 } }, any_ready: { type: "noul", noul: 0.9 } });
  const r = await run(sb, ["judge", "pick", "--state", "-"], { fetch: f, stdin: JSON.stringify({ candidates: { "UI-12": "date picker", "API-4": "pagination" } }) });
  assert.equal(r.code, 0, r.err);
  assert.equal(r.json.result.pick, "UI-12");
  assert.deepEqual(Object.keys(f.calls[0].body.questions.next.criteria), ["UI-12", "API-4"], "sent with the options filled in");
});

test("rules-check: one question per rule, outside code blocks, narrowed by section", () => {
  const md = "# Project\n\n## Style\n- Use the logger, never console.log in src/\n- Keep components under 200 lines\n\n```\n- not a rule inside code\n```\n\n## Data\n1. Every migration must be reversible with a down step\n- short\n";
  assert.deepEqual(extractRules(md), ["Use the logger, never console.log in src/", "Keep components under 200 lines", "Every migration must be reversible with a down step"]);
  assert.deepEqual(extractRules(md, "data"), ["Every migration must be reversible with a down step"]);
  const g = rulesJudge(extractRules(md), "CLAUDE.md");
  assert.equal(Object.keys(g.judge.questions).length, 3);
  assert.match(g.judge.questions.r3.instructions, /reversible/);
  assert.throws(() => rulesJudge([], "x.md"), /no rules/);
  assert.throws(() => rulesJudge(Array.from({ length: 65 }, (_, i) => `rule number ${i} is long enough`), "x.md"), /limit is 64/);
});

test("rules-check end to end: a violated rule fails and is named in reasons", async () => {
  const sb = sandbox();
  writeFileSync(join(sb.repo, "CLAUDE.md"), "## Rules\n- Use the logger, never console.log in src/\n- Every migration must be reversible with a down step\n");
  writeFileSync(join(sb.repo, "d.diff"), "+ console.log('x')\n");
  const f = jev({
    r1: { type: "choice", probabilities: { complies: 0.05, violates: 0.9, not_applicable: 0.03, insufficient_evidence: 0.02 } },
    r2: { type: "choice", probabilities: { complies: 0.02, violates: 0.01, not_applicable: 0.95, insufficient_evidence: 0.02 } },
  });
  const r = await run(sb, ["rules-check", "--attach", "diff=d.diff"], { fetch: f });
  assert.equal(r.code, EXIT.FAIL, r.out + r.err);
  assert.equal(r.json.judge.id, "rules-check");
  assert.match(r.json.reasons[0], /^r1 "Use the logger/);
  assert.match(f.calls[0].body.questions.r1.instructions, /evidence\.diff/);
});

test("hook pre-tool-use: ignores harmless commands, denies on block, asks on review, silent on allow or failure", async () => {
  const sb = sandbox();
  const hook = async (command, answers, opts) => {
    const f = answers ? jev(answers, opts) : jev(() => { throw new Error("should not be called"); });
    let out = "";
    const code = await main(["hook", "pre-tool-use"], { env: sb.env, cwd: sb.repo, fetch: f, isTTY: false,
      stdinText: JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd: sb.repo }),
      out: { write: (x) => { out += x; } }, err: { write() {} } });
    return { code, out: out ? JSON.parse(out) : null, calls: f.calls.length };
  };
  const guard = (p, needs) => ({ decision: { type: "choice", probabilities: p }, needs_confirmation: { type: "noul", noul: needs } });
  let h = await hook("ls -la");
  assert.deepEqual([h.code, h.out, h.calls], [0, null, 0], "not consequential: no call");
  h = await hook("rm -rf ./build", guard({ allow: 0.02, confirm: 0.03, review: 0.05, deny: 0.9 }, 0.9));
  assert.equal(h.out.hookSpecificOutput.permissionDecision, "deny");
  h = await hook("git push origin main", guard({ allow: 0.5, confirm: 0.4, review: 0.05, deny: 0.05 }, 0.6));
  assert.equal(h.out.hookSpecificOutput.permissionDecision, "ask");
  h = await hook("git push origin main", guard({ allow: 0.95, confirm: 0.03, review: 0.01, deny: 0.01 }, 0.1));
  assert.equal(h.out, null, "allow never grants permission; the normal flow decides");
  h = await hook("git push origin main", null);
  const sb2 = sandbox({ allow: false });
  let out = "";
  await main(["hook", "pre-tool-use"], { env: sb2.env, cwd: sb2.repo, isTTY: false, stdinText: JSON.stringify({ tool_name: "Bash", tool_input: { command: "rm -rf x" }, cwd: sb2.repo }), out: { write: (x) => { out += x; } }, err: { write() {} } });
  assert.equal(out, "", "repo not allowed: silent");
});

test("progress and slice-check map outcomes to loop actions", () => {
  const prog = loadJudge("progress", null).judge;
  const p = (probs) => decide(prog, readAnswers(prog.questions, { change: { type: "choice", probabilities: probs }, met: { type: "noul", noul: 0.3 } }));
  assert.deepEqual([p({ improved: 0.8, no_change: 0.1, worse: 0.1 }).decision], ["PASS"]);
  assert.deepEqual([p({ improved: 0.1, no_change: 0.8, worse: 0.1 }).action], ["block"], "plateau: stop, keep the best");
  assert.deepEqual([p({ improved: 0.1, no_change: 0.1, worse: 0.8 }).action], ["retry"]);
  const sl = loadJudge("slice-check", null).judge;
  const q = (probs) => decide(sl, readAnswers(sl.questions, { kind: { type: "choice", probabilities: probs }, traces: { type: "noul", noul: 0.9 } }));
  assert.equal(q({ implied_next_step: 0.8, new_direction: 0.1, unrelated: 0.1 }).decision, "PASS");
  assert.deepEqual([q({ implied_next_step: 0.1, new_direction: 0.8, unrelated: 0.1 }).action], ["human_review"], "a new direction is gated");
  assert.equal(q({ implied_next_step: 0.1, new_direction: 0.1, unrelated: 0.8 }).decision, "FAIL");
});
