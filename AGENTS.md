<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Software Vala platform

Working notes for anyone, person or agent, changing this repository. The
storefront has its own design lock in [LOCKED.md](LOCKED.md); read it before
touching `src/components/marketplace-home` or `src/components/marketplace-manager`.

## Project overview

- **App:** TanStack Start + TanStack Router (file routes), React, Vite. Routes
  live in `src/routes` (`routeTree.gen.ts` is generated). Navigation goes
  through `src/hooks/useNavigate.ts` on top of the router.
- **Server code:** `src/lib/**/*.functions.ts` are TanStack server functions;
  `*.server.ts` never ships to the browser; `src/routes/api/**` are HTTP routes.
- **Databases:** two Postgres databases with the same intended schema.
  - **VPS (`sv_platform`)** is production: the live site and its PostgREST talk
    to it. It is the most complete database.
  - **Supabase cloud project `nosnfgbcgeybwjgnwlzh`** is the one Lovable is
    connected to. It stopped receiving migrations around 2026-09-20 and is
    behind the VPS (tables, columns and functions).
- **Schema in the repo:** `supabase/migrations/*.sql` (applied in filename
  order) plus the dump `supabase/schema/public-schema.sql`. The VPS matches
  the repo: 98.9% of relations, 100% of functions and added columns (checked
  2026-10-11). The VPS-only objects found then were recovered in
  `20261108T110000_recover_manual_objects.sql`.

## Regenerating Supabase types

`src/integrations/supabase/types.ts` is generated from the **cloud** project,
so it matches what Lovable sees.

1. Bring the cloud project up to date first for the tables the code needs (see
   *Applying a migration to the cloud project*); types cannot describe what the
   cloud database does not have.
2. Generate, with `SUPABASE_ACCESS_TOKEN` taken from `.env.ops` (never commit it):

       npx supabase gen types typescript --project-id nosnfgbcgeybwjgnwlzh --schema public > src/integrations/supabase/types.ts

3. Delete the `supabase/.temp/` folder the CLI leaves behind.
4. Check the exported names did not change (`Database`, `Tables`,
   `TablesInsert`, `TablesUpdate`, `Enums`, `Json`, …) and that the diff is
   what you expect.
5. Run the full typecheck (`npx tsc --noEmit -p .`; it takes 20-25 minutes)
   and compare the error count with the one recorded below.
6. Commit `types.ts` on its own. Do not keep a backup copy in the repository;
   every previous version is in git.

Fresh cloud refresh (2026-10-14): 589 public tables, two views and 400
CLI-generated RPC definitions, versus 544 tables/two views/400 RPCs before.
All 45 additions are R&D/Pro Manager tables; no existing table, view or RPC
definition was removed or changed. The 496 raw catalog function names include
trigger and extension routines and are not the generated RPC count.
PostgREST metadata moved from 14.5 to 14.15. The generated LF file is 914,239
bytes; its predecessor was 872,199 bytes after newline normalization.
Full native TypeScript 5.9.3 checks kept main at 347 identical diagnostics.
The types-only scoped release `c911091`, based on `39c6375`, reduced the
production-source count from 4,708 to 533; these remaining contract errors
are a separate cleanup task, not a passing zero-error typecheck.
The guarded build, homepage/R&D HTTP checks and unchanged 7,199-URL sitemap
passed. Rollback: `/root/sv-seo-backup/cloud-types-deploy-20261014T121403Z/rollback.sh`.
CLI output is preserved verbatim: generated-file Prettier failures already
existed, while both old/new declarations have zero non-formatting lint errors.

## Migrations

- **Names sort, so names decide order.** Files are
  `YYYYMMDDTHHMMSS_short_name.sql` and run in filename order. Existing files
  are dated ahead of the calendar (into 2026-11), so a new file named with
  today's date would run *before* them. Name a new migration after the latest
  one, unless it has to run between two specific older ones; then give it a
  timestamp between them and say why in its header
  (example: `20261002T085900_seed_sales_agent_region.sql`).
- **Idempotent.** Use `IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT`, and
  guard role-specific grants (the `sv_app` role exists only on the VPS). A
  migration must be safe to run twice and on either database.
- **Never edit a migration that has been applied;** add a new one.
- **Tracking is incomplete on both databases.** `supabase_migrations.schema_migrations`
  holds about 100 rows on each, far fewer than the files. Do not rely on
  `supabase db push`; compare real schema instead.

### Applying a migration to the cloud project

1. Read the whole file and check its dependencies exist on the cloud project.
2. Dry-run it inside `begin; … rollback;` and confirm it succeeds.
3. Apply it inside one transaction (`begin; … commit;`), with a rollback
   script written beforehand.
4. Verify the objects it creates. Data the VPS holds but no migration records
   (for example the `GLOBAL` region on `sales-intelligence`) is a migration to
   write, not a manual fix to repeat.

### Demo visitor sessions

`src/lib/demo/sessions.server.ts` stores short-lived visitor sessions through a
direct PostgreSQL connection to `sv_platform`; it does not use a Supabase
client. The additive table definition is
`supabase/migrations/20261108T160000_demo_visitor_sessions.sql` and must be
applied to the VPS before the public session and ticket routes can work. Do
not apply it to the cloud project for this feature.

The UUID is forwarded to the author's demo as `sv_session_id` only. It is a
tracking hint, not an isolation boundary: an external demo must explicitly
consume it to partition its server-side state. Browser storage isolation is
not guaranteed by the proxy.

## Known bugs (as of 2026-10-11)

Columns the code reads that exist in **no** database (the field is always
undefined at runtime):

| Column | Read in | Effect |
|---|---|---|
| `developer_tasks.blocked_since` | `src/lib/dev-manager.server.ts` | Blocked tasks never auto-escalate and never appear in the blocked list |
| `developer_tasks.escalate_threshold_hours` | `src/lib/dev-manager.server.ts` | Always falls back to 24 hours |
| `demo_deployments.approved_domain` (+ `is_domain_locked`) | `src/lib/demo-ops.ts` | Domain check ignores mapped domains; they live in `demo_domains` |
| `demo_escalations.escalated_to_role` (+ `escalation_level`) | `src/components/demo-ops/OpsOperationsPanels.tsx` | Badge always reads "L1 · unassigned"; the real columns are `role` and `level` |
| `investigation` on `OpsReviewRow` | `src/components/demo-ops/OpsReviewQueue.tsx` | Type only: `mm_demo_ops` returns it, the type in `src/hooks/useDemoOps.ts` omits it |

Also missing on `developer_tasks`: `blocked_reason`, `promise_id`, `quality_score`.

Other open items:

- **AI Content Generator "Reject" always fails.** The reject state holds `id`;
  the mutation sends `item_id`, so the server's validator refuses it
  (`src/components/marketplace-manager/sections/AiContentGenerator.tsx`).
- **Three manager resources say `retirable: true` without an `archive`
  config,** so the console cannot retire their rows: `vala_tv_videos`,
  `vala_tv_categories`, `franchise_notifications`
  (`src/routes/api/manager/resource.ts`).
- **Caller-scoped RPC serialization, scoped follow-up (2026-10-14).**
  Sixteen affected modules now share `src/lib/supabase-rpc.server.ts`, with
  JSON-constrained response contracts and runtime JSON argument/response
  validation. Caller-token/RLS behavior is preserved, including the topbar's
  explicit anonymous access. Other legacy helper copies are outside this
  step; mainline and production baselines are separate from this fix branch.
- **`sv_whoami()` is executable by `anon`** (it reports the database role and
  a product count). Kept as found when recovered; nothing in the app calls it.

Removed as dead code on 2026-10-11 (nothing imported them; all in git
history): `components/ams/ui/MotionSoundPanel`,
`components/command-center/AffiliateManagerPanel`,
`components/command-center/AiApiManagerPanel`,
`components/influencer/InfluencerPortalDashboard`,
`components/marketplace-manager/MarketplaceManagerModule`,
`components/support/QuickSupport`, `components/support/SafeAssistAgent`,
`components/sales-support/{CommunicationHub,ConversionPipeline,DemoDispatchCenter,SalesSupportDashboardContent}`,
`hooks/useSafeAssistNotifications`, `hooks/useSafeAssistSecurity`,
`lib/dev-auth`, `lib/franchise/api`, `lib/influencer/sectionRegistry`,
`lib/marketplace-recovery.functions`, `lib/seo-apis-integration.functions`,
`lib/seo-auditing.functions`, `lib/seo-manager.functions`,
`lib/seo-operations.server`, `lib/use-diagnostics`, and earlier
`components/demo-manager/ProductManager`.

## Marketplace card slots (as of 2026-10-12)

A slot is one permanent page per (category, country):
`/marketplace/<category-slug>/<country-slug>`, in `marketplace_card_slots`.
The product in it (`current_product_id`) can change; the URL never does.

- **Countries:** 100 in `src/lib/marketplace/rail-countries.ts`, the only
  country list (the slot generator, the home rails and the gate all read it).
  The last 20 (Brazil … Tunisia) were appended, not sorted in, because
  `slot_no` is the position in this list.
- **Slots, on both databases (VPS applied 2026-10-12):** 9,100 = 7,200
  occupied + 1,800 vacant + 100 reserved. The 1,800 vacant are the 20 new
  countries; the catalogue has no product for any of them yet, so they stay
  `noindex`, out of the sitemap and off the home page. (The ops Supabase key
  cannot read the VPS; use `scripts/ops/db.mjs` / psql over ssh.)
- **Production runs `deploy/marketplace-gate-followup-20261012`** (`5f1dfa1`), not `main`:
  the production commit `7cf353c` plus only marketplace/gate commits, because
  `main` also carries the Vala AI rebuild, whose docs say production
  deployment needs separate authorization (Docker sandbox, data dir, backup
  cron). The next deploy of `main` ships that rebuild; set it up first.
- **The slot sitemap has 7,199 URLs, accepted by the owner on 2026-10-12.**
  The initial run was restored because the estimate was 7,195; a read-only
  replay identified four formerly duplicate event-management pages passing
  after the merge, plus education/usa blocked by its rendered noindex.
  A fresh SAVE run evaluated 9,100 slots and passed verification: 7,199
  unique public sitemap URLs, zero event-mgmt, zero new-country slots, and
  education/usa BLOCKED and excluded. Non-slot decisions remained unchanged.
  Original backup: `/root/sv-seo-backup/kaam1-20261012T094854Z/`.
  Accepted run backup: `/root/sv-seo-backup/kaam1-20261012T102952Z/`;
  full pre/post slot verdicts and accepted sitemap URL list are retained there.
- **Education/USA is now vacant (owner-approved 2026-10-12).** Its hidden
  "Marketplace End-to-End QA Product" tenant was unassigned in a transaction;
  `current_product_id` and `occupied_since` are null. The QA product remains
  unchanged and hidden. HTTP 200/noindex was verified and a single-slot gate
  evaluation saved UNVERIFIED, excluded from the unchanged 7,199-URL sitemap.
  Other slots, decisions and fingerprints remained unchanged.
  Backup and targeted rollback: `/root/sv-seo-backup/kaam2b-20261012T105327Z/`.
  The QA product was created on 2026-08-25; the slot records occupancy from
  2026-09-24. Assignment actor and the exact hiding time remain unverified.
- **Author Live Proof ERP 2026 is hidden pending review (owner-approved
  2026-10-12).** Product `98c2c632-948e-4676-870c-a4f6be66c9a3` belongs to
  the test-author seller; the exact creating actor remains unverified. Its
  direct demo hostname did not resolve from Windows or the VPS, and it has
  no structured pricing. Only visibility was changed: published/approved
  status, the demo URL and all other product fields were preserved except
  the update timestamp. Public catalogue results changed from one to zero;
  it has no slots. Other products, slots and gate decisions were unchanged.
  Full-row backup and visibility rollback:
  `/root/sv-seo-backup/author-live-proof-20261012T111956Z/`.
- **QA/test creation prevention:** QA/test products: `visible=false` mandatory;
  never assign them or any hidden product to occupied production slots.
  New names with
  whole-word or camel-case QA, test, e2e, dummy, sample or placeholder markers
  get `visible=false`, `content_status=in_review`, `moderation_status=submitted`,
  a review flag in the creation response and a `[marketplace QA guard]` log.
  Author and Manager creation share `product-safety.ts`; catalogue upserts
  apply this only when the slug is new, not to existing records. Normal author
  drafts remain editable drafts. Review uses the existing moderation workflow;
  the guard adds no schema columns or automatic cleanup of existing products.
  The slot generator filters visible/published tenants both in REST and in
  memory. Gate publication must verify tenant visibility and published status,
  matching the public reader; a nonpublic occupied tenant is UNVERIFIED.
- **Read-only QA scan (2026-10-12 11:03 UTC):** 7,566 products; six
  QA/E2E/test-named products were already hidden and unassigned. The 29
  occupied substring matches were not confirmed test data and must not be
  automatically hidden or unassigned. Missing approval timestamps on 7,563
  products and widespread demo/pricing gaps predate these guards. Creator
  attribution is incomplete; seller ownership is not proof of authorship.
- **The gate cast fix is deployed.** With `SEO_STORE=vps`, `upsertStatement` in
  `src/lib/seo/seo-store.server.ts` bound the rows as `$1::json`, so
  postgres.js double-encoded them and every write failed ("cannot call
  json_populate_recordset on a scalar"); the comment above it always said
  `$1::text::json`. Production now uses that cast; the accepted slot run
  successfully saved decisions, fingerprints and operator audit records.
  The active SEO store is the VPS `softwarevala` database, not `sv_platform`.
  Its pre-run eligible count was 7,272 versus 7,271 in the catalogue database's
  copy; the extra eligible URL was `/marketplace/education/usa`.
  `--kind slot` alone does not scope the script's duplicate pass; the run used
  a temporary copy restricting that pass to slot decisions, with non-slot
  decisions verified unchanged. At that checkpoint, no permanent runner change
  or cron had been added; the guarded runner below replaces the temporary copy.
- **Run the gate with `--slice 50`.** At the default 200, a slice's product
  lookup (`id=in.(…)`, ~6 KB) makes PostgREST echo a response header larger
  than the `:3010` gateway's buffer, and nginx answers 502 ("upstream sent too
  big header").
- **Guarded gate runner v2:** `seo-gate-run.mjs` requires the deployed
  preflight/evaluation-only/atomic-commit protocol before sending any POST.
  Every evaluation slice is read-only; global duplicates are planned within
  the selected kinds before saving. `--dry-run` skips decisions, fingerprints
  and manager audit writes. Production guarded saves require `SEO_STORE=vps`.
  Every accepted preflight gets a custom `pg_dump` of the active store's two
  gate tables in `/root/sv-seo-backup/gate-<UTC timestamp>/`, with SHA256,
  archive/decompression validation and a PostgreSQL-owner restore script.
  Owners/ACLs are preserved. Retain the current verified backup and six older
  automated backups; manual incident backups are never rotated.
  A projected loss of **more than 2% of currently eligible URLs in scope**
  refuses all saves and exits nonzero, even if newly gained URLs offset it.
  Override deliberately with `--max-drop-percent` or
  `SEO_GATE_MAX_DROP_PERCENT`. Exactly 2% is allowed. Missing inventory URLs
  become UNVERIFIED. Saves lock both gate tables, recheck the snapshot and
  commit decisions/fresh fingerprints in one transaction; stale scoped hashes
  are removed. Changed store state requires a fresh run/backup.
  A `.gate-run.lock` holds PID/time; after an uncatchable termination, verify
  that PID is no longer running before removing that one stale lock file.
- **Slot hreflang is dynamic** (`seo-gate.ts`): count the category's occupied
  siblings with country codes, plus x-default, matching the public route.
  Education's 79 filled siblings therefore expect 80 alternates, not 81.
  The follow-up CLI accepts `--expected-hreflang <positive integer>` only
  for slot evaluation. It is an explicit fallback if the sibling query
  fails, never an override of a successful dynamic count; without it a
  failed query aborts. Use a verified count including x-default, not a guess.
  Fallback warnings/page counts are reported, and check details preserve the
  fallback reason alongside observed-versus-expected HTML counts.
  Whole-run reports distinguish literal BLOCKED states from all ineligible
  URLs, with evaluated/total counts, current/projected state distributions,
  lost/gained URLs and meaningful changes. These extensions require deployed
  `detailedReport`/`hreflangFallback` capabilities; the CLI refuses unsupported
  servers before backups/evaluation rather than silently ignoring flags.
  The follow-up is deployed as scoped release `5f1dfa1`; both capabilities
  were verified live. Do not deploy full main to deliver marketplace ops.
  Follow-up validation: 119 tests pass across eight suites and scoped lint
  passes; the full typecheck has the same 347 diagnostics as the baseline,
  with none in changed safeguards. A fresh production dry-run of the existing
  release evaluated 9,100,
  projected 7,199 eligible, lost/gained zero, and changed zero verdicts;
  gate-table signatures and manager audit counts remained unchanged.
  The guarded release was built and deployed on 2026-10-12 with normal
  homepage/native-language/process checks. A full 9,100-slot live dry-run
  projected exactly 7,199 eligible (zero lost/gained, 79 check updates) and
  verified unchanged gate-table signatures and manager audit counts.
  Occupied Education/Angola was READY_FOR_INDEX, HTTP 200 without noindex,
  with 80 public alternates. Education/USA and the already-vacant India slot
  correctly emit noindex. Initial guard validation: 90 tests pass; 347 existing
  TypeScript errors, unchanged, with none in the safeguard implementation.
  The subsequent guarded manual SAVE also kept exactly 7,199 unique public
  slot URLs, zero event-mgmt and zero vacant/reserved slots eligible.
  Education/USA remains UNVERIFIED, HTTP 200/noindex. Product/slot data and
  non-slot gate state were unchanged; one manager audit and five technical
  checks were appended. Pre-SAVE dump/checksum/restore:
  `/root/sv-seo-backup/gate-20261012T130151337Z/`.
  The follow-up's live dry-run and manual guarded SAVE each evaluated 9,100:
  7,199 eligible, zero literal BLOCKED, 1,901 UNVERIFIED/excluded, zero loss,
  zero meaningful changes and zero fallback usage. The dry-run preserved
  gate/fingerprint signatures and audit counts; SAVE preserved product/slot
  data, non-slot gate state and the 7,199 unique public slot URLs, appending
  one audit and five technical checks. Education/USA stays UNVERIFIED.
  Supplying fallback 999 in a live Education/Angola dry probe still used the
  successful dynamic count of 80. The final requested confirmation repeated
  the full no-write dry-run, then rechecked its snapshot before another
  guarded SAVE. Both retained the same counts and zero loss/changes; the
  successful run finished at 2026-10-12T14:58:23Z. Latest pre-SAVE
  backup/checksum/restore:
  `/root/sv-seo-backup/gate-20261012T145512737Z/`.
  Deploy source backup: `/root/sv-seo-backup/deploy-gate-followup-20261012T135743Z/`;
  previous build: `/var/www/softwarevala/.output.prev-20261012-135744`.
- **Daily gate wrapper:** `scripts/ops/seo-gate-cron.sh` is installed as
  `/usr/local/bin/sv-seo-gate.sh` and runs from `/var/www/softwarevala`.
  Root cron uses `45 3 * * * /usr/local/bin/sv-seo-gate.sh` (server UTC;
  09:15 IST). Logs are `/var/log/sv-seo-gate/gate-YYYYMMDD.log`; only those
  dated files and rotated archives older than seven days are pruned. Daily
  logs are root-owned mode 0640; their directory is root-owned 0750
  (directories need execute permission for traversal, not file mode 0640).
  `deploy/production/system/logrotate-sv-seo-gate` is installed root-owned
  mode 0640 as `/etc/logrotate.d/sv-seo-gate`: daily, seven rotations/maxage,
  delayed compression and 0640 creation; the system logrotate timer is active
  and enabled. Delay compression avoids immediate compression of a rotated log.
  Last-run/failure records
  persist separately. `--dry-run` passes through to the runner;
  `--test-alert` verifies notifications without a gate or database write.
  Failures use `logger -p daemon.err -t sv-seo-gate` and a persistent failure
  record. Local root-mail alerts are enabled with
  `SEO_GATE_ALERT_LOCAL_MAIL=1` in the root-only config. Postfix is installed
  and enabled in local-only mode: `inet_interfaces=loopback-only`, IPv4, and
  both `default_transport` and `relay_transport` set to
  `error:External delivery disabled for local operations mail`.
  This is local delivery to `/var/mail/root` (root-owned 0600), not off-VPS
  email. The wrapper reports mail submission, not unproven receipt. Missing
  or failing sendmail returns an explicit alert error; invalid local-mail
  flags are rejected (only 0/1 are allowed). With the flag absent/0 the
  existing syslog/webhook behavior is preserved.
  No external destination was supplied; off-VPS email/webhook delivery must
  not be claimed as configured.
  For external alerts, use `deploy/production/seo-gate.env.example` and put
  `SEO_GATE_ALERT_WEBHOOK='https://...'` in the root-only
  `/etc/softwarevala/seo-gate.env`, then run `--test-alert` and
  verify delivery. That file may also set `SEO_GATE_MAX_DROP_PERCENT`.
  Keep webhook credentials out of git and command arguments.
  Installation preserved every existing root cron entry and verified one
  gate entry, an active cron daemon, root-only configuration, and seven-day
  pruning without deleting a nonmatching log sentinel. The local alert
  probe and an actual nonzero runner failure were verified in journald;
  the rejected-argument dry-run probe left gate/audit state unchanged.
  Original crontab/checksums/rollback:
  `/root/sv-seo-backup/cron-20261012T130138Z/`.
  Follow-up wrapper/config/crontab backups:
  `/root/sv-seo-backup/cron-followup-20261012T135953Z/`.
  Force-rotation tests of the installed policy preserved content, created
  0640 logs, removed an eight-day archive, retained a six-day archive and
  never deleted an unrelated sentinel. Live nonzero failure probes delivered
  syslog and persistent records without gate/audit writes; the real successful
  run records were restored afterward. Root's existing cron entries remain
  byte-for-byte unchanged, with exactly one gate entry.
  Final confirmation passed live scoped-release/health checks without
  redeploying an already-correct release, `logrotate --debug`, cron/timer
  checks, log ownership/modes and another actual exit=1 alert probe.
  The probe preserved gate/audit state; the successful run record was
  restored. External mail/webhook delivery remains UNVERIFIED because no
  authorized destination was supplied. Fresh before/after signatures,
  dry-run/SAVE results, ops rollback files and verified checksums:
  `/root/sv-seo-backup/kaam4-final-20261012T145100Z/`.
  Alert completion: a temporary one-shot root cron triggered an actual runner
  exit=1 at 2026-10-12T15:10:01Z and delivered one tagged gate message to the
  root mailbox. Gate/fingerprint/audit state stayed unchanged. The temporary
  cron entry was removed, the original crontab was restored byte-for-byte,
  and the real successful run record was restored. Disabled-mail compatibility,
  nonzero mail-submission failure and invalid-config rejection were tested;
  the final installed wrapper also delivered a real test notification.
  Local cron email, syslog and persistent failure records are verified;
  external delivery is intentionally disabled, not a pending prerequisite.
  MTA setup used Debian's `postfix/main_mailer_type=Local only`; verify the
  loopback interface/error transports with `postconf` before enabling mail.
  Operator inspection: `sudo grep -A5 'X-SoftwareVala-Alert: seo-gate' /var/mail/root`.
  Wrapper/config/crontab/package snapshots, checksum and real delivery proof:
  `/root/sv-seo-backup/gate-mail-20261012T150600Z/`.
- **A missing slot now returns 404 on production.** The deployed loader throws
  `notFound()`; `/marketplace/academy/atlantis` was verified as HTTP 404.
- **Do not run `scripts/ops/card-slots-generate.mjs --apply` to add slots.**
  It upserts with `merge-duplicates`, which rewrites every existing slot
  (`occupied_since`, `slot_title`, the tenant, `rotation_policy`). The 1,820
  new slots were inserted with an insert-only copy (`ignore-duplicates`, new
  `slot_no` only).
- **Home page:** country cards open their slot page (card click and title);
  Buy and Live Demo still go to the product and its demo. 74 shelves: the 57
  with static entries plus 17 drawn only from the catalogue's country cards.
- **Merged categories:** `src/lib/marketplace/merged-categories.ts`. A merged
  category's slot and category pages answer 301 with the category it joined,
  its slots are `reserved` (the gate treats that as not published), and the
  category sitemap leaves it out. So far: `event-mgmt` → `event-management`;
  its 20 products that were exact copies of event-management's are
  `visible = false` on both databases; the other 60 (64 on the VPS) are kept.
- **hreflang** on a slot page lists only occupied sibling slots.
- **Search Console is not connected.** The `api_services` row is inactive,
  `GOOGLE_SEARCH_CONSOLE_CREDENTIALS` is not set, and
  `google-apis-integration.functions.ts` sends no token. No traffic figure in
  this project comes from Google.
- `scripts/ops/homepage-lock.mjs` is not run by the build and its baseline is
  stale; it reports many intended changes.

Open decisions (owner):

- Merge the other near-duplicate categories (crm, gym-fitness, pet-care,
  publishing, hospitality, legal, security, education-coaching,
  education-coaching-management) once Search Console figures are in.
  event-services, travel-booking and travel-tourism are kept as distinct.
- Finance: `finance` is already named "Finance & Banking". Merge it into
  `finance-cat` first, then rename `finance-cat`; renaming first would give
  two categories the same name and the same page titles.
- Products for the 1,820 new slots (no generated content).
- Review remaining QA product records and their test-environment isolation;
  Education/USA has been made vacant rather than publishing a QA tenant.
- External email/webhook destination and verified delivery for gate alerts.
- Vala AI's production setup and approval, before the next deploy of `main`.

Work log: Phase 1 marketplace fixes `b4ad6e0`, `adc5107`, `90ee1a6`. Phase 2
batch A: slot links `a43a081`, hreflang `b3d87aa`, 100 countries `9e1cceb`, 17
shelves `f4a2e96`, event-mgmt merge `8eac048`.

## Typecheck error count

### Owned Vala AI studio

`src/components/vala-ai/studio` and `src/lib/vala-ai/studio` integrate the
owner-authorized `removalwork59-sketch/VALA-AI` source at `6c585055`.
Preserve both its screens/panels and the existing engineering routes; the old
Command Center is `/vala-ai/command-center`. No separate login or source-project
credentials: all server functions use Control Panel authorization, the existing
Vala model gateway, and schema 4 of the module SQLite database.
AI review is not executed testing; Flow records `ai_review_only`, unsupported
dashboard metrics are UNVERIFIED, and payment/model-alias configuration is
metadata rather than verified payment processing or live model routing.
See `docs/vala-ai/README.md` and `BACKUP.md` before deploying or rolling back.
This integration has no implicit production deployment/restart authorization.

`npx tsc --noEmit -p .` — Vite builds without typechecking, so these errors do
not break the build, but they hide real bugs. Record the count after each
change that moves it.

| Step | Errors |
|---|---|
| Start (types described 77 of 500+ tables) | 4,715 |
| Types regenerated from the cloud project | 542 |
| Cloud catch-up migrations + Vala AI changes | 537 |
| `retirable` on `Resource`, dead `ProductManager` removed | 449 |
| 22 dead files removed | 401 |
| `features: Json`, insights select string | 378 |
| Serialisable product page types | 351 |
| Country rail single conversion and status-based numbering | 348 |
| Product page passes the indexing gate a URL string | 347 |
| Fresh cloud types: 589 tables; identical main diagnostics (2026-10-14) | 347 |
| Phase 3 main baseline `0947add`, fully rechecked (2026-10-15) | 347 |
| Phase 3 merged fast wins; existing retirement contract/deletions preserved | 341 |
| Phase 3 merged shared JSON/caller-RPC contracts | 232 |
| Phase 3 merged GlassCard header contract | 205 |
| Phase 3 merged orphan history; all 23 deletions already present on main | 205 |
| Phase 3 merged safe TS2339 contracts, including the blocked-policy revert | 109 |
| Phase 3 merged assignment, nullable-value and mutation contracts | 46 |
| Phase 3 merged all consumer fixes; fresh full compiler (2026-10-16) | 11 |
| Phase 4 developer blocked/escalation contract; fresh full compiler | 2 (promise selection was blocked) |
| Canonical plural task-promise contract; fresh full compiler (2026-10-16) | **0** (current) |
| Target | 0 |

### Canonical task-promise contract (2026-10-16)

`developer_tasks.promise_id` has no column or writer on either database.
Developer Manager now follows `developer_tasks.tm_task_id` to the existing
`task_manager` promise associations: the union of `promise_links` and primary
`promises.linked_module/linked_record_id` links, matching `pt_promises_for`.
Task and SLA-risk DTOs expose every deduplicated ID as `promiseIds: string[]`.
Both badge views, CSV export and the management task board use that plural
contract; no arbitrary primary promise is selected.

Reads batch 50 canonical task IDs and page in stable ID order against exact
counts. Failed, incomplete or inconsistent reads throw before automatic
escalation writes. Successfully empty or unbridged tasks retain empty arrays.
No optional nonexistent field, type assertion, generated schema change or
redundant database column is used.

Read-only inspection found 10 developer tasks, all 10 bridged, 30 canonical
tasks and zero promises or promise links on each database. No migration or
data cleanup is required; database data and existing permissions are unchanged.
This plural contract resolves the earlier blocked singular-selection notes
without introducing a single-promise policy. Code rollback uses a normal
revert; deployment rollback must not restore databases over new business data.

### Phase 4 Developer Escalation contract (2026-10-16)

The overview now reads canonical `tm_tasks.blocked_reason` and current status
through the existing link, and derives the current blocked episode from
append-only `tm_activity` status transitions. Trigger/service duplicates do
not restart the timer; a real unblock/reblock does. History is paged against
its exact count, and read/write/audit errors propagate.

The existing intended 24-hour fallback is now an explicit Developer Manager
policy constant, not a nonexistent task column or delivery `sla_hours`.
No new per-task configuration or policy approval is implied. Legacy/unlinked,
inconsistent or unverifiable history has null age, stays visible and supports
manual escalation; its existing deadline-breach path remains active.
All three blocked-task consumers distinguish unknown age from zero. A UI
threshold crossing alone no longer claims an escalation was persisted.
Automatic escalation audit records retain the authorized overview caller.

Validation: 28 tests pass across four suites. A fresh full compiler removes
nine errors (11 -> 2); only the identical two `promise_id` diagnostics remain.
Promise selection is not guessed or changed by this repair. Escalation runs
on overview requests, not an independent scheduler. Existing-open checks are
retained; cross-process concurrency is not claimed atomic without a database
uniqueness/transaction change. No production endpoint, database or service
was changed or invoked to trigger an escalation. Rollback is a normal revert.

### Phase 4 task billing-time contract (2026-10-16)

`getTaskWallet` now reads persisted `tm_time_logs.seconds`, not the nonexistent
`minutes` field. It pages all matching logs using their exact count and stable
ID ordering, sums valid nonnegative integer seconds and divides once by 60.
Sub-minute values remain fractional; no new billing-rounding policy is
introduced. Recorded financial fields and `actual_minutes` are unchanged;
running/unpersisted time is not invented.

Task/log read failures and incomplete or invalid logs throw explicitly rather
than appearing as zero time or a missing task. A successful empty log query
alone yields zero. Existing staff/roster authorization and true task-not-found
responses are retained. Validation: 69 cumulative tests across seven files,
including 3,600 seconds -> 60 minutes, sub-minute sums, 1,201 rows under a
200-row server cap, failures and access checks. Full compiler remains at the
same two promise-selection errors. No production or database changes.

### Phase 4 AI-content rejection acceptance (2026-10-16)

The original `id` versus `item_id` defect is already repaired by the Phase 3
assignment integration. Both Generate and Review queue send `item_id`;
the existing server validator requires a UUID and calls `mm_ai_item_reject`
with `p_item`, `p_code` and the optional `p_reason`. No duplicate runtime
rewrite or migration is needed.

The two UI entry-point regressions now use a valid isolated UUID and verify
both thrown failures and unsuccessful RPC responses remain visible.
New tests execute the actual server validator and rejection handler through
the shared caller-scoped helper and real Supabase SDK against isolated
fixture responses. They cover canonical payloads, old/invalid inputs,
optional reasons, missing authentication and permission/business refusals.
No service-role key is used. All 133 cumulative tests across eleven files
pass. The SQL function's version/review/audit transaction was inspected;
real database persistence and deployed UI acceptance remain UNVERIFIED.
No live rejection or production write was performed.

### Phase 4 main integration scope (2026-10-16)

The owner authorized a normal main merge of the verified Phase 4 branch.
Preserve the historical owner-pause notes and existing uncommitted application
edits; do not fold unrelated WIP into this merge. Keep byte-verified WIP
snapshots and a rehearsed normal-history rollback. This authorization does
not include a production deployment, service restart or database write.
The two existing promise-selection diagnostics remain outside this merge.

### Phase 3 main integration (verified 2026-10-16)

All seven requested scoped branches were integrated sequentially, including
the complete TS2339 tip and its `205ff66` blocked-policy revert. Local main
`0947add` and the newer canonical main tree `9cda960` were each independently
fully checked at 347. The integration preserves both histories; the
pre-cleanup merge `47af653` has exactly the canonical main tree.

Every merge was regression-tested and fully typechecked before proceeding.
The final fresh, nonincremental compiler reports only eleven TS2339 errors
in `src/lib/dev-manager.server.ts`:

| Property | Errors | Still required |
|---|---|---|
| `blocked_since` | 5 | Approved blocked-episode and legacy/missing-history semantics |
| `blocked_reason` | 2 | Separate linked/unlinked canonical-field projection and regressions |
| `promise_id` | 2 | Primary-promise selection or a plural API contract |
| `escalate_threshold_hours` | 2 | Approved blocked-duration escalation policy; not delivery SLA |

This is **not a zero-error typecheck PASS**. No invented columns, disabled
checks or business-policy guesses were used to reach eleven. Quality is read
from the existing linked `tm_tasks.quality_score`; task and promise mutations,
authorization, financial and append-only guards remain in place.

Final cumulative validation: **283/283 tests across 38 files**, including the
existing demo numbering/link/order regressions; the standard Windows
production build passes. Generated route source is identical after CRLF/LF
normalization. Scoped lint has zero added non-formatting findings and zero
findings in new tests, with 3,677 findings remaining versus 3,698 baseline.
Embedded hook-warning line references are positional, not new warnings;
formatting debt remains and whole-scope lint is not a pass.

For current main, this supersedes the historical audit's missing demo-domain,
escalation-label and review-investigation contracts, duplicated caller-RPC
boundaries, and AI-content Reject payload bug. It does not claim production
has received these changes. No deployment, restart, migration or database
write was performed in Phase 3; live authenticated acceptance is UNVERIFIED.
The independent Phase 2 R&D provider-credential blocker remains separate.
Rollback must use normal reverts, never rewriting pushed history.

### Historical scoped-branch validation records

### Scoped typecheck fast wins (2026-10-14)

The fresh cloud types in production release `c911091` reduced the scoped
baseline to 533 diagnostics. The isolated
`fix/scoped-typecheck-fast-wins-20261014` branch changes only the `Resource`
declaration and nine React class-member modifiers, plus regression tests and
this record:

| Scoped source | Errors |
|---|---|
| Fresh cloud types, production `c911091` | 533 |
| Optional `Resource.retirable` declaration | 494 |
| Nine explicit React `override` modifiers | 485 |
| Shared JSON RPC response contracts, STEP 2A | 340 |
| GlassCard header props, STEP 2B | 313 |
| Audited legacy orphan cleanup | 219 |
| Schema-backed TS2339 contracts and mappings | 111 |
| TS2345 and TS2322 argument/assignment contracts | 46 |
| Stale consumer contracts and unreachable Add Demo wizard | 30 |
| Canonical Developer Manager review-quality projection | 29 |
| Finite query boundaries and existing DOM test environment | 15 |
| Final four unblocked consumer contracts | **11** |

Both full native TypeScript checks completed against the exact scoped source;
39 excess-property diagnostics and nine missing-override diagnostics were
removed, with no new diagnostic signatures. Mainline's 347-error baseline is
separate and unchanged. The three implementation files emit identical
JavaScript before and after these type-only changes.

Regression validation: 33 tests pass across three suites, covering archive
PATCH/no physical DELETE, authorization and upstream failures, existing
product-creation guards, and homepage/section error logging and retries.
Resources without an archive configuration still reject retirement with 403;
the three known missing configurations above remain a separate task.
The new tests have no lint errors or warnings; existing implementation-file
lint findings are unchanged. Production remains `c911091`; this fix branch
has not been deployed. Roll back this branch's change with a normal commit
revert, never by rewriting pushed history.

### Scoped serialization fixes, STEP 2A (2026-10-14)

`fix/scoped-rpc-serialization-20261014` starts from verified fast-wins commit
`1b69577`. Shared `Json`/`JsonObject` contracts replace unknown RPC response
fields in 20 affected modules; sixteen duplicated caller-RPC helpers are
consolidated without using the service key or changing domain operations.
Non-JSON arguments and responses now fail explicitly instead of being
silently coerced at the wire boundary. Optional object fields remain valid.
The SEO reporting RPC is still absent from cloud-generated function types;
its existing local adapter now declares its actual argument and JSON result
contract rather than an unknown result.

The complete native TypeScript check is **485 -> 340**: all 65 server-handler
serialization diagnostics and 80 downstream diagnostics are removed, with
zero new diagnostic signatures. At that checkpoint, all 27 GlassCard
`actions`/`description` diagnostics remained unchanged. Mainline's 347-error
history is not this scoped branch's baseline.

Validation: 80 tests pass across five suites, including 47 new JSON/caller-RPC
contract cases plus the retained archive, product-guard and homepage-boundary
regressions. The standard application build passes in a private worktree.
New helpers/tests are lint-clean, with no new non-formatting findings in the
affected existing modules; their formatting findings decrease from 796 to
783, so this is not a full lint pass.

Production source/process remain `c911091`; no deployment, restart or live
business-data mutation was performed for this fix. Live acceptance of the
undeployed serialization changes is UNVERIFIED. Rollback is a normal revert
of the serialization commit on its fix branch, preserving the first 48 fixes.

### Scoped GlassCard contract, STEP 2B (2026-10-14)

`fix/scoped-glasscard-contract-20261014` starts from serialization commit
`5aa1dc2`. Only the shared GlassCard implementation changes: optional
`actions` and `description` accept ReactNode and render in the header, with
description below the title and actions alongside it. Headers also render
when either new prop is supplied without a title. Existing title/icon
rendering, custom classes, content-only cards and body padding are preserved.

The complete native TypeScript check is **340 -> 313**: exactly 27 GlassCard
contract diagnostics across 18 error-bearing caller files are removed, with
zero new diagnostics and no other pattern changes. Mainline's baseline
remains separate. Eight focused rendering/interaction tests pass; the shared
file has zero lint errors and the same eleven existing warnings, and the
new tests are lint-clean. Actual component screenshots use project CSS at
desktop/mobile widths, with no horizontal overflow in the preview.

Production remains `c911091`, with unchanged tracked source, running process
and build checksum; no deployment, restart or business-data mutation.
Live manager acceptance of these undeployed props is UNVERIFIED. Rollback
is a normal revert of the GlassCard commit on its fix branch, preserving
the earlier serialization and fast-wins fixes.

### Scoped orphan cleanup (2026-10-14)

`fix/scoped-orphan-cleanup-20261014` starts from GlassCard commit `1d4fade`.
The 23 legacy modules listed in the earlier dead-code record above are
absent from main `9cda960` and now removed from this scoped branch as well.
Absence from main alone was not the deletion criterion: the reachability
audit scanned 2,171 tracked code modules and 10,930 resolved imports,
including re-exports, literal dynamic imports, require and import types,
and found zero incoming references to the candidates. None is a file route
or application entrypoint. The five computed imports are isolated tooling
for i18n transpilation/PGlite; all eight import globs load image assets.
Historical migration comments and i18n debt-baseline records are metadata,
not module loaders, and remain unchanged. The new shared JSON/RPC helpers,
regression tests and active manager/portal/security implementations remain.

The complete native TypeScript check is **313 -> 219**: exactly 94 errors
in 22 deleted files are removed, with no new diagnostics or other-pattern
changes. The twenty-third file, the legacy MarketplaceManagerModule,
already has zero errors after its three override fixes. This explains why
the old 97-error estimate now yields 94, not a projected 216-error total.
Mainline's error history is separate and unchanged.

Validation: 88 tests pass across six retained suites. The standard isolated
application build passes and the generated route tree is semantically
unchanged. Production remains `c911091`, with unchanged tracked source,
process/start time and running-build checksum; no deployment, restart or
business-data mutation. Live acceptance of this undeployed cleanup is
UNVERIFIED. Rollback is a normal revert of the orphan-cleanup commit,
preserving the prior serialization, GlassCard and fast-wins fixes.

### Scoped TS2339 contracts and mappings (2026-10-14)

`fix/scoped-ts2339-contracts-20261014` starts from orphan-cleanup commit
`87fa1b5`. The complete native TypeScript check is **219 -> 111**, with
zero new diagnostic signatures. TS2339 falls **110 -> 12**: 98 missing-
property diagnostics across 30 files are removed, plus ten tightly coupled
diagnostics (TS2322: 3, TS2352: 1, TS2769: 3, TS2551: 1, TS2345: 2).
This is not a zero-error typecheck; mainline's separate baseline is unchanged.

| Root-cause group | TS2339 removed | Error-bearing files |
|---|---|---|
| Existing wire DTOs and caller input contracts | 25 | 9 |
| Legal row-to-view mappings | 14 | 5 |
| Supabase select/returning and absent context contracts | 21 | 3 |
| Consumer state, row and error contracts | 21 | 5 |
| Demo schema mappings | 13 | 4 |
| Chat, router and HTTP request contracts | 4 | 4 |

The changes use actual schema fields rather than invented optional columns:
legal audit aliases and the no-rewrite invariant, explicit unscored AI
confidence, unresolved demo alerts, real escalation/request columns and
product names, matching `demo_domains.hostname`, and the existing deployment
state. Unsupported domain-lock/attempt metrics remain explicitly unmonitored.
Bulk moderation retains the same validator-derived operation set. Import
upserts explicitly return IDs and link demos by product slug, not response
position. Unsupported SEO actions still fail explicitly; no false success
response or external integration was added.

**Blocked:** all twelve remaining TS2339 diagnostics are in
`src/lib/dev-manager.server.ts`, referencing `blocked_since`, `blocked_reason`,
`promise_id`, `quality_score` and `escalate_threshold_hours`. These columns
have no authoritative schema source. No migration, fake type extension,
invented value or production database write was used to hide the problem.
Their storage/data policy needs a separate owner decision.

Validation: 122 tests pass across fifteen suites, including thirty new
regressions; thirteen additional source/query/validator checks pass. The
standard isolated build passes and the generated route tree is unchanged.
Eight new test files are lint-clean; scoped lint has no new non-formatting
findings, but existing formatting debt means this is not a full lint pass.
Production remains `c911091`, with unchanged tracked source, process/start
time and running-build checksum. No deployment, restart or business-data
mutation. Live acceptance of these undeployed fixes is UNVERIFIED. Rollback
is a normal revert of this fix commit, preserving the earlier fix stages.

### Scoped TS2345 and TS2322 contracts (2026-10-14)

`fix/scoped-assignment-contracts-20261014` starts from the approved Option A
commit `205ff66`. The full native compiler is **111 -> 46**, with zero new
diagnostic signatures. The inventory contains 58 selected diagnostics, not
the estimated 99: **TS2345 28 -> 0** and **TS2322 30 -> 0** across 31
error-bearing files. Seven tightly coupled diagnostics also disappear:
TS2769: 1, TS2589: 1, TS18047: 2 and TS7006: 3.

| Root-cause group | Selected errors removed | Error-bearing files |
|---|---|---|
| Nullable schema values and UI operations | 21 | 13 |
| Component props, icons and typed dynamic route | 4 | 4 |
| SQL optional RPC argument defaults | 12 | 3 |
| Canonical query and update payloads | 9 | 5 |
| Migration-backed layout RPC metadata | 2 | 1 |
| Resource-row display formatting | 6 | 2 |
| AI content rejection payload | 2 | 1 |
| Published storefront version contract | 1 | 1 |
| DNS mock callback overload | 1 | 1 |

Absent RPC arguments are omitted only where the authoritative SQL already
defaults them to NULL; explicit empty notes and zero bases remain intact.
Demo requests update real `status` and `updated_at` columns, not nonexistent
responder fields. Task writes use generated update shapes; section writes
validate the same editable fields and preserve operator and archived-section
guards. Layout RPC contracts describe existing migrations on the original
authenticated client; no new client, credentials or generated types.
Product cells reuse the existing row formatter. Both AI rejection surfaces
now keep `item_id` canonical, fixing the known reject-payload bug on this
branch only; production has not received it.

**Still blocked:** the same twelve Developer Manager TS2339 signatures for
`blocked_since`, `blocked_reason`, `promise_id`, `quality_score` and
`escalate_threshold_hours`. No invented column, fake Developer Manager type,
migration or rejected delivery-enrichment follow-up was introduced. The only
change in that server file accepts the real nullable priority in its existing
UI-priority mapper. The other 34 diagnostics are outside these two codes;
this is not a zero-error typecheck or a full typecheck PASS.

Validation: 159 tests pass across twenty files, including the retained
regression suites, actual mutation handlers, SDK request/default checks,
nullable UI rows and both rejection paths. The isolated standard build
passes; the generated route tree is unchanged. Four new test files are
lint-clean, and scoped lint has zero new non-formatting findings. Full
scoped lint is not a pass because formatting findings remain.
Desktop/mobile screenshots exercise the actual rejection component with
explicitly labelled local fixtures, never production business data.
Production remains `c911091`, with unchanged process/start time, tracked
source and running-build checksum. No deployment, restart or database
mutation. Live acceptance remains UNVERIFIED. Rollback is a normal revert
of this commit, preserving the earlier approved fixes; the reverse patch
is verified against the private native source.

### Scoped stale consumer contracts (2026-10-14)

`fix/scoped-consumer-contracts-20261014` starts from `ab3da11`. The full
native compiler is **46 -> 30**: TS2353 8 -> 0, TS18048 6 -> 0,
TS2820 1 -> 0 and TS7030 1 -> 0. Zero new diagnostic signatures.
The baseline is twelve blocked errors plus 34 others across eighteen files;
the remaining thirty are twelve blocked plus eighteen others.

The Add Demo page keeps its canonical lazy manager and Suspense fallback;
only the already-unreachable legacy wizard is removed. Influencer workflow
walls use the existing `creatable` flag, preserving ordinary editable walls.
Audit payloads use actual actor/entity/severity/metadata columns and preserve
authoritative context. A confirmed Safe Assist stop clears the session even
if its audit fails, with explicit failure logging and notification.
Typed settings navigation preserves the same URL. Optional detail-route
matches retain seeded data and query fallbacks. The category loader describes
its existing missing flag; floating triggers retain timer/listener cleanup.
No storefront redesign, catalogue numbering or generated route changes.

Validation: **180 tests pass across 27 files**, including seven new test files
covering delegation, creation flags, actual SDK audit payload/error paths,
loader/query fallback and trigger cleanup. The private standard build passes.
All seven new test files are lint-clean; no new non-formatting findings.
Full scoped lint is not a pass because formatting debt remains.
Native rollback reverse-patch validation passes.

The twelve blocked Developer Manager signatures are identical. Its server
and types, and the generated Supabase types, are unchanged in this batch.
Remaining codes: TS2339 12, TS2769 7, TS2589 5, TS2352 2, TS7006 2,
TS2367 1 and TS7016 1. Next priority is the twelve Supabase query-boundary
diagnostics across three files, after checking authoritative schema; then
casts, analytics/test declarations and the demo-role policy comparison.
Do not invent missing schema or change access policy to silence errors.

Production remains `c911091`, with unchanged process/start time, tracked
source and running-build checksum. No deployment, restart or database writes.
Live acceptance, including browser audit permissions, remains UNVERIFIED.
Rollback is a normal revert of this isolated commit; earlier fixes remain.

### Scoped Developer Manager review quality (2026-10-15)

Continued on `fix/scoped-consumer-contracts-20261014` from verified `a2c8f0f`.
A fresh full native baseline reconfirmed all thirty diagnostics by file, code
and message before edits. All twelve TS2339 occurrences were traced through
the task queries, DTOs, generated rows, schema dump, bridge/review migrations
and server contracts. Read-only schema transactions on both the VPS and cloud
confirmed that all five disputed columns are absent from `developer_tasks`.

The smallest verified batch resolves only **quality_score: 1 -> 0**, making
the full compiler **30 -> 29**. The existing `tm_task_id` foreign key points
to the canonical `tm_tasks` row, whose nullable integer `quality_score` is
written by the existing operator-only review handler with a 0-100 validator.
The overview's existing task query now left-projects that one real field.
Only performance aggregation consumes the relation; the existing task view,
DTOs, role gates, RLS, mutation and payment paths remain unchanged.
No schema change, fake developer-task field, generated-type edit or unsafe cast.
The completed-task window, ownership and positive-score filters are retained;
unlinked/unreviewed tasks stay present and keep the existing unscored behavior.
Relational read failures use the existing explicit delivery-read error path.

The other eighteen diagnostics and all eleven remaining TS2339 signatures
are identical to the fresh baseline (ignoring shifted line/column positions):

| Property | Remaining | Evidence / next prerequisite |
|---|---|---|
| `blocked_since` | 5 | No stored field; define the current blocked episode and legacy/missing-history behavior before deriving it from `tm_activity`. Pause/create/update times are not substitutes. |
| `blocked_reason` | 2 | Real source exists on linked `tm_tasks`; defer its separate projection/mapping and unlinked-task regressions to the next small batch. |
| `promise_id` | 2 | `promise_links` and `pt_promises_for` are plural; the DTO is singular. Owner must approve primary-promise selection or an API change. |
| `escalate_threshold_hours` | 2 | No stored field. Delivery `sla_hours` is not a blocked-duration escalation policy; its source and semantics need approval. |

Validation: **185/185 tests pass across 28 files**, retaining all 180 prior
regressions plus five real-SDK transport/aggregation/error cases. Both changed
TypeScript files pass scoped lint with zero findings. The full native compiler
reports exactly one removed signature and zero added signatures; the standard
private build passes and the generated route tree is unchanged. This is not
a zero-error typecheck or a whole-repository lint claim.

Production remains `c911091`, with unchanged tracked source, process/start time
and running-build checksum. No deployment, restart, configuration or database
mutation. Live authenticated acceptance of this undeployed change is UNVERIFIED.
Rollback is a normal revert of this focused commit, retaining `a2c8f0f` and
all earlier verified fixes; the native reverse patch is verified.

## Scoped query-boundary follow-up (2026-10-15)

On `fix/scoped-consumer-contracts-20261014`, the fresh full native compiler
reports **29 -> 15**: fourteen removed diagnostic signatures, zero added.
All eleven blocked Developer Manager TS2339 signatures are identical; its
server, functions and DTOs, generated database types and route tree are unchanged.

The selected batch removes seven TS2769, five TS2589, one TS7016 and one
TS7006. AI CEO metric helpers accept only their actual relations and timestamp
columns. Generic manager queries reject four nonexistent allowlisted relations
explicitly after the existing authorization checks; read-only metadata checks
confirmed their absence on both databases. The allowlist itself is unchanged.
Dynamic insert/update results use the existing JSON row contract rather than
expanding every relation's result inference. Existing write validation,
credentials, financial workflows, append-only protection and audit paths stay
in place; no new write casts or permissive client types.

Accessibility reads describe the eight real migration-backed columns through
a read-only local metadata extension on the same authenticated client. The
table exists on the VPS but remains absent in cloud; errors propagate, and
this is not a claim that cloud availability has been repaired. No migration,
generated type change or invented data. The DOM timing regression now uses
Vitest's existing jsdom environment, retaining route normalization, load,
the exact 2000ms delay, two animation frames and table-content assertions.

Validation: **252/252 tests pass in 33 files**, including all previous 185;
the full standard private build passes. Scoped lint is **not a pass**:
330 findings remain versus 331 at baseline, with zero new non-formatting
findings and zero findings in the four new test files. Existing formatting
debt is not hidden or bulk-reformatted. Full typecheck still exits nonzero:
eleven blocked TS2339, two TS2352, one TS7006 and one TS2367 remain.

The remaining nonblocked diagnostics concern the homepage catalogue mapping,
demo-gateway response contract, chatbot session callback and manager access
role policy; they were not modified in this batch. Production remains
`c911091` with unchanged process/start time, tracked source and running-build
checksum. No deployment, restart, configuration or database mutation. Live
authenticated acceptance of these undeployed changes is UNVERIFIED.
Rollback is a normal focused commit revert; reverse-patch validation retains
`7e689b6` and all earlier verified fixes without resetting unrelated work.

## Final four unblocked contracts (2026-10-15)

On the same isolated branch, a fresh full native baseline reconciled exactly
with the published fifteen-error result. The selected batch reduces **15 -> 11**:
two TS2352, one TS7006 and one TS2367 removed, zero new signatures. Only the
eleven blocked Developer Manager TS2339 remain; their complete file/code/message
signatures and all Developer Manager source files are unchanged.

- Curated homepage rows now call the existing `toDemo` converter, just like
  category catalogue rows, instead of asserting `CatalogCard[]` is `Demo[]`.
  Published row selection, ordering, limit, favorites, card index and existing
  card/rail design are retained. No new catalogue data or numbering scheme.
- `getDemoConfig` validates its existing nonempty string input at the TanStack
  boundary instead of casting absent input to a string. Valid strings and
  existing public-key queries, visibility/active filters, ordering and response
  shapes are unchanged. Invalid input fails explicitly before database access.
- `ChatSession.visitor_name` and `started_at` use the actual generated
  `chat_sessions` column types. This restores string inference for analytics
  initials without annotating an `any` callback or altering the query or screen.
- Demo action access uses string membership, matching the existing view-role
  membership pattern. The legacy `demo_manager` label is not in the current
  database enum; this does not invent or assign that role, promote another role,
  or broaden permissions. Every current enum role, legacy/unknown labels,
  fallback precedence, view-only roles and signed-out denial are regression
  tested. Any future role/schema policy remains a separate owner decision.

Validation: **273/273 tests pass in 37 files**, retaining all previous 252
and adding twenty-one targeted regressions. The full standard private build
passes; generated routes/types, package manifests and the lockfile are unchanged.
Scoped lint retains the same 161 baseline findings, with zero added findings
and all four new test files clean; whole scoped lint is not a pass. The native
typecheck still exits 2 solely for the eleven explicitly blocked diagnostics.

Production remains `c911091`, with unchanged tracked source, process/start
time and running-build checksum. No deployment, restart, configuration or
database write. Live acceptance of this undeployed batch is UNVERIFIED.
Rollback is a normal revert of this focused commit, retaining `8a6587c` and
earlier verified fixes; the reverse patch is checked against the native source.

## Do not

- Rewrite pushed history (see the Lovable note above).
- Write to the VPS database without the owner's explicit approval for that
  change. Reads for diagnosis are read-only sessions.
- Delete financial records, or any row, to tidy up. Retire it instead.
- Put mock, sample or hardcoded data where the database is the source.
- Redesign existing UI; connect it to real data (see LOCKED.md).
- Keep backups, `-v2` copies or archives in the repository; git has them.
- Commit `.env`, `.env.ops` or any token, key or password.
- Edit an applied migration, or name a new one so it sorts before the
  migrations it depends on.
- Return `unknown` (or `Record<string, unknown>`) from a server function; use
  `Json` or a concrete type.
- Push a change that has not been typechecked when it touches types.
