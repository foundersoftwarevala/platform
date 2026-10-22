# Phase 8 — Assist Manager security and real-time wiring

## Scope and deployment status

This phase replaces browser-side Assist table operations with authenticated
server functions, adds database-side consent and write guards, provides a
separate WebSocket signaling process, and connects the Live Assist,
Screen Control, Consent, and Session Logs screens.

The migration has **not** been applied, the signaling process has **not** been
installed or started, and no production service or database was changed.
Consequently, the SQL and runtime behavior below describe the implementation
in this branch, not a live acceptance test.

## Migration and access control

Migration: `supabase/migrations/20261108T152000_assist_system_real.sql`.

- Adds `consent_hash`, control-consent metadata, and recording metadata to
  `assist_sessions`; creates `assist_logs` and single-use
  `assist_signal_tickets`.
- Active and paused sessions require a SHA-256-shaped consent hash, recorded
  target consent, no revocation, and an unexpired approval by the assigned
  operator (`assist_sessions_require_consent`, migration line 121).
- A status change appends to `public.audit_logs`, `assist_audit_logs`, and
  `assist_logs` (`assist_sessions_status_audit`, line 157). Existing
  `assist_audit_logs` also has its append-only trigger from
  `20260906180500_assist_manager_authorization.sql`.
- `assist_logs` rejects UPDATE and DELETE (line 243). Existing platform
  `audit_logs` append-only/hash-chain behavior comes from
  `20261108T145300_audit_logs_truth_columns.sql`; the Assist migration itself
  does not add an external WORM store.
- Client table grants are revoked for the Assist tables and RLS is enabled.
  Authenticated users receive SELECT only; no authenticated write policies
  are retained (line 258). `assist_sessions` permits the target, assigned
  agent, or configured managers to read (line 312). Other read policies
  restrict rows to participants or managers. The manager role set in
  `assist_is_manager()` is admin, boss, founder, super_admin, boss_owner,
  support, and sales_support_manager.
- Legacy SECURITY DEFINER write entry points are revoked from `public`,
  `anon`, and `authenticated`; `service_role` retains server-only grants
  (lines 414–447). The migration ends with grant/policy assertions (line 449).
- Migration preflight refuses to proceed if required base tables are missing
  or if active/paused sessions lack valid consent. Existing data must be
  inspected and resolved before applying it.

These are static migration checks. They have not been executed against the VPS
database; live grants, policies, trigger behavior, and existing-session
preflight results remain unverified.

## Server functions and UI wiring

- `src/lib/assist-manager/functions.ts` authenticates the bearer token and
  loads roles before each operation (line 62). Manager approval verifies the
  assigned operator and current manager role (line 148).
- The server module supplies reads for all Assist screens, participant-scoped
  audit/log reads (line 452), server-side session/request/approval operations,
  consent grant/deny, emergency termination, control-consent updates, and
  one-time signaling ticket issuance (line 1133).
- `src/lib/assist-manager/api.ts` preserves the existing screen call shapes but
  delegates to server functions. A repository search found no direct
  `supabase.from()` or `supabase.rpc()` calls in
  `src/components/assist-manager` or `src/lib/assist-manager`.
- `src/components/assist-manager/AMFullLayout.tsx` mounts the realtime
  provider and consent dialog (lines 123–126).
- `AMLiveAssist.tsx` renders the local or remote WebRTC video and exposes
  target capture, viewer connect, pause/resume, and stop controls.
- `AMScreenControl.tsx` exposes the target's Allow Control switch. DataChannel
  messages are intents only; this browser implementation does not inject
  operating-system input.
- `AMSessionLogs.tsx` reads `assist_logs`, `assist_audit_logs`, and platform
  `audit_logs` through the server query, with existing loading/error/empty
  presentation.
- `src/routes/assist-manager.tsx` retains route-level role authorization.

## WebRTC signaling and masked capture

The signaling service is a separate Node process:

- Entry point: `scripts/assist-signaling.ts:1`.
- Service: `src/lib/assist-manager/signaling.server.ts:196`.
- The browser requests a short-lived ticket through
  `getAssistSessionTicket`; the server stores only its SHA-256 hash. Ticket
  consumption is single-use and checks the session, target consent, current
  approval, and participant identity (`signaling.server.ts:69`).
- The WebSocket upgrade requires an allowed Origin and UUID session path
  (`signaling.server.ts:32,233`). The service rechecks session approval and
  consent and reacts to database notifications (`signaling.server.ts:140,331`).
- The browser requests window capture with
  `displaySurface: "window"` and stops unless the browser confirms that
  surface (`src/lib/assist-manager/capture.ts:10–21`). It paints the canvas
  blue before drawing the selected window, then sends only the canvas capture
  stream (`capture.ts:50,68`).

**Security limit:** the blue mask is implemented in an untrusted browser
client. A modified client can bypass the canvas and send a different stream;
the peer-to-peer media path is not inspected by the signaling server. This
does **not** prove or guarantee that an assistant can never receive a full
desktop. A trusted capture agent or a server-enforced media pipeline would be
required for that stronger guarantee.

The consent hash is generated by the browser and checked for format by the
database. It is not a platform signature or proof that a human saw the
consent dialog; the authenticated target identity and manager approval are
enforced, but the browser remains an untrusted client.

## Consent and recording

- `src/components/assist-manager/screens/ClientConsent.tsx:26` presents Allow
  and Deny. Allow creates a random-nonce SHA-256 consent hash in the browser
  and calls the server function; it does not start capture. The user must
  separately start window sharing.
- Consent alone is insufficient: the database guard and signaling ticket
  checks also require the assigned manager's unexpired approval.
- Recording uses `MediaRecorder` in the target browser on the masked canvas
  stream (`src/lib/assist-manager/capture.ts:98`). It is **client-recorded and
  server-stored**, not server-side WebRTC/SFU recording.
- `src/routes/api/assist/recording.ts:8` authenticates upload with a bearer
  token. `src/lib/assist-manager/recording.server.ts:35` streams a bounded
  upload to private local storage, checks target/session consent, computes
  SHA-256, and records the private filename/hash in the session and audit
  records (`recording.server.ts:49,71,102,109`).
- The target can modify or omit browser recording; server storage does not
  prove the submitted video originated from the intended capture pipeline.
  Hashing proves only the bytes received by this server.

## Signaling service installation

The service requires a Node runtime and a WSS reverse proxy. Configure these
in the service environment (do not commit secrets):

- `VPS_DATABASE_URL` — connection to the canonical `sv_platform` database.
- `ASSIST_SIGNALING_ORIGINS` — comma-separated exact dashboard origins.
- `ASSIST_SIGNALING_HOST` and `ASSIST_SIGNALING_PORT` — bind address and port;
  the implementation defaults to loopback.
- `VITE_ASSIST_SIGNALING_URL` — browser-visible `wss://` URL (plain `ws://` is
  accepted only for localhost).
- `ASSIST_RECORDING_DIR` — optional private recording directory; default is
  `/var/lib/softwarevala/assist-recordings`.

Install dependencies from the lockfile, then run `npm run assist:signaling`
under a dedicated service manager with restart-on-failure and restricted
filesystem/database permissions. Configure the reverse proxy for WebSocket
upgrade to the loopback service. No TURN server is configured; connectivity
through restrictive NAT/firewalls is not verified.

## Verification

- Full TypeScript check (`npx.cmd tsc --noEmit -p .`): **PASS**.
- Focused ESLint on Phase 8 files with `prettier/prettier` disabled: **PASS**.
- Production build (`npm.cmd run build`): **PASS** on the final source.
- `npm run i18n:check`: **FAIL**. It reports new hardcoded strings in the
  Assist screens, growth in multiple unrelated dirty files, and a stale
  generated source catalogue. The unrelated baseline/catalogue files were not
  regenerated or rewritten to avoid incorporating unrelated worktree edits.
- No Assist-specific automated tests were found. No migration, production
  database, WebSocket service, browser capture, peer connectivity, or recording
  upload was exercised live.

## Rollback and outstanding work

Before applying the migration, prepare a data-aware rollback. Revoke/stop the
signaling service first; then use a reviewed migration rollback only after
checking for new Assist sessions, audit rows, ticket rows, and recordings.
The migration has **not** been applied, so there is no live database state to
roll back. Revert only the Phase 8 code changes using normal commits; do not
rewrite published history. Remove the `assist:signaling` service and its WSS
proxy/configuration if installed.

Outstanding for production acceptance:

1. Resolve the i18n check without updating unrelated dirty-file baselines.
2. Require a trusted capture mechanism if the full-desktop confidentiality
   guarantee is mandatory.
3. Configure and verify WSS and TURN as required by the deployment network.
4. Exercise migration preflight, RLS, server authorization, consent/approval,
   stop/revocation, recording retention, and audit behavior against an
   authorized staging database and browser pair.
5. Decide retention, access, and download controls for private recordings;
   this phase stores files but does not provide a recording-download UI.
