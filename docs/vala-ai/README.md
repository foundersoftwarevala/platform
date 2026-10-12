# Vala AI — Software Vala's own engineering agent

Operated from the Control Panel (`/vala-ai`). No separate login, no external AI
provider, no Supabase dependency of its own. This file is the record a new
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
| OS-level sandbox for commands                                        | Not built          | commands run in the workspace with a scrubbed environment                                                  |
| Licensing & delivery, production deployment, source-library indexing | Not built          | later phases; deployment needs separate authorization                                                      |

## Architecture

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

## Production preparation (2026-10-12; application not deployed)

- Approved directories and environment are staged outside the application, under
  `/var/lib/vala-ai` and `/etc/softwarevala/vala-ai.env`. Root-owned data directory: 0750.
  Numeric sandbox UID/GID: 10001:10001. See [sandbox verification](./SANDBOX_DESIGN.md).
- Daily 02:30 UTC root backup schedule, seven-copy retention and local-root failure mail are
  installed. No live SQLite database exists; only isolated backup/restore fixtures were tested.
  See [backup status and rollback evidence](./BACKUP.md).
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
   owner/operator/viewer RBAC, pages/API, workspace writes, timeout cleanup and audit integrity.
   Vala API checks may initialize/write its SQLite database.
5. Select an authorized local model or explicitly enable AI API Manager settings; provider
   requests require separate approval.

Rollback code/build and environment independently. Stop the app before restoring SQLite;
coordinate file-tree snapshots, since database restore alone does not restore referenced
workspaces/evidence. The backup-only infrastructure has a checksum-guarded rollback script.
Expected integration/deployment work: 2-4 hours, excluding blocker remediation and approvals.

Production remains `5f1dfa1`; no application deployment, restart, business database write or
full-main production deployment was performed during preparation.
