# R&D Manager integration

Source: user-owned `removalwork59-sketch/r-d-manager`, commit
`b85609dce3b298170b3591837c46e360f3e27e08`.
The [file manifest](source-manifest.json) accounts for every source tracked file.

## Entry points

The Control Panel sidebar's **R&D Manager** button opens `/rd-manager`.

| Source route   | Integrated route          | Purpose                                                                              |
| -------------- | ------------------------- | ------------------------------------------------------------------------------------ |
| `/rd-manager`  | `/rd-manager`             | Opportunity dashboard, inbox, evaluations, research/POC, clusters, analytics, roster |
| `/`            | `/rd-manager/lab`         | Twelve R&D workspace screens                                                         |
| `/pro-manager` | `/rd-manager/pro-manager` | Complete bundled Pro Manager                                                         |
| `/start`       | `/rd-manager/start`       | Software requests, SaaS partnerships, Build With Us                                  |
| `/track`       | `/rd-manager/track`       | Request ID + contact email status lookup                                             |

Internal entries use the existing Control Panel identity. There is no new
standalone app or password login. Only `/rd-manager/start` and
`/rd-manager/track` are public. Their four public server functions submit,
prepare/upload attachments and track requests with burst limits; submission also
has database-backed device/email limits. Internal functions and attachment
downloads retain the platform's manager role check.
Team member management is retained as a roster; it does not grant platform roles,
create accounts, store passwords, or authenticate members. Account permissions
remain controlled by the platform.

Source components, hooks, server functions, generated database types and assets
live under `rd-module` namespaces. Shared source UI primitives are retained locally;
the global design system, existing Pro Manager entries and homepage are preserved.
Module CSS variables and helper classes are scoped to `.rd-module`.

## Database and runtime prerequisites

`supabase/migrations/20261108T111000_rd_manager_module.sql` combines all seven
source migrations in dependency order. Tables/indexes/triggers/policies are
idempotent. Source sample ideas, financial records, users, reports and metrics
are **not inserted**. Real database rows remain the data source.

Apply the migration to the database used by the platform, following the shared
transactional dry-run, rollback and verification procedure. This integration
does not automatically apply migrations or write to the production VPS database.
Missing tables must produce a visible error, not fabricated demo results.

The attachment flow requires a private Supabase Storage `rd-attachments` bucket.
The migration creates it only if the storage schema exists. The platform's
storage endpoint must be configured and operational for file upload/download.
If Storage is hosted separately from the database/PostgREST endpoint, configure
both `SUPABASE_STORAGE_URL` and `SUPABASE_STORAGE_SERVICE_KEY` server-side.
Never use the database gateway as a Storage endpoint or expose the private
storage key to the browser. Same-service installations can retain the existing
Supabase URL/service-key configuration.

The homepage's **Request Your Software** link opens the existing public form
with software-on-demand selected. Requests remain in `rd_opportunities`, their
events in `rd_opportunity_events` and inbox alerts in `rnd_notifications`.
The canonical `/` route imports `sapphire-home/HomeIndex`; its header is
`sapphire-home/TopUtilityBar`. The retired `marketplace-home` header is not
evidence of a change to the active homepage. `/marketplace` redirects to `/`.
The active R&D notification screen reads those real alerts, not sample rows.
The additive migration, which requires separate production approval,
`supabase/migrations/20261108T112000_homepage_application_lifecycle.sql` also
adds a global admin-bell alert for new requests. Prepare backups, dry-run and
rollback before applying it; application code does not apply it automatically.

The module uses the platform's existing `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`; source environment files are never copied.
The browser database client obtains its access token from the existing platform
session rather than creating another auth session.

AI handlers retain the source gateway contract and require `LOVABLE_API_KEY`.
No paid inference or external transmission is performed merely by visiting the
module. AI output remains unverified until an actual authorized inference run.
The streaming feedback-insight handler retains strict JSON-schema validation.

## Verification

`src/lib/rd-module/integration.test.ts` covers existing-session authorization,
the sidebar/route connection, internal server-function guards and the exact
public-intake exception list, functional
source-file coverage, absence of source credentials and seed-free private SQL.
UI inspection must also cover the imported twelve Lab screens, opportunity
sections, bundled Pro Manager, request intake/tracking and mobile navigation.
An HTTP 200 page alone is not proof that migrations, storage or AI are live.

The source inventory contains 187 tracked files: 155 source entries map to 140
distinct imported/adapted target files; the remaining entries reuse platform
scaffolding or deliberately exclude environment files. All components, hooks,
libraries, assets and five source route surfaces are accounted for.

Initial integration verification:

- 20 focused tests pass, including operator access, sidebar routing, every
  server-function guard, file mapping and opaque-key/user-JWT handling.
- Scoped module ESLint reports zero errors.
- Full TypeScript check reports 347 existing platform diagnostics, with no
  R&D-module diagnostics; it is not a clean repository-wide typecheck.
- All seven source schemas were applied twice to disposable local PostgreSQL
  (PGlite): 45 tables, 45 manager-read policies, zero sample business rows.
  Manager reads pass; non-manager and anonymous access are denied.
  The attachment bucket is private with a 10 MiB limit.
- A complete Node-server build succeeds. Runtime database, storage and paid AI
  acceptance remain separate prerequisites; local SQL validation does not
  establish that the migration has been applied to either remote database.
- 55 local production-mode browser checks pass with a real owner login:
  sidebar mouse navigation, all 12 opportunity sections, all 12 Lab sections,
  all 18 Pro Manager sections, all three intake forms, request tracking and
  the complete mobile navigation portal. No rendering crashes occurred.
  Requests were not submitted and paid AI was not invoked. Missing remote
  tables produce the visible module error banner; data flows remain unverified.
