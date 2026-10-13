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
- **`callAsUser` is copied into 23 files.** Most return `Record<string, unknown>`,
  which TanStack cannot serialise; this is the largest group of type errors
  (58 left). One shared helper returning `Json` would fix the pattern.
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
| Product page passes the indexing gate a URL string | **347** (current) |
| Target | 0 |

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
