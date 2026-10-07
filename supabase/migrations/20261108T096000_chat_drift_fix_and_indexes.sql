-- Connect Chat: drift fix, constraints, indexes and retry-safety (non-destructive).
--
-- Found on the VPS (sv_platform): anon and authenticated hold UPDATE, DELETE and
-- TRUNCATE (and TRIGGER, REFERENCES) on the chat tables, which the repository's
-- own migrations never granted. RLS and the immutability triggers stop most
-- misuse, but TRUNCATE ignores RLS and a grant that the migrations do not
-- declare will not survive a rebuild. This migration removes grants that no
-- policy or code path uses. Grants that policies rely on are kept:
--   conversations UPDATE (chat managers), conversation_participants DELETE
--   (chat.assign), message_reactions / message_bookmarks DELETE (own rows).
--
-- Also: the allowed values of conversations.status / priority are written down
-- as CHECK constraints (added NOT VALID then validated; if existing data
-- disagrees the constraint stays unvalidated and a NOTICE says so), the indexes
-- the Chat Manager's cursor pagination needs, and one pending handoff per
-- conversation so a retried request cannot queue the same escalation twice.
--
-- Rollback: grants can be re-issued with GRANT; constraints and indexes are
-- dropped by name (conversations_status_check, conversations_priority_check,
-- messages_conversation_cursor_idx, conversations_activity_idx,
-- conversations_status_activity_idx, chat_handoffs_one_pending_idx).

begin;

do $$
declare
  t text;
begin
  foreach t in array array[
    'conversations', 'conversation_participants', 'messages', 'message_attachments',
    'message_reactions', 'message_receipts', 'message_mentions', 'message_bookmarks', 'chat_handoffs'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on public.%I from anon', t);
      execute format('revoke truncate, references, trigger on public.%I from authenticated', t);
    end if;
  end loop;

  foreach t in array array['conversations', 'messages', 'message_attachments', 'chat_handoffs', 'message_mentions', 'message_receipts'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke delete on public.%I from authenticated', t);
    end if;
  end loop;

  -- A message is never edited: no table grant, not just a trigger.
  revoke update on public.messages from authenticated;
end $$;

-- ------------------------------------------------------------- constraints
alter table public.conversations drop constraint if exists conversations_status_check;
alter table public.conversations
  add constraint conversations_status_check
  check (status in ('open', 'pending', 'escalated', 'resolved', 'closed')) not valid;
alter table public.conversations drop constraint if exists conversations_priority_check;
alter table public.conversations
  add constraint conversations_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent')) not valid;

do $$
begin
  begin
    alter table public.conversations validate constraint conversations_status_check;
  exception when others then
    raise notice 'conversations_status_check left NOT VALID: %', sqlerrm;
  end;
  begin
    alter table public.conversations validate constraint conversations_priority_check;
  exception when others then
    raise notice 'conversations_priority_check left NOT VALID: %', sqlerrm;
  end;
end $$;

-- ----------------------------------------------------------------- indexes
create index if not exists messages_conversation_cursor_idx
  on public.messages (conversation_id, created_at desc, id desc);
create index if not exists conversations_activity_idx
  on public.conversations (last_message_at desc, id desc);
create index if not exists conversations_status_activity_idx
  on public.conversations (status, last_message_at desc);

-- One pending handoff per conversation (skipped, with a notice, if duplicates exist).
do $$
begin
  if exists (
    select 1 from public.chat_handoffs where status = 'pending'
    group by conversation_id having count(*) > 1
  ) then
    raise notice 'chat_handoffs_one_pending_idx not created: duplicate pending handoffs exist';
  else
    create unique index if not exists chat_handoffs_one_pending_idx
      on public.chat_handoffs (conversation_id) where status = 'pending';
  end if;
end $$;

commit;
