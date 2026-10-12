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
- **Slots on the cloud project:** 9,100 = 7,200 occupied + 1,800 vacant + 100
  reserved. The 1,800 vacant are the 20 new countries; the catalogue has no
  product for any of them yet, so they stay `noindex`, out of the sitemap and
  off the home page. **The VPS still has the 80-country grid** (about 7,280,
  inferred from its sitemap; the ops key cannot read it). Applying the new slots
  and the event-mgmt changes there waits for the
  owner's approval.
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
  `visible = false` on the cloud project, the other 60 are kept.
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

Work log: Phase 1 marketplace fixes `b4ad6e0`, `adc5107`, `90ee1a6`. Phase 2
batch A: slot links `a43a081`, hreflang `b3d87aa`, 100 countries `9e1cceb`, 17
shelves `f4a2e96`, event-mgmt merge `8eac048`.

## Typecheck error count

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
