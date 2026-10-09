# Vala AI — Software Vala's own engineering agent

Operated from the Control Panel (`/vala-ai`). No separate login, no external AI
provider, no Supabase dependency of its own. This file is the record a new
session (or person) reads first to continue the work.

## Status

| Area | Status | Evidence |
|---|---|---|
| Control Panel sign-in, server-side roles | Built, tested | `platform-auth.server.ts` reuses `requireOperator`; RBAC check per role (owner / operator / viewer / none) |
| Projects with permanent IDs (`VP-…`), isolated git workspaces | Built, tested | source repo byte-identical after clone (unit test); `workspace.server.ts` |
| Requirements, scope lock, change requests | Built, tested | approved requirements are immutable; changes only via an approved change request |
| Agent loop on the local model | Built, tested | PENDING → ANALYZING → BUILDING → TESTING → (FIXING → RETESTING)* → VERIFIED → COMPLETE |
| Independent verification | Built, tested | verifier re-runs every check on a clean, committed tree; protected check/test files cannot be edited |
| Crash recovery | Built, tested live | 90 s heartbeat lease; server killed mid-step, task resumed and completed |
| Evidence | Built, tested | every check's output stored with SHA-256, re-checked when shown |
| Approvals, releases, rollback | Built, tested | owner approval executes the action and records the verified outcome; releases immutable (DB triggers) |
| Hash-chained audit log | Built, tested | tamper detection unit test |
| Resource protection | Built, tested | disk/memory floors, command timeouts with process-tree kill, output caps, write budgets |
| Live running preview of client apps | Not built | preview = verified diff + file view |
| Orchestration of existing worker agents | Not built | existing workers depend on the discontinued database |
| OS-level sandbox for commands | Not built | commands run in the workspace with a scrubbed environment |
| Licensing & delivery, production deployment, source-library indexing | Not built | later phases; deployment needs separate authorization |

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

Tests: `npx vitest run src/lib/vala-ai` (21 tests; the agent-loop tests use a stub model server as a test double).

## Production notes (not done; needs authorization)

- Set `VALA_AI_DATA_DIR` to a persistent path outside the app directory (e.g. `/var/lib/vala-ai`).
- Run the model server as its own service on the VPS, loopback only; size the model to the VPS RAM/CPU.
- One application process runs one task step at a time.
