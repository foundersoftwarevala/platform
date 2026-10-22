# AMS Verification

**Scope:** repository code and migrations only. No production or development
database connection was available in this environment.

## Results

| Check | Result | Evidence / limitation |
| --- | --- | --- |
| XP-to-level simulation | **FAIL — database end-to-end not run** | The focused unit test passes for a 90 XP + 20 XP threshold crossing (`src/lib/ams/core.test.ts:4-19`). It tests the pure transition calculation, not a database award, audit insert, or rollback. |
| Direct client XP mutation | **PASS — static migration review** | `20261108T154000_ams_core_real.sql:60-66,97-124,175-182` enables RLS, grants authenticated `SELECT`, revokes other table privileges, and supplies own/operator read policies for XP/award records (the achievement catalogue separately exposes non-secret entries). Runtime behavior is **NOT VERIFIED**. |
| XP audit | **PASS — static implementation review** | `20261108T154000_ams_core_real.sql:130-173` installs a `user_xp` trigger writing action, actor, and before/after values to `audit_logs`. User-scoped transactions set the actor claim; system evaluations without a caller are labeled `ams_engine` and have null `actor_id`. Live insertion and actor values are **NOT VERIFIED**. |
| Leaderboard source | **PASS — real persisted data path** | `src/lib/ams/core.server.ts:423-459` selects from `public.user_xp`, joins real profiles, orders by XP/level and limits to 100. The declared index is `user_xp_leaderboard_idx` in `20261108T154000_ams_core_real.sql:43-45`. Planner use via `EXPLAIN` is **NOT VERIFIED**. |
| Leaderboard identity | **PASS — wired** | Query returns real full name/username and `avatar_path` (`src/lib/ams/core.server.ts:423-459`); `/ams/leaderboards` renders the name and existing signed-storage `UserAvatar` (`src/routes/ams.leaderboards.tsx:52-65`). |
| Overview source | **PASS — persisted data** | Core XP/level/rank/achievements use `getUserAMSProfile`; the legacy overview reads `user_xp`, real catalogs, wallet records, and persisted `leaderboard_entries` (`src/routes/ams.overview.tsx:77-130`, `src/lib/ams/dashboard.functions.ts:42-74,124-146`). |
| Vault/Museum previews | **DISABLED pending real issuance records** | These routes previously displayed static role-asset previews, including simulated unlock presentation. The AMS layout now renders an explicit Coming Soon notice on vault and museum paths (`src/routes/ams.tsx:53-67`, `src/components/ams/shared/AmsComingSoon.tsx:4-20`). |
| AMS button scan | **No inert enabled button found** | Static JSX scan covered `src/routes/ams*.tsx` and `src/components/ams/**/*.tsx`. Four buttons without inline handlers were valid `DialogTrigger`/`DropdownMenuTrigger` controls; they receive behavior through Radix `asChild`. No code change was needed. |

## XP and anti-cheat implementation evidence

- XP is stored per `(user_id, role)` in canonical `user_xp`, not in a newly
  invented one-row-per-user table (`20261106T100000_ams_flow_connect.sql:113-117`).
- Server-only award entry points validate input and call the operator-guarded
  transaction path (`src/lib/ams/core.functions.ts:43-64`,
  `src/lib/ams/core.server.ts:105-112,232-260`).
- The write path appends `xp_transactions` and `ams_award_ledger`, reconciles
  the ledger against the stored total, and updates XP/level/rank in one
  transaction (`src/lib/ams/core.server.ts:145-228`).
- The award ledger has an append-only trigger (`20260906220000_ams_engine.sql:128-137`).
- SQL inspection found no authenticated table write grant on the protected XP
  tables after the latest migration. The base engine scopes activity-event
  reads to the owner/operator (`20260906220000_ams_engine.sql:189-210`), and
  revokes authenticated/anonymous execution of the low-level ingestion and
  evaluation functions while checking operator role for recompute
  (`20260906220500_ams_engine_functions.sql:70-72,272-287`).
- The bounded static security review found no self-award or direct-XP-write
  path in the reviewed migrations and functions. It did not validate the
  deployed grants/policies.
- This is not a runtime exploit test. A manual authenticated `UPDATE` against
  the target database was deliberately not attempted.

## Explicit verification limits

`psql` is unavailable and `VPS_DATABASE_URL`, `SV_PLATFORM_DATABASE_URL`,
`I18N_DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` were not
configured in the current process. Therefore the following remain
**NOT VERIFIED**: actual table grants/policies on the VPS, an XP award against
real `user_xp`, its resulting live `audit_logs` row, direct-client update
denial at runtime, the live leaderboard plan, and the migration's deployed
state. No database writes or production changes were made.

The platform migration name ordering places `20261108T154000_ams_core_real.sql`
after prior migrations by filename; this report does not claim it has been
applied.

## Local verification

- `npx.cmd vitest run src/lib/ams/core.test.ts` — **PASS**, 1 test.
- `npx.cmd eslint src/routes/ams.tsx src/routes/ams.overview.tsx src/components/ams/shared/AmsComingSoon.tsx src/components/dashboard/Widgets.tsx --rule 'prettier/prettier: off'` — **PASS**.
- `npx.cmd eslint src/lib/ams/core.server.ts src/lib/ams/core.functions.ts src/lib/ams/core.test.ts src/routes/ams.tsx src/routes/ams.overview.tsx src/routes/ams.leaderboards.tsx src/components/ams/shared/AmsComingSoon.tsx src/components/dashboard/Widgets.tsx --rule 'prettier/prettier: off'` — **PASS**.
- `npx.cmd tsc --noEmit -p .` — **PASS** after the final source edits.
