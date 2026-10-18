# Software Vala Chat Ecosystem — Ledger

One ledger for Chat App + Chat Manager. Each row has one status. Evidence is
the live run of `scripts/ops/chat-ecosystem-e2e.mjs` against
https://softwarevala.net (deployed revision on main, 2026-10-08): **89/89 checks
passed across tests T1–T10**, plus the VPS database checks noted below.

## Architecture (canonical, no duplicates)

- One backend: TanStack server functions in `src/lib/chat/*` → `sv_platform`
  (VPS PostgreSQL) through `withChatPlatformDatabase` / `withChatIdentity`
  (`set local role service_role`, `auth.uid()` = verified token subject).
- One message store: `conversations`, `messages`, `conversation_participants`,
  `message_*`, `chat_message_translations`, `chat_message_moderation`,
  `chat_handoffs`, `chat_ai_events`, `chat_conversation_links`.
- Realtime: database announcements (`sv_announce_chat_change`) →
  `/api/notifications/stream` (participants) + `sv_chat_manager` channel
  (verified Chat managers only). Typing/presence stay on the existing hosted channel.
- AI: existing AI CEO registry (`ai_agents`, `customer_chat` channel) + AI API
  Manager gateway (`aiComplete`, metered in `usage_events`) + `vala-ai` account.
- Translation: existing i18n pipeline; Chat stores detect → English → reader
  language per message; originals never change.
- Files: existing `chat-files` bucket; authorized by the server against the VPS
  conversation; server-signed URLs (`SUPABASE_STORAGE_SERVICE_KEY`).

## Ledger

| ID | Item | Status | Evidence |
|---|---|---|---|
| C-01 | `sv_app` had no Chat privileges (every server function would fail) | FIXED | Owner-approved `grant service_role to sv_app with inherit false, set true` (20261108T099500); verified plain `sv_app` still denied, in-transaction role works |
| C-02 | Chat Manager access query ran outside the role switch | FIXED | `getChatManagerAccess` returns permissions for ADMIN, none for customer |
| C-03 | No Vala AI account on the VPS (AI replies always failed) | FIXED | T3: reply persisted as `vala-ai`, metered OpenAI call (Anthropic 400 → failover) |
| C-04 | AI bot / lead lookups read `auth.users` (not readable by service_role) | FIXED | T3 pass; reads `profiles` |
| C-05 | `JSON.stringify(...)::jsonb` parameters double-encoded (translations, receipts, profiles, mentions, queue filters, audit metadata) | FIXED | T5, T9 read state, T7 queue filter pass |
| C-06 | Attachments authorized by hosted Storage against the hosted DB | FIXED | T6: server-authorized upload, signed download, outsider refused, 25 MB limit |
| C-07 | Server Storage key was VPS-issued; hosted Storage refused it | FIXED | `SUPABASE_STORAGE_SERVICE_KEY` in VPS `.env` (mode 600); T6 pass |
| C-08 | Manager attachment link pointed at the server's loopback gateway | FIXED | T6 "Chat Manager opens the same file" |
| C-09 | Stored translation pipeline not wired to the Chat App | FIXED | T5 both directions, rows stored, transcript shows them |
| C-10 | Managers received no live events for conversations they were not in | FIXED | T1, T9, T10 manager channel |
| C-11 | Moderation/handoff changes not announced live | FIXED | T4 handoff queue live, T8 correction live |
| C-12 | Corrected message original + reason sent to customers | FIXED | T8 customer payload check |
| C-13 | Customers could list all platform profiles | FIXED | T10 directory returns 0 |
| C-14 | Resolved support chat left the customer stuck; duplicate opens | FIXED | setup checks: new conversation after resolution, no duplicates |
| C-15 | Support conversations opened with AI off under customer identity | FIXED | setup: AI on |
| C-16 | Operator reply box never shown (access lacked `message.send`) | FIXED | T2 reply from the Chat Manager UI |
| C-17 | Manager reply/accept/assign did not make the handler a participant | FIXED | T2, T4, T7 |
| C-18 | Accepted handoffs could not be resolved | FIXED | T4 resolve from Handoff Queue, audit trail |
| C-19 | New hosted sign-ups had no VPS account row | FIXED | `chat_mirror_auth_user` on first Chat use |
| C-20 | `scripts/build.mjs` built only the client (deploy refused it) | FIXED | VPS deploy LIVE OK |
| C-21 | Native i18n contract test / demo footer timing test failing | FIXED | full Vitest pass |
| P-01 | No AI agent opened to `customer_chat`; the generic Vala AI answers | OPERATOR DECISION | Chat Manager → AI governance toggles agents; nothing enabled without the owner |
| P-02 | Anthropic API returns HTTP 400 for chat calls; gateway fails over to OpenAI | PRE-EXISTING | `usage_events` (provider account/credit, AI API Manager) |
| P-03 | i18n message catalogue sync error "p_jobs … at most 20000 jobs" | PRE-EXISTING | 1,560 log entries before this deploy, 0 after |
| P-04 | Repo-wide TypeScript errors (Task/Lead Manager generated DB types) | PRE-EXISTING | Chat files: 0 errors |
| P-05 | Older Support Chatbot / Sales Support live-chat tables (`chat_messages`, `chat_sessions`) | OUT-OF-SCOPE | Separate website-widget product; not merged or removed without the owner |
| R-01 | Connect-Hub reference: GIF/stickers, SLA breach policy, backups/integrations screens | OUT-OF-SCOPE | No canonical Software Vala provider/policy; not faked (see REFERENCE_FEATURE_MATRIX.md) |

Rollback of the role grant: `revoke service_role from sv_app;`
