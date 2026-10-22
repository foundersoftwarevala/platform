# Chat Verification

## Result

| Check | Result |
|---|---|
| End-to-end conversation/message flow | **NOT VERIFIED** — no local database credentials, database URL, `psql`, or isolated auth fixtures are available. No production writes or unauthorized-user probes were attempted. |
| Private-message authorization | **PASS in source; runtime NOT VERIFIED** — the hardening migration revokes direct client writes and gates reads by consent and participation. Whether that migration is applied to a deployment was not checked. |
| Realtime | **No live runtime proof** — the application implements an authenticated server-sent-event notification stream, not a chat-specific WebSocket. It reports LIVE only after receiving the stream's `ready` event. |
| Offline fallback | **PASS in focused tests** — chat messages poll every 30 seconds and the conversation list every 60 seconds only while connecting, reconnecting, or offline; background polling is disabled. |
| File-name/MIME policy | **PASS in focused tests** — executable suffixes including `.exe` and `.js` are rejected, and only an explicit MIME allowlist is accepted. Content signatures are not inspected. |
| Private bucket and signed URLs | **PASS in source; deployment NOT VERIFIED** — the migration declares a private bucket, and the server signs uploads/downloads. The migration uses `ON CONFLICT DO NOTHING`, so it does not prove the visibility of a pre-existing deployed bucket. |
| Dead buttons/placeholders | **No dead controls identified** in the requested component folders. The emoji and reaction buttons use `PopoverTrigger`; other inspected actions have handlers or are explicitly disabled. |

## Flow and privacy evidence

- The user UI calls authenticated server functions rather than writing messages directly from the browser. Message reads require current chat consent and participation (or the manager permission); message sends derive the sender from the authenticated caller and check consent, participation, conversation state, and reply target. See [`user-data.functions.ts`](../../src/lib/chat/user-data.functions.ts#L222) and [`user-data.functions.ts`](../../src/lib/chat/user-data.functions.ts#L326).
- The hardening migration revokes direct `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE` on messages from `anon` and `authenticated`, and its participant-read policy requires current consent. See [`20261108T153000_chat_consent_cursor_hardening.sql`](../../supabase/migrations/20261108T153000_chat_consent_cursor_hardening.sql#L80) and [the message policy](../../supabase/migrations/20261108T153000_chat_consent_cursor_hardening.sql#L120).
- The source policy is not proof that the migration is applied or that deployed RLS behaves as written. User A/B create-send-reply persistence and User C denial were not exercised because no isolated database/auth environment was available.

## Realtime and fallback

- The stream route validates the bearer token, obtains the current user, requires the database listener, and subscribes to that user's notifications. It emits identifiers rather than message bodies. See [`stream.ts`](../../src/routes/api/notifications/stream.ts#L23) and [`notification-hub.server.ts`](../../src/lib/realtime/notification-hub.server.ts#L39).
- The browser maps stream open/reconnect/unavailable events into connection state. A `LIVE` badge is conditional on the stream opening; the manager also returns to polling when the stream is not live. See [`use-chat.ts`](../../src/hooks/use-chat.ts#L86), [`ChatManagerWorkspace.tsx`](../../src/components/chat-manager/ChatManagerWorkspace.tsx#L158), and [`ChatManagerWorkspace.tsx`](../../src/components/chat-manager/ChatManagerWorkspace.tsx#L478).
- This review did not connect to the deployed stream, so actual delivery latency, listener health, and reconnect behavior remain **NOT VERIFIED**.
- The new connection policy and focused test are in [`connection-policy.ts`](../../src/services/chat/connection-policy.ts) and [`connection-policy.test.ts`](../../src/services/chat/connection-policy.test.ts). Messages poll only while the stream is not live; the query interval is 30 seconds and does not run in the background. The conversation-list fallback is 60 seconds.

## File security and UI scan

- The Composer checks each selected file against the shared policy before queueing it. The server also checks the policy in upload preparation and attachment-record creation. See [`Composer.tsx`](../../src/components/chat/user/Composer.tsx#L296), [`file-policy.ts`](../../src/services/chat/file-policy.ts#L1), and [`user-data.functions.ts`](../../src/lib/chat/user-data.functions.ts#L484).
- The policy rejects listed executable filename suffixes (including `.exe` and `.js`) and rejects MIME types outside its explicit allowlist. The server creates short-lived signed upload URLs and five-minute signed download URLs; attachment URL generation checks conversation access. See [`storage.server.ts`](../../src/lib/chat/storage.server.ts#L18) and [`user-data.functions.ts`](../../src/lib/chat/user-data.functions.ts#L944).
- **Limitation:** the name and MIME type are client-provided metadata; file bytes/signatures are not inspected. Renaming or relabeling content is not ruled out by this policy. The deployed bucket's effective visibility and signed URL behavior were not tested.
- Static scans found no “Not implemented” or “Coming soon” labels in the requested chat component folders. The Composer emoji control and MessageList reaction control are wired through `PopoverTrigger`; they are not inert buttons. See [`Composer.tsx`](../../src/components/chat/user/Composer.tsx#L332) and [`MessageList.tsx`](../../src/components/chat/user/MessageList.tsx#L457).

## Validation performed

- `npx.cmd vitest run src/services/chat/connection-policy.test.ts src/services/chat/file-policy.test.ts src/services/chat/cursor-pagination.test.ts` — **PASS**, 3 files / 9 tests.
- `npx.cmd eslint src/hooks/use-chat.ts src/components/chat/user/ChatWorkspace.tsx src/services/chat/connection-policy.ts src/services/chat/connection-policy.test.ts src/services/chat/file-policy.test.ts --rule 'prettier/prettier: off'` — **PASS**.
- `git diff --check` on the changed chat source and test files — **PASS**.
- `npx.cmd tsc --noEmit -p .` — **PASS**, exit code 0.
