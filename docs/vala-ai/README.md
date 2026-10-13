# Vala AI — Software Vala's own engineering agent

Operated from the Control Panel (`/vala-ai`). No separate login, no external AI
provider required, no Supabase dependency of its own. This file is the record a new
session (or person) reads first to continue the work.

## Status

Audit fixes and their evidence: [REMEDIATION.md](REMEDIATION.md). Designs awaiting approval: [SANDBOX_DESIGN.md](SANDBOX_DESIGN.md), [OPENAI_DESIGN.md](OPENAI_DESIGN.md). Backups: [BACKUP.md](BACKUP.md).

| Area                                                                 | Status             | Evidence                                                                                                   |
| -------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Control Panel sign-in, server-side roles                             | Built, tested      | `platform-auth.server.ts` reuses `requireOperator`; RBAC check per role (owner / operator / viewer / none) |
| Projects with permanent IDs (`VP-…`), isolated git workspaces        | Built, tested      | source repo byte-identical after clone (unit test); `workspace.server.ts`                                  |
| Requirements, scope lock, change requests                            | Built, tested      | approved requirements are immutable; changes only via an approved change request                           |
| Agent loop on the local model                                        | Built, tested      | PENDING → ANALYZING → BUILDING → TESTING → (FIXING → RETESTING)* → VERIFIED → COMPLETE                     |
| Independent verification                                             | Built, tested      | verifier re-runs every check on a clean, committed tree; protected check/test files cannot be edited       |
| Crash recovery                                                       | Built, tested live | 90 s heartbeat lease; server killed mid-step, task resumed and completed                                   |
| Evidence                                                             | Built, tested      | every check's output stored with SHA-256, re-checked when shown                                            |
| Approvals, releases, rollback                                        | Built, tested      | owner approval executes the action and records the verified outcome; releases immutable (DB triggers)      |
| Hash-chained audit log                                               | Built, tested      | tamper detection unit test                                                                                 |
| Resource protection                                                  | Built, tested      | disk/memory floors, command timeouts with process-tree kill, output caps, write budgets                    |
| Live running preview of client apps                                  | Not built          | preview = verified diff + file view                                                                        |
| Orchestration of existing worker agents                              | Not built          | existing workers depend on the discontinued database                                                       |
| OS-level sandbox for checks                                          | Built, tested live | pinned Docker image, unprivileged user, isolated network/filesystem and bounded resources                   |
| Licensing & delivery, automated project deployment, source-library indexing | Not built     | later phases; separate authorization remains necessary                                                     |

## Architecture

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
since its review. Use the original execution/independent verification and owner
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
        │  resolveCaller → requireOperator → user_roles → owner | operator | viewer
        ▼
src/lib/vala-ai/   store (node:sqlite) · agent · worker · tasks · workspace · exec · governance · audit
        │
        ▼
llama.cpp llama-server on 127.0.0.1 (OpenAI-compatible); only loopback/private URLs accepted
```

Roles (from Control Panel roles): **owner** = boss_owner, boss, founder, super_admin ·
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

## Scoped production release (2026-10-12)

The separately authorized application deployment succeeded using `scripts/ops/sv-deploy.sh`.
Release build: `01d70d4`, branch `deploy/vala-ai-20261012`, based on previous production
`5f1dfa1`. No full-main deployment was performed.

The eleven original implementation commits were cherry-picked without conflicts:
`526b852`, `e919f19`, `feb33bc`, `a533f05`, `122df40`, `e87cd6e`, `651c8d3`, `b136ae3`,
`2235329`, `c83e737`, `06bd77d`. The release also includes the independently published
redaction fix `2efd861`, approved workspace/backup preparation from `0947add`, and
scoped validation documentation. Protected dirty UI files and unrelated main changes were excluded.

### Verified

- Eight approved environment keys are active in the sole PM2 application process, persisted
  in the application environment and `/root/sv-app.config.cjs`, with the approved root-only
  `/etc/softwarevala/vala-ai.env` as the persistent Vala source.
- `/var/lib/vala-ai` is root-owned 0750; sandbox user is 10001:10001.
  The live database is `/var/lib/vala-ai/vala.db`, schema v3. Audit chain is intact.
- Full Linux Vala suite: **104 passed, zero failed, one intentionally skipped real-provider
  test**. All eight Docker cases passed. Additional real acceptance proved stale labelled
  containers are removed without removing an unrelated sentinel, and unpinned/missing images
  are refused. No acceptance containers remain.
- Scoped lint and production builds passed. Generated routing/catalogue integration was
  checked. Exact production-base typecheck: **4,713 errors**; candidate: **4,708**.
  Five existing errors were removed; zero new errors and zero errors in changed files.
  These are not clean full typechecks. Main's 347-error count is not this older base's baseline.
- Public homepage, login, marketplace, Control Panel and all nine Vala screens returned 200.
  The owner opened every Vala screen in the browser; eight authenticated read API surfaces
  returned 200, anonymous system status returned 401. Docker status reports ready.
- English source pack correctly has zero translated entries. Hindi/Arabic native packs and
  LTR/RTL SSR passed. All eight slot sitemap pages contain **7,199 unique URLs**, unchanged.
- Full-row counts/checksums of products, slots and both copies of the SEO decision/fingerprint
  tables remained unchanged. No business PostgreSQL write or real provider request was performed.
- The actual installed 02:30 UTC backup wrapper successfully backed up the live database;
  checksum, integrity, disposable restore, identical table row counts and logrotate passed.
  See [backup proof](./BACKUP.md).

### Model limitation

Model source remains **local**. `http://127.0.0.1:5200` is offline; the UI correctly reports
this, and model-dependent work cannot complete until an authorized model is running.
The registered OpenAI service was previously verified enabled/approved with encrypted
credentials and the encryption key present, but credential validity and real generation
remain **unverified**. No model-source change or real OpenAI acceptance was performed.
Automated project deployment and package-install network policy remain separate work;
manual application installation does not implement those capabilities.

### Rollback

Fresh pre-activation build, environment, data-tree snapshot, checksums and guarded rollback:
`/root/sv-seo-backup/vala-deploy-20261012T182540Z/`.
The previous `.output` is also retained by the deploy script. `rollback.sh` restores the
previous branch/build/environment, restarts the app and checks the homepage; new Vala data
is preserved rather than deleted. SQLite restore must only target a stopped app and must
be coordinated with workspace/evidence/release files.

Private candidate test/build evidence:
`/root/sv-seo-backup/vala-scoped-validation-20261012/`.
