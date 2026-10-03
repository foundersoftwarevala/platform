-- Indexes for the reads the developer dashboard, Dev Manager and chat make on
-- every page load (plans read on sv_platform, 2026-10-02):
--
-- * chat inbox: conversation_participants is filtered by user_id, but its key
--   is (conversation_id, user_id), so every inbox load and every RLS check on
--   messages scanned the table (550,987 sequential scans so far).
-- * developer dashboard Code Submission: developer_id = ? order by created_at
--   desc - sequential scan and sort.
-- * Dev Manager Audit Logs: entity_type filter (equality and the
--   'dev_manager.%' prefix) ordered by occurred_at, plus its count - full scans.
-- * Foreign keys read by RLS and joins with no index: messages.sender_id,
--   tm_comments.author_id, tm_time_logs.member_id.
--
-- CONCURRENTLY, so every table stays readable and writable while they build.
-- Run outside a transaction block.

create index concurrently if not exists conversation_participants_user_id_idx
  on public.conversation_participants (user_id);

create index concurrently if not exists developer_code_submissions_developer_created_idx
  on public.developer_code_submissions (developer_id, created_at desc);

create index concurrently if not exists audit_logs_entity_type_occurred_idx
  on public.audit_logs (entity_type text_pattern_ops, occurred_at desc);

create index concurrently if not exists messages_sender_id_idx
  on public.messages (sender_id);

create index concurrently if not exists tm_comments_author_id_idx
  on public.tm_comments (author_id);

create index concurrently if not exists tm_time_logs_member_id_idx
  on public.tm_time_logs (member_id);
