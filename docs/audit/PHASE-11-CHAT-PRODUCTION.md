# Phase 11 — Chat production foundation

## Scope and truth boundary

This phase extends the canonical chat schema and server functions already in
the repository. It does not create duplicate `conversations`, `messages`, or
attachment tables. The additive migration is
[`20261108T153000_chat_consent_cursor_hardening.sql`](../../supabase/migrations/20261108T153000_chat_consent_cursor_hardening.sql);
it has **not** been applied to either database by this work.

## Schema, RLS, and consent

- The canonical tables and their RLS policies were already introduced in
  [`20260923T120000_connect_chat_tables.sql`](../../supabase/migrations/20260923T120000_connect_chat_tables.sql:79)
  and tightened in
  [`20260924T010000_chat_read_back_own_rows.sql`](../../supabase/migrations/20260924T010000_chat_read_back_own_rows.sql:14).
  RLS is enabled there for conversations, participants, messages, attachments,
  mentions, reactions, receipts, and bookmarks.
- Messages already reject row-level UPDATE/DELETE through
  `block_message_mutation()` and immutable triggers
  ([migration lines 188–192](../../supabase/migrations/20260923T120000_connect_chat_tables.sql:188)).
  The new migration adds a TRUNCATE trigger as well. This is database-level
  protection against ordinary DML, **not** protection against a database
  owner/superuser disabling triggers or altering the schema.
- The new `user_consents` table stores append-only decisions for
  `message_storage` and `ai_review`, with policy version and timestamp
  ([migration lines 7–47](../../supabase/migrations/20261108T153000_chat_consent_cursor_hardening.sql:7)).
  UPDATE, DELETE, and TRUNCATE are rejected; client roles receive read-only
  access to their own consent rows, and the server role can only SELECT/INSERT.
- `has_current_chat_consent()` is an argument-free, caller-scoped RLS helper.
  Chat-data SELECT policies require current consent. The `messages` policy
  specifically requires participant membership; the `conversations` policy
  also lets a creator read their own conversation row. Existing manager-wide
  direct SELECT policies are removed; managers continue through the
  permission-checked server functions.
- `anon` and `authenticated` lose direct INSERT/UPDATE/DELETE/TRUNCATE on the
  canonical chat and server-owned chat tables. The chat-files Storage policies
  no longer allow direct client upload/delete; uploads use the server-issued
  signed path.
- The existing authenticated notification endpoint is still used for message
  event delivery. Its subscription carries identifiers only; the recipient
  fetches content through a server function.

## Server functions and paging

- Consent read/write endpoints are
  [`getUserChatConsent` and `setUserChatConsent`](../../src/lib/chat/user-data.functions.ts:47).
  Server-side policy, append-only recording, and consent checks are in
  [`consent.server.ts`](../../src/lib/chat/consent.server.ts:3).
- Conversation, message, upload, receipt, reaction, bookmark, search, media,
  attachment URL, and translation functions require current consent and check
  caller identity/permissions in
  [`user-data.functions.ts`](../../src/lib/chat/user-data.functions.ts:131).
  AI generation and support/handoff entry paths also enforce consent in
  [`ai.functions.ts`](../../src/lib/chat/ai.functions.ts:81) and
  [`support.functions.ts`](../../src/lib/chat/support.functions.ts:18).
- The AMS chat screen's old direct conversation/message writes were replaced
  with the existing authenticated service functions
  ([`ChatScreen.tsx`](../../src/components/ams/chat/ChatScreen.tsx:105),
  [`chat-service.ts`](../../src/services/chat/chat-service.ts:1)). The browser
  still reads its own role from `user_roles`; it no longer reads/writes
  canonical chat rows directly.
- The existing `user-data.functions.ts` was extended instead of adding a
  duplicate `src/lib/chat/core.server.ts`; this keeps the repository's current
  server-function boundary and shared chat contracts.
- `getUserChatMessages` caps pages at 50 and validates both cursor fields
  ([`user-data.functions.ts`](../../src/lib/chat/user-data.functions.ts:222)).
  Its keyset condition and order are:

  ```sql
  (m.created_at, m.id) < (:cursor_created_at, :cursor_id)
  ORDER BY m.created_at DESC, m.id DESC
  LIMIT :page_size_plus_one
  ```

  The query uses the matching
  `(conversation_id, created_at DESC, id DESC)` index. One extra row detects
  another page; the response is returned chronologically. The user Chat UI
  fetches older pages with React Query infinite pagination in
  [`use-chat.ts`](../../src/hooks/use-chat.ts:49). The AMS screen also exposes
  a “Load earlier messages” control and preserves scroll position while
  prepending pages in
  [`ChatScreen.tsx`](../../src/components/ams/chat/ChatScreen.tsx:235).
- The composer and upload-signing/server attachment handlers use a shared
  MIME/extension allowlist
  ([`file-policy.ts`](../../src/services/chat/file-policy.ts:1)).
  This is metadata validation, not byte-signature detection, malware scanning,
  or proof that a MIME header matches file contents.

## Realtime and load testing

- Message events use the app-authenticated
  [`/api/notifications/stream`](../../src/routes/api/notifications/stream.ts)
  SSE path, backed by the platform's PostgreSQL notification stream. The
  Manager shows `Realtime: LIVE` only after the stream's ready event and moves
  back to connecting/offline on failure
  ([`ChatManagerWorkspace.tsx`](../../src/components/chat-manager/ChatManagerWorkspace.tsx:175)).
- No new `realtime.server.ts` or WebSocket server was added: the existing
  authenticated SSE transport is retained. This is not evidence of the
  requested 100k WebSocket architecture.
- The previous browser Supabase Realtime presence/typing channels were not
  demonstrably authorized against the canonical VPS participant table. They
  have been removed from chat clients rather than treated as private. Typing
  indicators and online presence are therefore **not provided** in this phase.
  Message delivery is SSE, not WebSocket. No 100,000-user capacity claim is
  supported by this implementation.
- [`scripts/load-test-chat.mjs`](../../scripts/load-test-chat.mjs) is an
  opt-in WebSocket join probe, capped at 1,000 connections, requiring an
  explicit acknowledgement and remote-target opt-in. It needs a real
  authorized endpoint, JWT, and conversation. No such test target/credentials
  were available, so the connection test was not run; only syntax and the
  expected missing-configuration guard were checked.

## Security limitations / not done

- Application-layer encryption and key management for message bodies are
  **MISSING**; the existing `messages.body` column is plaintext.
- Message immutability is enforced by database triggers, but there is no
  per-message append-only `audit_logs` hash chain or WORM storage proof in this
  phase; privileged database owners can still alter the schema or disable
  triggers.
- Private WebSocket authorization, secure WebSocket typing/presence, Redis or
  horizontally coordinated fan-out, and 100k-concurrent-user load evidence are
  **MISSING / NOT VERIFIED**.
- File byte inspection, malware scanning, content-derived file hashes, and
  background workers are **NOT DONE**.
- This migration secures the canonical `conversations`/`messages` chat. Separate
  legacy support-chat flows still write the distinct `chat_messages` relation
  through generic browser hooks in
  [`OmniChannelInbox.tsx`](../../src/components/support/OmniChannelInbox.tsx:44),
  [`LiveChatModule.tsx`](../../src/components/sales-support/modules/LiveChatModule.tsx:17),
  and
  [`SCLiveChatInbox.tsx`](../../src/components/support-chatbot-wireframe/screens/SCLiveChatInbox.tsx:23).
  They were not migrated here; therefore
  “no direct browser chat writes” is true only for the canonical chat, not the
  entire application.
- Users can revoke consent through the server function by submitting
  `granted: false`; a user-facing consent-revocation settings control is
  **MISSING**.
- Migration execution, live RLS verification, production Realtime acceptance,
  and deployment are **NOT DONE**.
- Export and background workers remain outside this phase.

## Verification

| Check | Result |
|---|---|
| Focused pagination and file-policy tests | 5 tests passed in 2 files |
| ESLint on changed chat TypeScript/UI files, with `prettier/prettier` disabled | PASS |
| `node --check scripts/load-test-chat.mjs` | PASS |
| `node scripts/load-test-chat.mjs` without target configuration | Expected nonzero exit: `CHAT_LOAD_TEST_WS_URL is required`; no network attempted |
| `npm.cmd run i18n:check` | FAIL: repository baseline reports pre-existing hardcoded-string increases in unrelated files; no changed chat files were reported. Generated source catalogue was refreshed. |
| `npx.cmd tsc --noEmit -p .` | PASS on the settled Phase 11 source |
| SQL migration application / live RLS test / capacity test | NOT RUN |
