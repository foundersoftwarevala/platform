# Vala AI — Software Vala's own engineering agent

Operated from the Control Panel (`/vala-ai`). No separate login, no external AI
provider, no Supabase dependency of its own. This file is the record a new
session (or person) reads first to continue the work.

## Status

Audit fixes and their evidence: [REMEDIATION.md](REMEDIATION.md). Designs awaiting approval: [SANDBOX_DESIGN.md](SANDBOX_DESIGN.md), [OPENAI_DESIGN.md](OPENAI_DESIGN.md). Backups: [BACKUP.md](BACKUP.md).

| Area                                                                 | Status             | Evidence                                                                                                   |
| -------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Control Panel sign-in, server-side roles                             | Built, tested      | `platform-auth.server.ts` reuses `requireOperator`; RBAC check per role (boss / operator / viewer / none) |
| Projects with permanent IDs (`VP-…`), isolated git workspaces        | Built, tested      | source repo byte-identical after clone (unit test); `workspace.server.ts`                                  |
| Requirements, scope lock, change requests                            | Built, tested      | approved requirements are immutable; changes only via an approved change request                           |
| Agent loop on the local model                                        | Built, tested      | PENDING → ANALYZING → BUILDING → TESTING → (FIXING → RETESTING)* → VERIFIED → COMPLETE                     |
| Independent verification                                             | Built, tested      | verifier re-runs every check on a clean, committed tree; protected check/test files cannot be edited       |
| Crash recovery                                                       | Built, tested live | 90 s heartbeat lease; server killed mid-step, task resumed and completed                                   |
| Evidence                                                             | Built, tested      | every check's output stored with SHA-256, re-checked when shown                                            |
| Approvals, releases, rollback                                        | Built, tested      | boss approval executes the action and records the verified outcome; releases immutable (DB triggers)       |
| Hash-chained audit log                                               | Built, tested      | tamper detection unit test                                                                                 |
| Resource protection                                                  | Built, tested      | disk/memory floors, command timeouts with process-tree kill, output caps, write budgets                    |
| Live running preview of client apps                                  | Not built          | preview = verified diff + file view                                                                        |
| Orchestration of existing worker agents                              | Not built          | existing workers depend on the discontinued database                                                       |
| OS-level sandbox for commands                                        | Not built          | commands run in the workspace with a scrubbed environment                                                  |
| Licensing & delivery, production deployment, source-library indexing | Not built          | later phases; deployment needs separate authorization                                                      |

## Architecture

### Jarvis local Whisper voice pipeline (staged, not activated)

Local Port 3003 can be started independently with Node 24 from the repository
root:

```powershell
node src\server\jarvis.ts
curl.exe http://localhost:3003/health
```

This [local entrypoint](../../src/server/jarvis.ts) reuses the existing Express
service, binds only `127.0.0.1:3003`, and requires no database connection.
Its `GET /health` is a **liveness** check: HTTP 200 confirms that Jarvis is
running, while `modelBridge.status: "not_checked"` does not claim Ollama is
available. The health response also reports whether the local Whisper model is
loaded. `POST /api/transcribe` accepts one bounded MediaRecorder audio file;
`POST /voice` and `POST /chat` accept
`{"message":"Hello"}` or `{"transcript":"Hello"}` and reuse the existing
5200 inference handler. Missing input returns 400; an unavailable local bridge
returns 503, not a fabricated model reply. Whisper inference and FFmpeg audio
decoding run locally. The app forwards audio only from the authenticated
same-origin server route to loopback; do not enable this flow from a hosted app
whose server is not the machine running Jarvis. Stop the local process with
Ctrl+C; no production service or database change is needed.

To connect the existing frontend in local development, set
`VITE_JARVIS_URL=http://127.0.0.1:3003` before starting Vite. This enables the
existing microphone controls and routes typed Chat and recorded voice
through the existing authenticated `/api/vala-ai` gateway. With the variable
absent, typed Chat keeps its original transport.
The browser continues to call its own origin: do not weaken Jarvis CORS or
send platform bearer tokens directly to the model bridge. Both the original
readiness metadata and the local entrypoint's explicit liveness metadata are
accepted; liveness still does not certify microphone or model readiness.
For a local preview, keep the existing platform login and isolate Vala's
SQLite data with `VALA_AI_DATA_DIR`; do not copy production Chat data or enable
workers. Local inference still needs the existing 5200 bridge to be reachable.

The microphone controls reuse the existing `/vala-ai/chat` screen, Control
Panel authorization, project context, Chat history and attribution. The
floating Founder assistant uses the same local audio upload route and retains
its chat transport and command behavior.

```
MediaRecorder -> /api/vala-ai/voice/transcribe-audio (operator/boss)
  -> authenticated app server -> 127.0.0.1:3003/api/transcribe
  -> local FFmpeg -> local Whisper/ONNX -> { text }
  -> existing Chat persistence/context -> /api/vala-ai/voice/transcribe
  -> authenticated app server -> 127.0.0.1:3003/voice
  -> existing 127.0.0.1:5200/v1/chat/completions -> Ollama
Reply -> /api/vala-ai/voice/speak -> 3003 playback instructions
  -> browser speechSynthesis
```

This uses local server-side Whisper STT and browser speech synthesis (not
server-generated audio). The local Qwen text model is unchanged.
`POST /voice/transcribe-audio` accepts one multipart audio file (up to 20 MiB)
after caller authorization and per-account rate limiting. The loopback service
decodes at most 30 seconds of mono audio and returns `{ "text": "..." }`.
That transcript is then persisted through the existing voice Chat API and
forwarded with the existing system/project context. `POST /voice/speak` accepts
`{"text":"..."}` and returns `audioGenerated: false` with browser playback instructions.
Neither endpoint executes commands, navigates, or creates tasks.
`GET /health` checks the existing bridge/model availability and reports
Whisper's load state, not microphone, speaker, or human-hearing acceptance.
A curl request is not a real mic test.

One-time local setup (PowerShell, from the repository root):

```powershell
npm ci --omit=dev --prefix services/jarvis
npm run model:download --prefix services/jarvis
npm start --prefix services/jarvis
```

In a second terminal, launch the local app with the Jarvis URL in the same
server environment:

```powershell
$env:VITE_JARVIS_URL = "http://127.0.0.1:3003"
npm run dev
```

Check `curl.exe http://127.0.0.1:3003/health`, including the `transcription`
status. The one-time model download requires internet and caches model assets;
recorded audio is not sent to a hosted transcription endpoint. If native ONNX
cannot load on Windows, install the Microsoft Visual C++ 2015-2022 x64
Redistributable using an owner-approved system change before model setup. The
full physical microphone-to-Qwen-to-speaker test remains separate from unit
tests and must use an actual spoken phrase.

The standalone Express service is [server.mjs](../../services/jarvis/server.mjs);
install its locked dependencies with `npm ci --omit=dev --prefix services/jarvis`.
It binds only IPv4 loopback port 3003, accepts no cross-origin browser calls,
and never forwards caller tokens to the model. Public requests must use the
existing authenticated Vala API. Voice inference shares typed Chat's
per-account rate limit; upstream errors remain visible and are retained as
Chat error rows, not successful assistant replies. Local STT upload failures
are returned explicitly and do not create transcript or assistant rows.

The voice controls are off unless built with `VITE_JARVIS_VOICE_ENABLED=true`
or the local `VITE_JARVIS_URL` connection opt-in.
Activation needs separate approval: stage a release of the service under
`/opt/softwarevala-jarvis`, install the [systemd unit](../../deploy/production/system/vala-jarvis.service)
after checking its `www-data` user and Node path, and validate the loopback
health endpoint before enabling the frontend. The existing HTTPS
`/api/vala-ai/*` route supplies the authenticated forwarding; do not expose
port 3003 publicly or add an unauthenticated Nginx bypass. Preserve the
existing 180-second application proxy timeout; the relay/bridge's internal
600-second ceiling is not a guarantee of a 600-second public request.

Rollback: build/redeploy the prior scoped frontend with voice disabled,
stop and disable **only** `vala-jarvis.service`, and restore the previous
Jarvis release symlink if replacing an older voice release. Keep the existing
5200 model service, production data, and Chat rows intact. No schema migration,
database restore, full-main deploy, role grant, or new model is needed.
Microphone access requires HTTPS or a secure loopback origin such as
`http://127.0.0.1:5173`; plain HTTP on a LAN/public hostname is not equivalent.
The capture helper rejects insecure contexts and restrictive page/iframe
microphone policy before requesting `getUserMedia({ audio: true })`. An embedded
page needs a permitting parent policy and `allow="microphone"` on the frame.
Capture is capped at 30 seconds and 20 MiB; cancellation, errors, project
changes and unmount release all tracks. Audio upload is made only after the
operator role check, then bounded again by the authenticated application route
and loopback Jarvis service.

The UI contains no native browser speech-recognition path. Unit tests simulate
MediaRecorder lifecycle events and mocked HTTP contracts only; they do not use
synthetic audio as evidence of transcription. Real spoken microphone input,
Whisper model load/inference, live Qwen response and audible speaker output
remain UNVERIFIED until tested on the local machine with an actual spoken phrase.
Human confirmation that the response was heard is separately required.

Check existing model residency before acoustic acceptance: a healthy bridge does
not mean the model is loaded. An earlier request reached Ollama but its cold load
was cancelled by a 120-second test-client deadline (HTTP 499). A bounded warm-up
through the existing 5200 bridge loaded the already-installed model in 85.879
seconds; subsequent inference succeeded. The final fixture used the existing
180-second application deadline, not an extended production timeout. No model
configuration was changed. Temporary relay/browser helpers were stopped; this
does not activate production voice controls or a persistent port-3003 service.

### Owned-source studio integration

The studio integrates `removalwork59-sketch/VALA-AI` at
`6c585055c0af42c972611af653c7333bd09d6067`, with the owner's permission.
Its home, live overview, developer/library/SSD workflow, AI Agent with resume,
code check, screenshot comparison, thirty-step Flow, website builder (five
tabs/eight themes), Admin and Owner layouts are retained under `/vala-ai`.
Studio Home is also available at `/vala-ai/studio`, with the same Control Panel
authentication, role checks and Studio layout as `/vala-ai`.
The original engineering Command Center remains at `/vala-ai/command-center`;
projects, execution pipeline, QA, approvals, releases, audit, chat and settings
remain available. No new sign-in or standalone application is introduced.

Source server functions now require the existing Control Panel session and role.
The source client-sync webhook is exposed at
`POST /api/vala-ai/studio/control-panel/clients` and as `syncControlPanelClientFn`, with
the same client ID/contact/nested metadata fields, but authenticated through the
Control Panel rather than a new public shared-secret endpoint.
Source-project Supabase credentials and the source's independent app bootstrap
are not activated. Source collections use schema 4 of the existing `vala.db`;
agent build caches are operator-scoped. Models use the existing Vala model
configuration, not the source's Lovable gateway or a new provider account.

Source AI "testing" is code review, not executed acceptance tests. Automated
Flow versions record `ai_review_only`, and delivery rejects a workspace changed
since its review. Use the original execution/independent verification and boss
approval routes for executed checks and actual releases. Manual version test
statuses are operator declarations, not verified execution evidence.

Admin/Owner metrics use available module data; unavailable financial/deployment
metrics are explicitly UNVERIFIED rather than source mock values. Generic manager
records and model aliases are module metadata, not platform account administration
or active model routing. Payment configuration encrypts credentials using the
existing encryption helper and returns masked markers; configuring a method does
not process a payment or verify a provider. The source clinic is a labeled design
template, not generated or delivered customer software.
The source's animated factory example is also retained as an explicitly labeled
design simulation; its sample logs are not execution evidence. Its separate
code analyzer uses the configured model for actual AI review.

The Builder toolbar stays sticky above its sandboxed iframe while the page
scrolls, keeping mouse-operated tabs and downloads reachable after theme changes.
Settings offers an optional maximum HTML character count; explicit prompt limits
such as "HTML under 900 characters" are also recognized (under 900 means at most
899). The strictest limit applies, with a 120,000-character safety ceiling.
Counts use JavaScript string length, include markup and whitespace, and exclude
the theme CSS injected by the preview/export. Limits are checked after both
generation and edits. Over-limit results produce a persistent chat warning and
a notification; the original HTML is preserved, never silently truncated.
The configured limit is saved with the operator's browser-local website.

The canonical application proxy uses 180-second read, send and connect timeouts
in `deploy/production/nginx/softwarevala-production.conf`. The actual production
site is `/etc/nginx/sites-enabled/softwarevala-production`; preserve its additional
gateway/cache configuration when updating it, test with `nginx -t`, then reload.
Other gateway and demo-proxy timeouts are not changed by this Vala fix. Inference
exceeding 180 seconds can still time out; asynchronous/streamed inference would
be a separate change.

This integration alone does not authorize production deployment/restart.
Back up the SQLite database and module filesystem state before any separately
approved deployment; see [BACKUP.md](BACKUP.md).

```
/vala-ai/* (React, src/components/vala-ai)  ── Authorization: Bearer <Control Panel session>
        │
/api/vala-ai/* (src/routes/api/vala-ai/$.ts) → handleApi (src/lib/vala-ai/api.server.ts)
        │  resolveCaller → requireOperator → user_roles → boss | operator | viewer
        ▼
src/lib/vala-ai/   store (node:sqlite) · agent · worker · tasks · workspace · exec · governance · audit
        │
        ▼
llama.cpp llama-server on 127.0.0.1 (OpenAI-compatible); only loopback/private URLs accepted
```

Roles (from Control Panel roles): **boss** = boss_owner, boss, founder, super_admin ·
**operator** = admin, developer · **viewer** = employee, sales, support, finance,
sales_support_manager. Anyone else gets 403.

Data lives in `VALA_AI_DATA_DIR` (default `./.vala-ai`, git-ignored): `vala.db`,
`workspaces/<project>`, `evidence/`, `releases/`. Original source repositories are only
read (`git clone --no-hardlinks`).

## Running locally

1. Model (verified with llama.cpp b11515 + Qwen2.5-Coder-3B-Instruct Q4_K_M, sha256 `724fb256…730b7`):
   `VALA_AI_LLAMA_BIN=… VALA_AI_MODEL_PATH=… node scripts/vala-ai/model-server.mjs`
   (on a 16 GB laptop use one slot: `-np 1`; about 6 tokens/s generation on a 4-core CPU).
2. The app: `npx vite dev`. The platform shell needs its auth service; on a machine without
   one, `scripts/vala-ai/local-auth-harness.mjs` stands in for it (local test fixture only, never
   deployed) — see the header of `scripts/vala-ai/e2e-local.mjs` for the exact commands.
3. Browser end-to-end: `node scripts/vala-ai/e2e-local.mjs --source <git repo> --check "node check.mjs"`.

Tests: `npx vitest run src/lib/vala-ai` (the agent-loop tests use a stub model server as a test double).

## Production preparation (2026-10-12; application not deployed)

- Approved directories and environment are staged outside the application, under
  `/var/lib/vala-ai` and `/etc/softwarevala/vala-ai.env`. Root-owned data directory: 0750.
  Numeric sandbox UID/GID: 10001:10001. See [sandbox verification](./SANDBOX_DESIGN.md).
- Daily 02:30 UTC root backup schedule, seven-copy retention and local-root failure mail are
  installed. No live SQLite database existed at this 2026-10-12 checkpoint; a live schema-4
  database was present by 2026-10-18 and its predeployment backup passed SHA-256 and SQLite
  integrity checks. See [backup status and rollback evidence](./BACKUP.md).
- Model source defaults to `local`. The registered OpenAI service is enabled/approved, with an
  encrypted credential and runtime encryption key present. Credential validity and provider
  acceptance remain unverified; no real provider request was made.
- One application process runs one task step at a time.

### Scoped deployment plan only

Use a new isolated branch from production `5f1dfa1`, not full main. Apply the eleven original
implementation commits in order:
`526b852`, `e919f19`, `feb33bc`, `a533f05`, `122df40`, `e87cd6e`, `651c8d3`, `b136ae3`,
`2235329`, `c83e737`, `06bd77d`, plus reviewed workspace/backup preparation changes.
Read-only inspection found no changed-file overlap with production since common base `7cf353c`;
actual cherry-pick, generated routing/i18n integration and candidate build are not yet verified.
Exclude protected dirty UI files and unrelated main changes.

Before release:

1. Keep the Linux whitespace-path redaction regression covered. Preparation fixed the
   operator/viewer defect: full Linux suite now has 104 passed, zero failures and one
   intentionally skipped real-provider test; targeted workspace/sandbox/backup/Git/RBAC has
   51 passed. This is private infrastructure acceptance, not deployed browser acceptance.
2. Typecheck and lint the candidate, run all non-provider tests and eight Docker acceptance
   cases, build the application, and test backup/restore plus exactly seven retained snapshots.
   The current full-main typecheck still has 347 known diagnostics; changed Vala files have none.
3. Obtain separate deployment/restart approval. Snapshot code, environment and any SQLite plus
   workspace/evidence/release state before activation.
4. Check homepage/login/marketplace health and the existing 7,199 slot sitemap URLs, then Vala
   boss/operator/viewer RBAC, pages/API, workspace writes, timeout cleanup and audit integrity.
   Vala API checks may initialize/write its SQLite database.
5. Select an authorized local model or explicitly enable AI API Manager settings; provider
   requests require separate approval.

Rollback code/build and environment independently. Stop the app before restoring SQLite;
coordinate file-tree snapshots, since database restore alone does not restore referenced
workspaces/evidence. The backup-only infrastructure has a checksum-guarded rollback script.
Expected integration/deployment work: 2-4 hours, excluding blocker remediation and approvals.

Production remains `5f1dfa1`; no application deployment, restart, business database write or
full-main production deployment was performed during preparation.
