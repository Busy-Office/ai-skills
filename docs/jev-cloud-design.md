# jev in Claude Code cloud sessions — design

Date: 2026-09-26 · Status: proposal, reviewed; **build waits on the spike (§9)**
· Owner: thepfmind

Extends [`jev-design.md`](jev-design.md) (the `jev` skill in the busy-office
plugin). That design runs on the user's own machine and lists cloud access as
out of scope (Q24). This document adds one thing: using `jev` **inside Claude
Code cloud sessions** (claude.ai/code, including routines), without the
jev-ai.pro key ever entering the session.

Everything else — judges, conditions, the result shape, exit codes, the secret
scan, transport and failure rules — is unchanged and not repeated here.

## 1. Purpose

A cloud session is a fresh Anthropic-hosted VM with the repository cloned. An
agent there, even one steered by prompt injection from a web page, a file or a
tool result, must be able to ask Jev for a verdict, and must **not** be able to:

1. read, print or send the jev-ai.pro key, or obtain another one;
2. use Jev from a repository the user has not chosen for it by mistake;
3. leave the user without a trace of which decisions Jev made;
4. spend more than the user set aside for cloud use.

**Success:** in a cloud session started in the user's `jev` environment on an
allowed repository, `jev judge completion` returns PASS / REVIEW / FAIL; no
jev-ai.pro key is anywhere in the VM; each decision can be traced from the
commit it was about to jev-ai.pro's run history; cloud spending stops at the
limit on the dedicated key.

## 2. Decisions

Numbering continues from `jev-design.md`.

| # | Decision | Choice |
|---|---|---|
| Q25 | Where cloud support applies | Claude Code cloud sessions in Anthropic-hosted environments (interactive and routines). Not claude.ai chat, Cowork, self-hosted environments or hosted CI. |
| Q26 | Key | A dedicated jev-ai.pro key, registered as an **API credential** on the cloud environment (Pro and Max plans). Anthropic's agent proxy adds `Authorization: Bearer …` to requests for `jev-ai.pro` after they leave the VM. Never an environment variable, never in the setup script, never in a repo. **Precondition:** no jev-ai.pro route that accepts that key can create keys, reveal keys or change billing (§9 check 3); otherwise the design needs an evaluate-only key from jev-ai.pro first. |
| Q27 | CLI mode | **Proxy mode** (`JEV_AUTH=proxy`): `jev` sends no key and relies on the proxy. Before any state leaves the VM, a keyless probe must prove the proxy is attaching the credential. Only a success is remembered. |
| Q28 | Delivery | The **skill** is enabled on claude.ai, which cloud sessions load automatically. The environment's **setup script** installs only the **CLI**, from this public repo at a pinned **commit hash**, verified after checkout. |
| Q29 | Environments | **One shared `jev` environment** holds the credential. The user starts sessions in it only for repositories allowed to send data. |
| Q30 | Policy in the cloud | `projects.json` does not exist in the VM. `JEV_ALLOWED_PROJECTS` (an environment variable) lists the repositories `jev` accepts. It guards against mistakes; it is not a lock (§8). |
| Q31 | Audit in the cloud | The in-VM audit is thrown away with the VM. Decisions are recorded as **git commit trailers** (`Jev-Decision: …`), printed by `jev trailers`; jev-ai.pro's run history is the tamper-proof record. |
| Q32 | Go/no-go | A spike (§9) confirms the credential works from Anthropic's network and from Node, that the key cannot be used to obtain another key, and how the VM is laid out, before anything is built. |
| Q33 | Spending | The real limit is the **balance or spending limit on the dedicated key** in jev-ai.pro. `jev`'s per-session cap only slows one runaway session: every session is a fresh VM, so a routine gets a fresh cap each run. |
| Q34 | Identity in the cloud | Always the last path segment of `git remote get-url origin` (without `.git`), never the clone folder, whose path Anthropic chooses and does not document. |
| Q35 | Transport fallback | If Node's `fetch` cannot use the session's proxy even with the spike's fixes, proxy mode sends through `curl` (which uses the system certificate store). Same request, same rules. |

## 3. How cloud sessions work (facts this design relies on)

From the Claude Code documentation (`cloud-environments`, `network-config`,
`hooks`), checked 2026-09-26:

| Fact | Status | Consequence |
|---|---|---|
| Each session is a fresh Ubuntu 24.04 VM with the repo cloned; Node 22 on PATH (`/opt/node22`). | documented | `jev` runs on Node 22 (it requires ≥ 22). |
| User `~/.claude/skills` and plugins do **not** carry over; a repo's `enabledPlugins` are **not** installed. Skills enabled on claude.ai load automatically. | documented | The busy-office plugin is absent. The skill comes from claude.ai (Q28). |
| A setup script runs as root before Claude Code launches. Its result is cached and rebuilt when the script or network hosts change and after about seven days. A non-zero exit stops the session from starting; it should finish in about five minutes. | documented | Install the CLI there; never exit non-zero. |
| Environment variables are copied into every session and are readable by every command Claude runs. | documented | Never put the key in them. |
| **API credentials** (Pro and Max; not Team or Enterprise yet): the agent proxy adds the key to requests for the listed hosts after they leave the VM; the key "never reaches Claude, the commands it runs, or the session's environment variables". Default type Bearer: header `Authorization`, prefix `Bearer`. | documented | The key stays out of the VM. |
| The proxy attaches the key to **any** request to a listed host, whatever the path. | follows from the above | Every jev-ai.pro route the key can call is reachable by an agent (Q26 precondition, §8). |
| jev-ai.pro answers `401` to `/v1/models` and `/v1/credits` without a key. | tested 2026-09-26 | A keyless `200` proves the proxy attached the credential (Q27). |
| Network levels: None, Trusted (allowlisted domains incl. GitHub and `raw.githubusercontent.com`), Full, Custom. GitHub operations go through a dedicated proxy. | documented | Cloning a public repo in the setup script works at Trusted. |
| The session can read its id from `CLAUDE_CODE_REMOTE_SESSION_ID`; Claude's commits get a `Claude-Session:` trailer. | documented | Proxy mode requires that variable; `Jev-Decision:` trailers sit next to `Claude-Session:`. |
| Hooks from the repo's `.claude/settings.json` run in a session with one repository. | documented | Not needed here; noted for a later opt-in Stop hook. |
| Whether Node's built-in `fetch` uses the session's proxy and trusts its certificate. | **not documented** (only `NODE_EXTRA_CA_CERTS` is) | A proxy that adds headers must decrypt TLS, so the VM must trust its certificate; Node doesn't read the system store by default → spike check 2, fallback Q35. |
| Clone path, the user commands run as, `HOME`. | **not documented** | Spike check 5; identity doesn't depend on them (Q34). |
| Whether a skill written into the VM's `~/.claude/skills` loads. | **not documented** | Not relied on (Q28). |

## 4. Architecture

```
 claude.ai  ──  skill "jev" enabled (loads in every cloud session)
            ──  environment "jev"
                 ├─ API credential: host jev-ai.pro, Authorization: Bearer <jev-cloud key>
                 ├─ variables: JEV_AUTH=proxy, JEV_ALLOWED_PROJECTS="repo-a repo-b:web"
                 └─ setup script: install the jev CLI from Busy-Office/ai-skills @ <commit>

 session VM (no key anywhere)
   agent ──► jev judge completion ──► https://jev-ai.pro/api/v1/systemone   (no Authorization header)
                                            │
                              Anthropic agent proxy adds Authorization: Bearer …
                                            ▼
                                       jev-ai.pro  (spending stops at the key's limit)
   agent ──► jev trailers ──► "Jev-Decision: …" lines in the commit message
```

## 5. Environment setup (done once by the user)

1. **Key:** create a dedicated key on jev-ai.pro (e.g. `jev-cloud`), so cloud
   use can be revoked on its own, and give it (or the account) a balance or
   spending limit you are willing to lose to a runaway routine (Q33).
2. **Skill:** enable the `jev` skill on claude.ai (upload `skills/jev` from
   this repo at the same commit as step 5).
3. **Environment:** at claude.ai/code create an environment named `jev`
   (network level: Trusted), then edit it → **API credentials** → Add: type
   Bearer, allowed host `jev-ai.pro`, header `Authorization`, prefix `Bearer`,
   value = the key.
4. **Variables** (not secret):

   ```
   JEV_AUTH=proxy
   JEV_ALLOWED_PROJECTS=repo-a repo-b:web
   ```

   Entries are repository names (as in `origin`) separated by spaces; `:web`
   also allows `jev web`. Optional `JEV_DAILY_CAP` (default 300 calls per
   session). Add whichever Node setting the spike needed (§9 check 2).
5. **Setup script:** paste `skills/jev/cloud/setup.sh` from this repo. It:
   - clones `https://github.com/Busy-Office/ai-skills` into
     `/opt/busy-office-ai-skills`, checks out the pinned **commit hash**, and
     verifies `git rev-parse HEAD` equals it; if the clone fails, fetches the
     files in `skills/jev/cloud/files.txt` from `raw.githubusercontent.com` at
     that hash and checks each against the sha256 listed next to it;
   - links `/usr/local/bin/jev` to the launcher;
   - never fails the session: on any error it prints one warning and exits 0
     (then `jev` is simply absent, which the skill already handles).

   The hash is changed deliberately when a new version should reach the cloud,
   together with the skill upload in step 2.
6. **Check:** start a session in `jev` on an allowed repo and ask Claude to
   run `jev doctor`.

## 6. CLI changes (`skills/jev/scripts/jev.mjs`)

### 6.1 Proxy mode

Active when `JEV_AUTH=proxy`. Then:

- **Must be a cloud session:** `CLAUDE_CODE_REMOTE_SESSION_ID` must be set,
  else refuse `proxy_mode_unavailable` ("JEV_AUTH=proxy works only in Claude
  Code cloud sessions").
- **No key:** `readKey` is skipped; requests carry no `Authorization` header.
  If `JEV_AI_API_KEY` is present in the environment, `jev` refuses
  `key_in_environment` (the key is readable by everyone using the
  environment; move it to an API credential and delete the variable).
- **Proof before sending:** before the first request that carries state,
  `jev` sends a keyless `GET /v1/models`. Only a `200` proves the proxy
  attached the credential, and only a `200` is remembered (in the state
  directory, keyed by `CLAUDE_CODE_REMOTE_SESSION_ID`); any failure is retried
  on the next call. Otherwise it refuses, and no state has left the VM:

  | Probe result | `error.code` | Message says |
  |---|---|---|
  | 401 | `proxy_credential_missing` | add a Bearer API credential for host `jev-ai.pro` to this environment on claude.ai, then start a new session |
  | 403 | `proxy_blocked` | jev-ai.pro refused traffic from Anthropic's network |
  | TLS or proxy error from Node, and from `curl` | `proxy_unreachable` | the session's proxy could not be used; see the spike's notes (§9) |

- **Transport:** Node `fetch` first. If the probe fails with a TLS or proxy
  error and `curl` succeeds, proxy mode uses `curl` for the rest of the
  session (Q35): request body on stdin, `--max-time`, no redirects
  (`--max-redirs 0`), status and headers parsed from `--write-out` / `-D`.
  Retry and never-PASS rules are unchanged.
- **Policy:** the project name must be in `JEV_ALLOWED_PROJECTS`
  (`project_not_allowed`), `jev web` needs its `:web` suffix
  (`web_not_allowed`), and the per-session cap is `JEV_DAILY_CAP`
  (`daily_cap`). Messages point to the environment's variables on claude.ai,
  not to `jev allow` or `/plugin configure`.
- **Identity:** the last path segment of `git remote get-url origin`, without
  `.git` (Q34). No `origin` → refuse `no_identity`.
- **Unchanged:** judges, conditions, secret scan (minus the exact-key check,
  as there is no key to compare), size limits, retries, the
  never-PASS-on-failure rule, exit codes.
- **Local commands:** `jev setup`, `allow`, `deny`, `link` and `forget`
  refuse in proxy mode with a one-line pointer to the environment settings.

### 6.2 `jev trailers`

Prints one line per call made since the last commit (audit lines newer than
`git log -1 --format=%cI`), including unverified ones:

```
Jev-Decision: completion PASS 0.94 run=01JB8…
Jev-Decision: release UNVERIFIED rate_limited
```

`jev outcome <run_id> "<what happened>"` additionally prints
`Jev-Outcome: run=<id> <what happened>` in proxy mode, for the next commit.

Both work locally too; nothing about them depends on proxy mode.

### 6.3 `jev doctor` in proxy mode

Replaces the local checks (key file, plugin sync, `projects.json`, link, key
copies in shell profiles), which don't apply in the cloud, with: Node version;
`CLAUDE_CODE_REMOTE_SESSION_ID` present; `JEV_AI_API_KEY` absent;
`JEV_ALLOWED_PROJECTS` parses and names this repository (from `origin`); the
probe result and the transport in use (`fetch` or `curl`); the installed
commit hash; credits via the proxy (`GET /v1/credits`).

## 7. Skill changes (`skills/jev/SKILL.md`)

A short "Cloud sessions" section:

- In a cloud session with `JEV_AUTH=proxy`, `jev` works without a key; never
  look for one, and never call jev-ai.pro directly (curl, fetch).
- When committing, add the output of `jev trailers` to the commit message.
- Refusals in the cloud are fixed in the environment settings on claude.ai;
  relay the message to the user as it is.
- If `jev` is not found in a cloud session, the environment has no setup
  script for it: say so and carry on without the check.

## 8. Threat model

| Threat | Result |
|---|---|
| Agent reads, prints or sends the key | **Prevented.** The key is never in the VM: not in files, variables, the setup script or the repo. |
| Agent uses the credential to create or reveal another key, or change billing | **Prevented only if** jev-ai.pro has no such route for API keys (Q26 precondition, §9 check 3). If it has, stop: the design needs an evaluate-only key first. |
| Agent tricks the proxy into sending the key elsewhere | **Prevented.** The proxy attaches it only to `jev-ai.pro`; setup-script, GitHub, Anthropic API and package-registry requests never get it. |
| Key leaked some other way | **Contained.** It is a dedicated cloud key; revoking it affects only cloud sessions. |
| Agent in a repo that should not send | **Mostly prevented by setup.** Only sessions in the `jev` environment have the credential; the user chooses which repos run there. `JEV_ALLOWED_PROJECTS` catches a wrong repo by mistake. |
| Agent bypasses `jev` and calls jev-ai.pro with curl | **Not prevented.** The proxy attaches the credential to any request to that host. The data still only reaches the user's own jev-ai.pro account, but it skips the secret scan, the allowlist, the cap and the trailers. The skill forbids it; this is an accepted risk. |
| Agent overrides `JEV_AUTH`, `JEV_ALLOWED_PROJECTS` or `JEV_DAILY_CAP` for its own commands | **Not prevented** — they are guards against mistakes, not locks (Q30). |
| Agent, or a routine run many times, burns the balance | **Bounded by the key's balance or spending limit** (Q33) and jev-ai.pro's rate limit. `jev`'s cap only slows one session. The dedicated key can be revoked at once. |
| Agent forges or drops trailers | **Detectable.** Trailers are a convenience; jev-ai.pro's run history is the authoritative record, matched by run id. |
| A malicious version of the CLI reaches the VM | **Limited** to the pinned commit hash, which cannot be moved to other code the way a tag can; the setup script verifies it. The skill on claude.ai is updated by hand to the same commit. |

What reaches jev-ai.pro — and, per its privacy page, possibly its fallback
provider — is unchanged from local use; the environment choice is where the
user decides which repositories may send.

## 9. Spike (before building)

About fifteen minutes in claude.ai, with nothing built yet:

1. Create the `jev-cloud` key with a small balance or spending limit, and the
   `jev` environment with the API credential (§5 steps 1 and 3).
2. Start a session in it on any repository and ask Claude to run each check
   below, reporting only status codes, error codes and the listed values:

   ```bash
   # check 1 — credential attached (curl)
   curl -s -o /dev/null -w '%{http_code}\n' https://jev-ai.pro/api/v1/models
   # check 2 — Node fetch through the proxy; if not 200, retry with each fix
   node -e "fetch('https://jev-ai.pro/api/v1/models').then(r=>console.log(r.status)).catch(e=>console.log(e.cause?.code||e.message))"
   NODE_USE_ENV_PROXY=1 node -e "…same…"
   NODE_OPTIONS=--use-system-ca node -e "…same…"
   NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt node -e "…same…"
   # check 4 — the key is not in the VM
   env | grep -ci 'jev-ai' ; grep -rl "Bearer" /etc/environment ~ 2>/dev/null | head
   # check 5 — layout
   whoami ; echo "$HOME" ; pwd ; git remote get-url origin ; node --version
   ```

3. **Check 3 — the key can't obtain another key.** From jev-ai.pro's API
   reference, list every route that concerns keys, billing or the account.
   Call each from the session with an empty body (`curl -s -o /dev/null -w
   '%{http_code}' -X <method> …`). Every one must answer `401`, `403` or
   `404`. Also confirm on jev-ai.pro whether API keys can be scoped to
   evaluation only.
4. **Check 6 — the skill loads.** With `jev` enabled on claude.ai, ask in
   the session: "which skills do you have?" — `jev` must be listed.

| Result | Meaning | Next |
|---|---|---|
| checks 1, 2 = 200, check 3 all 401/403/404, check 4 = 0 / none, check 6 listed | Works as designed | Build (§11). Record user, HOME, clone folder, origin form and Node version. |
| curl 200, Node fails, a fix works | Node needs a setting | Put the working setting in the environment variables and in `setup.sh`'s notes. |
| curl 200, Node fails with every fix | Node can't use the proxy | Build with the `curl` transport (Q35). |
| curl 401 | Credential not attached | Recheck host `jev-ai.pro`, header `Authorization`, prefix `Bearer`. |
| curl 403 | jev-ai.pro (Cloudflare) blocks Anthropic's network | **Stop.** Ask jev-ai.pro to allow it. |
| check 3: any key or billing route answers 2xx | The key can mint or reveal keys, or spend | **Stop.** Revoke the `jev-cloud` key; wait for an evaluate-only key from jev-ai.pro. |
| check 6: not listed | claude.ai skills don't reach this session | Fall back to linking the skill from the setup script, after check 5 shows the session's `HOME`. |

## 10. Tests

Added to `skills/jev/test/` (no network):

- proxy mode sends no `Authorization` header; refuses without
  `CLAUDE_CODE_REMOTE_SESSION_ID`; refuses with `JEV_AI_API_KEY` in the
  environment;
- the probe: 200 → proceeds and is remembered for the session; 401 / 403 /
  network error → the right refusal, **no state request is made**, and
  nothing is remembered (the next call probes again);
- transport fallback: a TLS error from `fetch` with a working `curl` switches
  to `curl`; the `curl` path sends the same body, refuses redirects, and maps
  status codes exactly like `fetch`;
- identity from `origin` (https and ssh forms, with and without `.git`); no
  `origin` → `no_identity`;
- `JEV_ALLOWED_PROJECTS` parsing, `:web`, `JEV_DAILY_CAP`;
- cloud-specific messages for each refusal; local-only commands refuse;
  `doctor` shows only the cloud rows;
- `jev trailers` since the last commit, including unverified calls;
  `jev outcome` trailer;
- `setup.sh`: exits 0 on clone failure and on a hash mismatch (and installs
  nothing then); the raw-file fallback installs the same files and rejects
  one whose sha256 doesn't match `files.txt`.

## 11. Changes to this repo

| File | Change |
|---|---|
| `skills/jev/scripts/jev.mjs` | proxy mode, probe, `curl` transport, origin identity, cloud policy and messages, `trailers`, `outcome` trailer, cloud doctor |
| `skills/jev/cloud/setup.sh`, `skills/jev/cloud/files.txt` | new (files.txt lists path and sha256) |
| `skills/jev/SKILL.md` | "Cloud sessions" section (§7) |
| `skills/jev/test/jev.test.mjs` | §10 |
| `docs/jev-design.md` | Q24: cloud sessions supported as described here; drop "cloud" from out of scope |
| `README.md` | a short "Cloud sessions" setup section |
| `.claude-plugin/plugin.json`, `marketplace.json` | version bump |

## 12. Out of scope

- Moving existing cloud users of Jev that keep a key in environment variables
  onto an API credential (recommended as a follow-up for each of them).
- Team and Enterprise plans (no API credentials yet), self-hosted
  environments, claude.ai chat, Cowork, hosted CI.
- A relay service of our own; revisit only if per-project policy or audit in
  the cloud must hold even against an agent that bypasses `jev`, or if
  jev-ai.pro can't offer a key that is safe to expose to the proxy.

## 13. Effort

| Work | Days |
|---|---|
| Spike (user, in claude.ai) | 0.15 |
| Proxy mode, probe, origin identity, cloud policy and messages, doctor | 0.5 |
| `curl` transport fallback | 0.25 |
| `jev trailers`, outcome trailer | 0.25 |
| `setup.sh` + `files.txt` (hashes) + fallback | 0.25 |
| SKILL.md, README, design doc, tests | 0.4 |
| **Total** | **~1.8** |
