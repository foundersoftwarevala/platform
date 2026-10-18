# Reconciliation manifest — 2026-10-03

Local machine, GitHub, the VPS and the production database (sv_platform),
inventoried read-only, then preserved. Evidence: git, read-only SQL, SSH reads.

## Canonical state

| Layer | State |
|---|---|
| GitHub origin/main | `aa9184b` (Developer Management release) on `50e446d` (Product Manager release) |
| VPS /var/www/softwarevala | `aa9184b`, branch main, 0 tracked modifications; build 2026-10-03 06:00:46 UTC; PM2 softwarevala-staging online (pid 149780), sole holder of port 3000 |
| Rollback builds | .output.prev-20261003-055917 (50e446d), .output.prev-20261002-183414, .output.prev-20260929-165244 |
| nginx | /rest/v1 → VPS PostgREST; /auth/v1, /realtime/v1, /storage/v1 → hosted Supabase project (auth, realtime and storage are not on the VPS) |
| Database | ahead of the code: 39 of the 47 unreleased migrations are already applied (below) |

## Backups created (nothing deleted)

| Ref (local and on GitHub) | Points at | Holds |
|---|---|---|
| backup/reconciliation/20261003-apply-control-panel | 690e84f | the 16 local commits not on origin/main |
| backup/reconciliation/20261003-local-work | b20f02b | snapshot of the uncommitted working tree (212 modified + 70 untracked files, 288 paths vs HEAD; .env files excluded by .gitignore) — taken with a separate index, the working tree and index untouched |
| backup/reconciliation/20261003-release-developer-management | 0ab1257 | Developer Management release incl. the post-aa9184b reassignment notice |

Existing branches, worktrees, VPS branches and VPS artefacts were left in place.

## Commits not on origin/main

### apply-control-panel (local, 16 ahead / 2 behind origin/main)

| Commit | Module | Classification | Notes |
|---|---|---|---|
| ecf65d8 | Applications (all roles) | LOCAL_ONLY | its 4 migrations APPLIED live |
| 9f28d12 | Control Panel, reseller hero | LOCAL_ONLY | 2 migrations APPLIED |
| 9193c20 | Applications i18n | LOCAL_ONLY | — |
| eb410f0 | Control Panel finishing pass: role-dashboard records layer (all roles), Developer Management, auth-bridge signOut | LOCAL_ONLY (Dev Manager part LIVE via aa9184b) | 4 migrations APPLIED; contains the production logout fix |
| 237c864 | Control Panel findings | LOCAL_ONLY | — |
| a8b8fc1 | Reseller dashboard | LOCAL_ONLY | — |
| 42ba8af, 52cad3e | AMS engine connected | LOCAL_ONLY | 5 migrations APPLIED |
| f40506c, 71405bb, ab052d7 | AMS recognition | LOCAL_ONLY | 4 migrations APPLIED |
| 40d577b | Chat (ChatAppButton, Chat Manager restore) | LOCAL_ONLY | 1 migration APPLIED |
| 49190ce | Marketplace payment settlement, function lockdown | LOCAL_ONLY | 2 migrations APPLIED |
| 9e628cf | Part 1 closeout: payment, commission, licence, history | LOCAL_ONLY | 6 migrations: 4 APPLIED, 141000 SUPERSEDED, **150000 NOT_APPLIED** |
| e3a12f8 | Product Manager | LIVE (= 50e446d by patch) | — |
| 690e84f | Product Manager follow-up | LOCAL_ONLY | its migration APPLIED |

Trial replay on origin/main: ecf65d8, 9f28d12, 9193c20 apply cleanly; eb410f0
conflicts only on the Developer Management files already released (newer in
aa9184b) and the i18n baseline. Completing the combined release was **blocked
by the permission classifier ("Production Deploy")** — see Blockers.

### Uncommitted working tree (212 modified, 70 untracked)

Other sessions' and this session's work in progress, preserved in
backup/reconciliation/20261003-local-work. Includes 19 migrations:

| Migration | Live state |
|---|---|
| 190000 wallet_credit_atomic, 191000 tm_developer_sync_completion, 193000 public_function_lockdown_2, 194000 partner_approval_grants_role, 200000 accessibility_compliance, 210000 reseller_payout_integrity, 211000 reseller_function_grants, 212000 reseller_notification_links, 213000 refund_total_cap, 216000 crm_tasks_read_scope, 217000 legacy_payments_cannot_complete_orders, 218000 influencer_manager_access_operators_only, 219000 product_payments_never_enter_outbox | APPLIED (DB_ONLY: code not in origin/main) |
| 230000, 231000, 232000 developer | APPLIED, in origin/main (LIVE) |
| **192000 medium_integrity, 214000 reseller_money_notifications_each, 215000 ams_reseller_no_self_purchase, 220000 i18n_engine_outage_and_public_read** | NOT_APPLIED |
| **233000 developer_guard_followups, 234000 ams_write_guards** | NOT_APPLIED (trialled, awaiting authorization) |

Live-code risk checked: of the 67 functions signed-in users can no longer
execute, none is called from the browser in origin/main's code.

### Older branches

| Branch | Classification | Unreleased content |
|---|---|---|
| origin/fix/ai-api-manager-completion (35), origin/feat/ai-api-manager-ui-import (34) | GITHUB_ONLY, mostly UNRELEASED, diverged | Finance Manager stack, payment / settlement / card rails, portal buyer journey; **security fixes 62e6a69 (server functions without caller checks), 3a67618 (open redirect `/\evil.com` on login), 71b83eb (listAiRegistry without auth)**; 7 migrations absent from main and prod. Not mergeable as is; port selectively |
| fix/homepage-sections-and-card-fields (27) | mostly SUPERSEDED | 148e357 (card-field fixes for /marketplace + migration 20260922120000), part of 18db5dd, test/probe scripts |
| feature/language-engine-140 (21) | SUPERSEDED | none |
| home-rows-smooth-scroll (1) | GITHUB_ONLY, UNRELEASED | 96277fd homepage spacing / scroll performance; applies cleanly to main |
| VPS deploy/finance-aiapi | DUPLICATE of the ai-api-manager lineage on GitHub | — |
| all other local/remote branches (35) | SUPERSEDED (0 commits not in main by patch) | — |

Other: migration version 20261003T090000 is used by two files
(`_lead_matching`, `_products_search_trgm_indexes`). VPS holds VPS_ONLY
artefacts `.output.known-good-908a485-20260924-0750` (557 MB) and `releases/`
(587 MB).

## Blockers

1. Building the combined canonical release (the 13 LOCAL_ONLY commits whose
   migrations are already live) was refused by the permission classifier
   ("Production Deploy"); it needs the owner's explicit go-ahead.
2. Production logout is a stub (fixed only in eb410f0).
3. 6 migrations not applied (4 from other sessions, 2 developer/AMS guards).
