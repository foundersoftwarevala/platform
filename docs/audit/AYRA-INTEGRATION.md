# AYRA integration status

## Status

**Partial integration using the AYRA implementation already in this
repository.** The requested external source was not accessible from this
workspace, so no code is claimed to have been copied from it.

The provided GitHub URL,
`https://github.com/afilatemanagement/ai-agent-dashboard`, returned HTTP 404
to the available unauthenticated GitHub fetch. `git ls-remote` could not
authenticate because interactive credentials are unavailable. The external
repository's branch, contents, and license therefore remain **NOT VERIFIED**.

## Existing AYRA implementation reused

The platform already contains an AYRA page at `/ai-ceo/ayra`, an AYRA sidebar
entry, and a live feed/chat interface:

- `src/routes/ai-ceo.ayra.tsx` — existing AYRA route, guarded for boss/admin.
- `src/routes/ai-ceo.tsx` — existing AI CEO shell and AYRA navigation entry.
- `src/components/ai-ceo/sections/AICEOAyra.tsx` — capability and order view.
- `src/components/ai-ceo/AyraLiveFeedChat.tsx` — live feed and chat UI.
- `src/lib/ayra/functions.ts` and `src/lib/ayra/core.server.ts` — authenticated
  server-function and tool-call boundary.
- `src/lib/ayra/tools.server.ts` — the read-only data queries.

No external AYRA component was copied. The new
`src/components/ai-ceo/AyraHomeBanner.tsx` is a small, native platform banner
that links to the existing AYRA page. It is rendered above the existing AI CEO
dashboard banner; the existing dashboard UI remains in place.

## Database access and safety boundary

AYRA's server-side database helper,
`src/lib/tasks/db.server.ts`, resolves its canonical task database from
`SV_PLATFORM_DATABASE_URL` or `VPS_DATABASE_URL` and enforces the
`sv_platform` database name when the explicit platform variable is present.
The existing AYRA server path verifies the signed-in user and restricts
access to `boss` or `admin` before running its allowlisted tools.

The existing tools read task health and alerts, developer wallet balance and
recorded fines, financial totals, and task search results. The platform
health query now also returns aggregate counts from `chat_sessions`,
`chat_messages`, `ams_activity_events`, and `ams_award_ledger`. It does not
read message bodies or individual AMS records. No arbitrary SQL tool or
write-capable data tool was added.

The existing `recordAyraInspection` path appends an audit row for an
inspection/chat request. This is an audit-log write, not a business-data
mutation; AYRA's inspection tools themselves do not change tasks, wallets,
payments, chat messages, or AMS records.

## UI before/after description

- **Before (source inspection):** `/ai-ceo` showed the existing AI CEO
  dashboard banner at the top. AYRA was reachable through the existing
  sidebar route only.
- **After (source change):** a compact AYRA read-only banner appears above the
  unchanged AI CEO banner and links to `/ai-ceo/ayra`. The AYRA live-feed
  summary also displays aggregate Chat session/message and AMS event/award
  counts.
- **Live browser verification (2026-10-23):** signed in with the authorized
  Boss account and opened `/ai-ceo`. The AYRA "READ-ONLY" banner rendered
  above the existing "AI CEO Dashboard" banner. No screenshot was captured.
- **Post-deploy browser verification (2026-10-23):** authenticated visits to
  `/ai-ceo` and `/ai-ceo/ayra` rendered successfully. The AI CEO page loaded
  its metrics; AYRA displayed live aggregate counts of 5 Chat sessions,
  11 Chat messages, 1 AMS event, and 3 AMS awards. No browser console errors,
  uncaught page errors, or HTTP responses with status >= 400 were captured
  during those monitored visits. This confirms the aggregate AMS data path,
  not that the recognition-notification detector invoked its pending RPC.
- The initial live browser check had found two 404 responses for the Cloud
  Supabase RPC `ams_recognition_pending`, with matching browser console errors;
  those failures were the reason for the server-side routing fix below.

## Validation and deployment

Validation performed:

- AYRA banner regression test: passed.
- Focused AYRA regression suites: 5 tests passed across 2 files.
- Focused ESLint for the newly added banner and test: passed.
- Semantic lint (with the repository's existing Prettier rule disabled) for
  touched AYRA files: passed.
- Production build: passed.
- Full TypeScript check (`npx.cmd tsc --noEmit -p .`): passed (exit code 0).
- The generated static source catalogue was refreshed and committed as
  `853bf27b0fe80c097e45dba1930929786a0dfc17`.
- `npm run i18n:check`: **not clean**. On 2026-10-23, after marking the AYRA
  product name as non-translatable, it still reports 1,474 hardcoded
  user-facing strings across 62 files. The check was not bypassed by raising
  `scripts/i18n-baseline.json`; the remaining strings need a separate,
  repository-wide localization pass.
- ESLint over the touched legacy AYRA files reports 61 Prettier formatting
  findings; no unrelated bulk reformat was applied.

The AYRA-specific changes were committed and pushed on `main` as
`1318f722163583099837d6030d1ad9e2e786765a`; the deployment status clarification
is `42ea51cc435fb60a30a53610728b46d66471a22b`. The source catalogue refresh is
`853bf27b0fe80c097e45dba1930929786a0dfc17`.

**Production deployment completed 2026-10-23** through
`scripts/ops/sv-deploy.sh`. The first production deployment completed on 2026-10-23 at
`853bf27b0fe80c097e45dba1930929786a0dfc17`. A follow-up for AMS recognition
RPC routing was pushed as
`dcdbeb11a87db4e546cc567ff1adc14529851b83` and deployed through the same
guarded script. The VPS script verified the manifest, passed the port-3011
homepage smoke test (HTTP 200), swapped the build, restarted PM2, and reported
the live homepage HTTP 200 with one `softwarevala-staging` process holding
port 3000 (PID 463793; online at verification).

## AMS recognition RPC follow-up (2026-10-23)

Read-only inspection of the configured `sv_platform` database confirmed these
existing functions and service-role execute grants:

- `ams_recognition_pending(timestamptz) -> jsonb`
- `ams_recognition_peek(uuid[]) -> jsonb`
- `ams_recognition_claim(uuid[]) -> jsonb`

No database migration was needed or applied. The browser had been calling the
Supabase Cloud RPC directly even though the production functions live in
`sv_platform`. The pending, detail, and claim operations now call authenticated
TanStack server functions that execute those existing functions inside the
canonical `sv_platform` caller-scoped transaction. Their inputs and JSON
results are validated; the database continues to restrict each request to the
signed-in user's own recognition records.

Validation: the focused recognition contract tests pass (4/4), the complete
TypeScript check passes (exit 0), and the new server-function/test files plus
AYRA banner lint clean. The existing `Celebration.tsx` file has pre-existing
Prettier and unused-expression findings; semantic lint of the touched legacy
components passes with those pre-existing findings excluded.

The live `/ai-ceo` and `/ai-ceo/ayra` routes were opened in an authenticated
Boss browser session after deployment. Aggregate AMS data rendered on AYRA,
and the monitored visits captured no console/page errors or HTTP responses
with status >= 400. The recognition detector's pending-RPC invocation was not
separately observed, so that specific notification path remains **YELLOW:
not directly verified**.

The i18n gate remains **FAIL** with the 1,474 findings above. The external AYRA
repository and its license remain unverified; no external code is claimed as
integrated.
