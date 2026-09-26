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
jev-ai.pro key is anywhere in the VM; each decision's commit trailer names its
Jev run id (and the run can be found in jev-ai.pro's history, if spike check 7
confirms API runs are listed there); cloud spending is bounded by the limit
the user set on jev-ai.pro (Q33).

## 2. Decisions

Numbering continues from `jev-design.md`.

| # | Decision | Choice |
|---|---|---|
| Q25 | Where cloud support applies | Claude Code cloud sessions in Anthropic-hosted environments (interactive and routines). Not claude.ai chat, Cowork, self-hosted environments or hosted CI. |
| Q26 | Key | A dedicated jev-ai.pro key, registered as an **API credential** on the cloud environment (Pro and Max plans). Anthropic's agent proxy adds `Authorization: Bearer …` to requests for `jev-ai.pro` after they leave the VM. Never an environment variable, never in the setup script, never in a repo. **Precondition:** no jev-ai.pro route that accepts that key can create keys, reveal keys or change billing (§9 check 3); otherwise the design needs an evaluate-only key from jev-ai.pro first. |
| Q27 | CLI mode | **Proxy mode** (`JEV_AUTH=proxy`): `jev` sends no key and relies on the proxy. Before any state leaves the VM, a keyless probe must prove the proxy is attaching the credential. Only a success is remembered. |
| Q28 | Delivery | The **skill** is enabled on claude.ai, which cloud sessions load automatically. The environment's **setup script** installs only the **CLI**, from this public repo at a pinned **commit hash**, verified after checkout. |
| Q29 | Environments | **One shared `jev` environment** holds the credential. The user starts sessions in it only for repositories allowed to send data. |
| Q30 | Policy in the cloud | `projects.json` does not exist in the VM. `JEV_ALLOWED_PROJECTS` (an environment variable) lists the repositories `jev` accepts, as `owner/repo`. It guards against mistakes; it is not a lock (§8). |
| Q31 | Audit in the cloud | The in-VM audit is thrown away with the VM. Decisions are recorded as **git commit trailers** (`Jev-Decision: …`), printed by `jev trailers`. Each trailer carries the Jev run id; whether jev-ai.pro lists API runs in its history, where the id could be looked up, is spike check 7. A trailer shows that a Jev call happened, not that `jev` made it with honest evidence. |
| Q32 | Go/no-go | A spike (§9) confirms the credential works from Anthropic's network and from Node, that the key cannot be used to obtain another key, and how the VM is laid out, before anything is built. |
| Q33 | Spending | The real limit is the **balance or spending limit on jev-ai.pro**. As researched, jev-ai.pro has one balance per account, shared by every key including local use, and keys carry no quota of their own; spike check 3 asks whether a per-key limit exists. `jev` sets no call cap of its own (Q36). |
| Q34 | Identity in the cloud | `owner/repo` from the last two path segments of `git remote get-url origin` (without `.git`), never the clone folder, whose path Anthropic chooses and does not document. `JEV_ALLOWED_PROJECTS` is matched against `owner/repo`, so a fork or another owner's repo with the same name doesn't pass; the audit folder uses the repo name. |
| Q35 | Transport fallback | If Node's `fetch` cannot use the session's proxy even with the spike's fixes, proxy mode sends through `curl` (which uses the system certificate store). Same request, same rules. |
| Q36 | Call cap | **No default cap**, locally or in the cloud: a repository may make as many calls as it needs. A cap applies only when the user sets one (`jev allow --cap n` locally, `JEV_DAILY_CAP` in the cloud). This replaces the local default of 300 calls a day per repository. Spending is bounded on jev-ai.pro (Q33). |

### 2.1 Where the jev-ai.pro key is stored

| | Local (the plugin today) | Cloud (this design) |
|---|---|---|
| Entered | when the plugin is installed or enabled, or later with `/plugin configure busy-office` (or `jev setup` in a Terminal window) | once, on claude.ai: environment `jev` → **API credentials** |
| Stored | Claude Code's secure storage, as the plugin's sensitive `api_key` setting; a SessionStart hook copies it to `~/.config/jev/secrets.env` (0600), the only place `jev` reads it | Anthropic's credential store for that environment; it cannot be viewed again after saving |
| Reachable by the agent | **Yes** — anything running as the user can read the file (the local threat model, `jev-design.md` Q19) | **No** — not in the VM's files, variables, setup script or repo |
| Which key | the user's main key | a dedicated `jev-cloud` key |
| Revoke or replace | jev-ai.pro → API Keys, then `/plugin configure busy-office` | jev-ai.pro → API Keys, then delete and re-add the credential on claude.ai |

Never in chat, a repository, a cloud environment variable or a setup script.

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
| jev-ai.pro answers `401` to `/v1/models` and `/v1/credits` without a key (with `server: cloudflare` and a `cf-ray` header). | tested 2026-09-26 | A keyless `200` proves the proxy attached the credential (Q27). |
| At the Trusted level `jev-ai.pro` is reachable only through a matching credential. A request to a host outside the allowlist fails at Anthropic's proxy with `403` and `x-deny-reason: host_not_allowed` (routines documentation). | documented | A `403` without Cloudflare's headers means the credential's host is wrong or missing, not that jev-ai.pro blocks Anthropic (§6.1). |
| Network levels: None, Trusted (allowlisted domains incl. GitHub and `raw.githubusercontent.com`), Full, Custom. GitHub operations go through a dedicated proxy. | documented | Cloning a public repo in the setup script works at Trusted. |
| The session can read its id from `CLAUDE_CODE_REMOTE_SESSION_ID`; Claude's commits get a `Claude-Session:` trailer. | documented | Proxy mode requires that variable; `Jev-Decision:` trailers sit next to `Claude-Session:`. |
| Hooks from the repo's `.claude/settings.json` run in a session with one repository. | documented | Not needed here; noted for a later opt-in Stop hook. |
| Whether Node's built-in `fetch` uses the session's proxy and trusts its certificate. | **not documented** (only `NODE_EXTRA_CA_CERTS` is) | A proxy that adds headers must decrypt TLS, so the VM must trust its certificate; Node doesn't read the system store by default → spike check 2, fallback Q35. On Node 22, `NODE_USE_ENV_PROXY` exists only from v22.21.0 and is silently ignored before. |
| Clone path, the user commands run as, `HOME`. | **not documented** | Spike check 5; identity doesn't depend on them (Q34). |
| Whether a skill written into the VM's `~/.claude/skills` loads. | **not documented** | Not relied on (Q28). |

## 4. Architecture

```
 claude.ai  ──  skill "jev" enabled (loads in every cloud session)
            ──  environment "jev"
                 ├─ API credential: host jev-ai.pro, Authorization: Bearer <jev-cloud key>
                 ├─ variables: JEV_AUTH=proxy, JEV_ALLOWED_PROJECTS="me/repo-a me/repo-b:web"
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
   spending limit you are willing to lose to a runaway routine (Q33). An
   account-level limit also caps local use, since every key shares the balance.
2. **Skill:** enable the `jev` skill on claude.ai (upload `skills/jev` from
   this repo at the same commit as step 5).
3. **Environment:** at claude.ai/code create an environment named `jev`
   (network level: Trusted), then edit it → **API credentials** → Add: type
   Bearer, allowed host `jev-ai.pro`, header `Authorization`, prefix `Bearer`,
   value = the key.
4. **Variables** (not secret):

   ```
   JEV_AUTH=proxy
   JEV_ALLOWED_PROJECTS=me/repo-a me/repo-b:web
   ```

   Entries are `owner/repo` (as in `origin`) separated by spaces; `:web` also
   allows `jev web`. Optional `JEV_DAILY_CAP` (calls per session; unset means
   no cap, Q36).
   Running sessions don't re-read variables: changes apply to new sessions.
   The Node setting the spike needed (§9 check 2), if any, goes into the `jev`
   wrapper that `setup.sh` writes, not into these variables, so it affects
   only `jev`.
5. **Setup script:** paste `skills/jev/cloud/setup.sh` from this repo. It:
   - starts with `set +e` (the setup field may run under `set -e`, and an
     unguarded failure would stop every session from starting);
   - fetches into a temporary folder (`--max-time 30`, two tries): clones
     `https://github.com/Busy-Office/ai-skills`, checks out the pinned
     **commit hash**, and verifies `git rev-parse HEAD` equals it; if the
     clone fails, fetches the files in `skills/jev/cloud/files.txt` from
     `raw.githubusercontent.com` at that hash and checks each against the
     sha256 listed next to it (`files.txt` includes
     `.claude-plugin/plugin.json`, which the CLI reads its version from);
   - checks that `node <tmp>/bin/jev judges` exits 0, then moves the folder to
     `/opt/busy-office-ai-skills`;
   - writes `/usr/local/bin/jev` last, as a two-line `sh` wrapper
     (`exec node /opt/busy-office-ai-skills/bin/jev "$@"`, plus the Node
     setting from the spike if one was needed), so raw-fetched files need no
     execute bit;
   - never fails the session: on any error it installs nothing, prints
     `jev not installed; edit this environment's setup script on claude.ai to
     retry`, and exits 0. A setup that exits 0 is cached for about seven days,
     so a failed install stays failed until the script is edited.

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
- **Cloud session without proxy mode:** if `CLAUDE_CODE_REMOTE_SESSION_ID` is
  set but `JEV_AUTH` is not, the `no_key` message says to run the session in
  the `jev` environment (API credential plus `JEV_AUTH=proxy`, §5), not to run
  `/plugin configure` or `jev setup`, neither of which exists in the VM.
- **No key:** `readKey` is skipped; requests carry no `Authorization` header.
  If `JEV_AI_API_KEY` is present in the environment, `jev` refuses
  `key_in_environment` (the key is readable by everyone using the
  environment; move it to an API credential and delete the variable).
- **Proof before sending:** before the first request that carries state,
  `jev` sends a keyless `GET /v1/models`. Only a `200` proves the proxy
  attached the credential, and only a `200` is remembered (in the state
  directory, keyed by `CLAUDE_CODE_REMOTE_SESSION_ID`); any failure is retried
  on the next call. Otherwise no state has left the VM, and:

  | Probe result | `error.code` | Exit | Message says |
  |---|---|---|---|
  | `403` from Anthropic's proxy (`x-deny-reason: host_not_allowed`, or the proxy refuses the connection) | `proxy_credential_missing` | 64 | no API credential in this environment matches host exactly `jev-ai.pro`; add one on claude.ai, then start a new session |
  | `401` (from jev-ai.pro: the credential was attached but the key is wrong or revoked) | `key_rejected` | 64 | jev-ai.pro rejected the credential; check the key is active on jev-ai.pro, delete and re-add the credential on claude.ai (Bearer, host `jev-ai.pro`), then start a new session |
  | `403` with `cf-ray` or `server: cloudflare` | `proxy_blocked` | 64 | jev-ai.pro refused traffic from Anthropic's network |
  | DNS, connection or TLS error from Node, and from `curl` (e.g. `ENOTFOUND`, `ECONNREFUSED`, `CERT_*`) | `proxy_unreachable` | 64 | the session's proxy could not be used; see the spike's notes (§9) |
  | `429`, `5xx` or a timeout | existing unverified codes | 5 | as today; not remembered, so the next call probes again |

  The same `401` / `403` mapping and cloud messages apply to **every** request
  in proxy mode, not only the probe, so a key revoked mid-session is reported
  with the cloud message, not the local `/plugin configure` one.

- **Transport:** Node `fetch` first. If the probe fails with a TLS or proxy
  error and `curl` succeeds, proxy mode uses `curl` for the rest of the
  session (Q35): request body on stdin, `--max-time`, no redirects
  (`--max-redirs 0`), status and headers parsed from `--write-out` / `-D`.
  Retry and never-PASS rules are unchanged.
- **Policy:** the project's `owner/repo` must be in `JEV_ALLOWED_PROJECTS`
  (`project_not_allowed`), `jev web` needs its `:web` suffix
  (`web_not_allowed`), and only if `JEV_DAILY_CAP` is set are calls beyond it
  refused (`daily_cap`). Each message ends "…in this environment's variables on
  claude.ai, then start a new session", not `jev allow` or `/plugin configure`.
- **Identity:** `owner/repo` from the last two path segments of
  `git remote get-url origin`, without `.git` (Q34); the repo name alone names
  the audit folder. No `origin` → refuse `no_identity`.
- **Unchanged:** judges, conditions, secret scan (minus the exact-key check,
  as there is no key to compare), size limits, retries, the
  never-PASS-on-failure rule, exit codes.
- **Local commands:** `jev setup`, `allow`, `deny`, `link` and `forget`
  refuse in proxy mode with a one-line pointer to the environment settings.

### 6.2 `jev trailers`

Prints one line per audit record since the last commit: audit lines of
`type: "call"` with `refused` false, and of `type: "outcome"`, whose `ts`,
**parsed as a time**, is after HEAD's **author** date
(`git log -1 --format=%aI`, which `git pull --rebase` and `--amend` keep; the
committer date they rewrite would drop calls). It reads this month's and last
month's files.

```
Jev-Decision: completion PASS 0.94 run=01JB8…
Jev-Decision: release UNVERIFIED rate_limited
Jev-Decision: ask ANSWERS run=01JB9…
Jev-Outcome: run=01JB8… tests failed after merge
```

Line format: `Jev-Decision: <alias (reverse of ALIASES), else judge id, else
command> <decision | UNVERIFIED <error code> when unverified | ANSWERS when the
decision is null> [<confidence>] [run=<id> when present]`. `jev outcome` is
unchanged; its record reaches the commit through `jev trailers`.

Meant for cloud sessions (one VM, one session). Locally the audit is shared by
every session and worktree of the repo, so the lines may include their calls.

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
- Never set, export or prefix a `JEV_*` variable to get past a refusal; they
  are the user's environment settings on claude.ai.
- When committing, add the output of `jev trailers` to the commit message. In
  the cloud, these trailers are the audit.
- In the cloud, relay a refusal as it is; its message says whether the fix is
  in the environment settings on claude.ai or on jev-ai.pro.
- If `jev` is not found in a cloud session, it was not installed in this
  environment (no setup script, or its install failed and was cached): tell
  the user and carry on without the check.

## 8. Threat model

| Threat | Result |
|---|---|
| Agent reads, prints or sends the key | **Prevented.** The key is never in the VM: not in files, variables, the setup script or the repo. |
| Agent uses the credential to create or reveal another key, or change billing | **Prevented only if** jev-ai.pro has no such route for API keys (Q26 precondition, §9 check 3). If it has, stop: the design needs an evaluate-only key first. |
| Agent tricks the proxy into sending the key elsewhere | **Prevented.** The proxy attaches it only to `jev-ai.pro`; setup-script, GitHub, Anthropic API and package-registry requests never get it. |
| Key leaked some other way | **Revocable on its own.** It is a dedicated cloud key; revoking it affects only cloud sessions. Until it is revoked it spends the shared account balance. |
| Agent in a repo that should not send | **Mostly prevented by setup.** Only sessions in the `jev` environment have the credential; the user chooses which repos run there. `JEV_ALLOWED_PROJECTS` catches a wrong repo by mistake. |
| Agent bypasses `jev` and calls jev-ai.pro with curl | **Not prevented.** The proxy attaches the credential to any request to that host. The data reaches the user's own jev-ai.pro account (and, through `/v1/web-context`, also its search provider, skipping the `:web` gate), but it skips the secret scan, the allowlist, the cap and the trailers. The skill forbids it; this is an accepted risk. |
| Agent overrides `JEV_AUTH`, `JEV_ALLOWED_PROJECTS` or `JEV_DAILY_CAP` for its own commands | **Not prevented** — they are guards against mistakes, not locks (Q30). |
| Agent, or a routine run many times, burns the balance | **Not prevented; bounded** by the limit the user set on jev-ai.pro (Q33: the account balance, shared with local use, unless check 3 finds a per-key limit) and jev-ai.pro's per-account rate limit. `jev` has no cap by default; an optional `JEV_DAILY_CAP` stops only `jev`'s own loops, not a direct curl. Revoking the cloud key stops it at once. |
| Agent forges or drops trailers | **Not prevented.** A trailer's run id shows that a Jev call happened (findable in jev-ai.pro's history if check 7 confirms it), not that `jev` made it with honest evidence; a dropped trailer is not detectable. |
| A malicious version of the CLI reaches the VM | **Limited** to the pinned commit hash, which cannot be moved to other code the way a tag can; the setup script verifies it. The skill on claude.ai is updated by hand to the same commit. |

What reaches jev-ai.pro — and, per its privacy page, possibly its fallback
provider — is unchanged from local use; the environment choice is where the
user decides which repositories may send.

## 9. Spike (before building)

About twenty minutes in claude.ai, with nothing built yet:

1. Create the `jev-cloud` key with a small balance or spending limit, and the
   `jev` environment with the API credential (§5 steps 1 and 3). Give the
   environment this throwaway setup script, to test the setup context itself:

   ```bash
   { id -un; echo "$HOME"; } > /var/tmp/jev-spike.log
   git clone -q --depth 1 https://github.com/Busy-Office/ai-skills /opt/jev-spike-clone >> /var/tmp/jev-spike.log 2>&1
   curl -fsS --max-time 30 -o /opt/jev-spike-raw https://raw.githubusercontent.com/Busy-Office/ai-skills/HEAD/bin/jev >> /var/tmp/jev-spike.log 2>&1
   exit 0
   ```

2. Start a session in it on any repository and ask Claude to run each check
   below, reporting only status codes, header names, error codes and the
   listed values (never the proxy URL, which carries a session token). All
   requests use a non-default User-Agent, because Cloudflare blocks some
   default ones:

   ```bash
   # check 1 — credential attached (curl), with who answered
   curl -sS -D - -o /dev/null -A busy-office-jev/spike -w 'code=%{http_code} connect=%{http_connect}\n' \
     https://jev-ai.pro/api/v1/models | grep -iE '^HTTP|^server|cf-ray|x-deny-reason|^code='
   # check 2 — Node fetch through the proxy; if not 200, retry with the fixes, then combined
   node -v ; env | cut -d= -f1 | grep -iE 'proxy|ca_cert|ssl_cert'
   node -e "fetch('https://jev-ai.pro/api/v1/models',{headers:{'user-agent':'busy-office-jev/spike'}}).then(r=>console.log(r.status)).catch(e=>console.log(e.cause?.code||e.message))"
   NODE_USE_ENV_PROXY=1 node -e "…same…"
   NODE_OPTIONS=--use-system-ca node -e "…same…"
   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt node -e "…same…"
   # check 4 — the key is not in the VM (expect 0)
   env | grep -ciE 'JEV_AI_API_KEY|authorization|bearer'
   # check 5 — layout, and what the setup script saw
   whoami ; echo "$HOME" ; pwd ; git remote get-url origin
   cat /var/tmp/jev-spike.log ; ls -d /opt/jev-spike-clone /opt/jev-spike-raw
   # check 7 — one tiny call, to look up afterwards in jev-ai.pro's run history
   curl -sS -D - -o /dev/null -A busy-office-jev/spike -H 'content-type: application/json' \
     -d '{"state":"spike","questions":{"ok":{"type":"noul","instructions":"Is the state the word spike?"}}}' \
     https://jev-ai.pro/api/v1/systemone | grep -i x-jev-run-id
   ```

   Then find that run id in the jev-ai.pro web app. Start a **second**
   session (it starts from the cached snapshot) and repeat check 5.

3. **Check 3 — the key can't obtain another key.** From jev-ai.pro's API
   reference, list every route that concerns keys, billing or the account.
   Call each from the session with an empty body (`curl -s -o /dev/null -w
   '%{http_code}' -X <method> …`). Every one must answer `401`, `403` or
   `404`. Also confirm on jev-ai.pro whether API keys can be scoped to
   evaluation only, and whether a key can carry its own spending limit (Q33).
4. **Check 6 — the skill loads.** With `jev` enabled on claude.ai, ask in
   the session: "which skills do you have?" — `jev` must be listed.

| Result | Meaning | Next |
|---|---|---|
| checks 1, 2 = 200, check 3 all 401/403/404, check 4 = 0, check 6 listed | Works as designed | Build (§11). Record user, HOME, clone folder, origin form and Node version. |
| curl 200, Node fails, a fix works | Node needs a setting | Put the working setting in the `jev` wrapper `setup.sh` writes (§5 step 5). |
| curl 200, Node fails with every fix, or Node < 22.21 | Node can't use the proxy | Build with the `curl` transport (Q35). |
| `403` with `x-deny-reason: host_not_allowed`, or `connect=403` | The proxy found no credential for this host | Recheck the credential's host: exactly `jev-ai.pro`. |
| `401` | jev-ai.pro got a key and rejected it | Check the key is active; delete and re-add the credential (Bearer, `Authorization`, prefix `Bearer`). |
| `403` with `cf-ray` / `server: cloudflare` | jev-ai.pro (Cloudflare) blocks Anthropic's network | **Stop.** Ask jev-ai.pro to allow it. |
| check 5: the clone worked in the setup script | Raw fallback not needed | Drop `files.txt`, the raw fallback and its test. |
| check 5: neither clone nor raw fetch worked in the setup script | The setup context can't fetch the CLI | Stop and revisit delivery before building. |
| check 7: the run id is not in jev-ai.pro's history | API runs are not listed | Drop the "findable in history" wording from Q31, §1 and §8; trailers stay as the only record. |
| check 3: any key or billing route answers 2xx | The key can mint or reveal keys, or spend | **Stop.** Revoke the `jev-cloud` key; wait for an evaluate-only key from jev-ai.pro. |
| check 6: not listed | claude.ai skills don't reach this session | Fall back to linking the skill from the setup script, after check 5 shows the session's `HOME`. |

## 10. Tests

Added to `skills/jev/test/` (no network):

- proxy mode sends no `Authorization` header; refuses without
  `CLAUDE_CODE_REMOTE_SESSION_ID`; refuses with `JEV_AI_API_KEY` in the
  environment;
- the probe: 200 → proceeds and is remembered for the session; each row of
  the §6.1 table (proxy `403` with `host_not_allowed`, `401`, Cloudflare
  `403`, `ENOTFOUND` / TLS error, `429` / `5xx` / timeout) → the right code and
  exit, **no state request is made**, and nothing is remembered (the next call
  probes again); a `401` after a remembered probe gives the cloud message;
- `no_key` in a cloud session without `JEV_AUTH` points to the `jev`
  environment, not `/plugin configure`;
- transport fallback: a TLS error from `fetch` with a working `curl` switches
  to `curl`; the `curl` path sends the same body, refuses redirects, and maps
  status codes exactly like `fetch`;
- identity from `origin` (https and ssh forms, with and without `.git`) as
  `owner/repo`; a same-named repo of another owner is refused; no `origin` →
  `no_identity`;
- `JEV_ALLOWED_PROJECTS` parsing, `:web`; `JEV_DAILY_CAP` set (refuses past
  it) and unset (no cap); locally, a project without `max_calls_per_day` is
  never refused for volume;
- cloud-specific messages for each refusal, each ending with the new-session
  note; local-only commands refuse; `doctor` shows only the cloud rows and
  exits 0 on a correct setup;
- `jev trailers`: calls and outcomes since the last commit, including
  unverified calls and `ask` (ANSWERS); a rebased HEAD (author date kept) and
  a HEAD committed at `+02:00` against UTC audit times; last month's file at a
  month boundary;
- `setup.sh`, run as `bash -e setup.sh`: exits 0 and installs nothing on a
  clone failure, a hash mismatch or a failing `jev judges` check; the raw-file
  fallback installs the same files (including `plugin.json`), rejects one
  whose sha256 doesn't match `files.txt`, and the installed wrapper runs
  `jev judges` without an execute bit on the fetched files.

## 11. Changes to this repo

| File | Change |
|---|---|
| `skills/jev/scripts/jev.mjs` | proxy mode, probe, `curl` transport, origin identity, cloud policy and messages, `trailers`, `outcome` trailer, cloud doctor; **remove `DEFAULT_CAP`** (Q36): no cap unless `max_calls_per_day` is set, and `jev allow` shows "Cap: none" by default |
| `skills/jev/cloud/setup.sh`, `skills/jev/cloud/files.txt` | new (files.txt lists path and sha256) |
| `skills/jev/SKILL.md` | "Cloud sessions" section (§7); add the new codes to the refusal table; note that in the cloud the audit lives in commit trailers |
| `skills/jev/test/jev.test.mjs` | §10 |
| `docs/jev-design.md` | Q24: cloud sessions supported as described here; drop "cloud" from out of scope; add the new codes (`proxy_mode_unavailable`, `key_in_environment`, `proxy_credential_missing`, `proxy_blocked`, `proxy_unreachable`) to the exit-code and message tables; §8: `max_calls_per_day` has no default (Q36) |
| `README.md` | a short "Cloud sessions" setup section; the key-storage table (§2.1); drop "(default 300)" from `--cap` and `max_calls_per_day` |
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
| Spike (user, in claude.ai) | 0.25 |
| Proxy mode, probe and status mapping, origin identity, cloud policy and messages, doctor | 0.6 |
| `curl` transport fallback | 0.25 |
| `jev trailers` (calls and outcomes) | 0.25 |
| `setup.sh` + `files.txt` (hashes) + fallback + wrapper | 0.3 |
| SKILL.md, README, design doc, tests | 0.45 |
| **Total** | **~2.1** |
