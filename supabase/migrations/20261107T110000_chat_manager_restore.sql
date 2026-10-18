-- Connect Chat and Chat Manager on the platform database: what the original
-- chat migration (20260902035917) defined and this database never received.
--
-- Two chat migrations exist. This database was built from the later one
-- (20260923T120000_connect_chat_tables.sql), which left out the conversation
-- controls, the AI handoff queue, the chat.* permissions and the manager's
-- oversight. Chat Manager (src/lib/chat/manager.functions.ts) and the chat's
-- AI/handoff functions (src/lib/chat/ai.functions.ts) use all of them, so the
-- manager refused every operator and its queries failed. Everything below is
-- taken from the original definitions; nothing is new except the live
-- announcements at the end.
--
-- Live chat: the browser's /realtime socket goes to the hosted project, which
-- never sees this database's writes, so a message never reached the other
-- person until a reload. Chat changes are now announced to each participant
-- on the platform's one live channel (sv_user_notification), the same one the
-- notification bell and AMS recognition use.

begin;

-- ---------------------------------------------------------------- conversation controls

alter table public.conversations
  add column if not exists department text,
  add column if not exists category text,
  add column if not exists priority text not null default 'normal',
  add column if not exists status text not null default 'open',
  add column if not exists ai_enabled boolean not null default false,
  add column if not exists assigned_agent_id uuid references auth.users(id) on delete set null;

-- ---------------------------------------------------------------- AI handoff queue

create table if not exists public.chat_handoffs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  reason text,
  status text not null default 'pending',
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
revoke all on public.chat_handoffs from anon;
grant select, insert, update on public.chat_handoffs to authenticated;
grant all on public.chat_handoffs to service_role;
alter table public.chat_handoffs enable row level security;
drop policy if exists "read own or managed handoffs" on public.chat_handoffs;
create policy "read own or managed handoffs" on public.chat_handoffs for select to authenticated
  using (requested_by = auth.uid() or public.is_participant(conversation_id, auth.uid())
         or public.has_permission(auth.uid(), 'chat.manage'));
drop policy if exists "request handoff" on public.chat_handoffs;
create policy "request handoff" on public.chat_handoffs for insert to authenticated
  with check (requested_by = auth.uid() and public.is_participant(conversation_id, auth.uid()));
drop policy if exists "resolve handoff" on public.chat_handoffs;
create policy "resolve handoff" on public.chat_handoffs for update to authenticated
  using (public.has_permission(auth.uid(), 'chat.assign'))
  with check (public.has_permission(auth.uid(), 'chat.assign'));

-- ---------------------------------------------------------------- manager permissions

insert into public.role_permissions (role, permission)
select r, p from (values ('admin'::public.app_role), ('boss'), ('founder'), ('support')) as roles(r)
cross join (values ('chat.manage'), ('chat.moderate'), ('chat.assign'), ('chat.export')) as perms(p)
on conflict do nothing;

-- ---------------------------------------------------------------- manager oversight
-- The original policies were "participant OR chat.manage/chat.assign". Here the
-- participant half already exists; the manager half is added as its own
-- policy, which PostgreSQL ORs with the rest.

drop policy if exists "chat managers read conversations" on public.conversations;
create policy "chat managers read conversations" on public.conversations for select to authenticated
  using (public.has_permission(auth.uid(), 'chat.manage'));
drop policy if exists "chat managers update conversations" on public.conversations;
create policy "chat managers update conversations" on public.conversations for update to authenticated
  using (public.has_permission(auth.uid(), 'chat.manage'))
  with check (public.has_permission(auth.uid(), 'chat.manage'));

drop policy if exists "chat managers read participants" on public.conversation_participants;
create policy "chat managers read participants" on public.conversation_participants for select to authenticated
  using (public.has_permission(auth.uid(), 'chat.manage'));
drop policy if exists "chat assigners add participants" on public.conversation_participants;
create policy "chat assigners add participants" on public.conversation_participants for insert to authenticated
  with check (public.has_permission(auth.uid(), 'chat.assign'));
drop policy if exists "chat assigners update membership" on public.conversation_participants;
create policy "chat assigners update membership" on public.conversation_participants for update to authenticated
  using (public.has_permission(auth.uid(), 'chat.assign'))
  with check (public.has_permission(auth.uid(), 'chat.assign'));
drop policy if exists "leave conversation" on public.conversation_participants;
create policy "leave conversation" on public.conversation_participants for delete to authenticated
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'chat.assign'));

drop policy if exists "chat managers read messages" on public.messages;
create policy "chat managers read messages" on public.messages for select to authenticated
  using (public.has_permission(auth.uid(), 'chat.manage'));

drop policy if exists "chat managers read attachments" on public.message_attachments;
create policy "chat managers read attachments" on public.message_attachments for select to authenticated
  using (public.has_permission(auth.uid(), 'chat.manage'));

-- ---------------------------------------------------------------- live chat
-- One announcement per participant of the conversation. Only identifiers
-- travel; the chat reads the rest under the reader's own permissions. A
-- failure to announce never fails the write that caused it.

create or replace function public.sv_announce_chat_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  rec            record;
  v_conversation uuid;
  v_event        text;
  v_id           uuid;
  v_leaver       uuid;
  v_sender       uuid;
  r              record;
begin
  begin
    if tg_op = 'DELETE' then rec := old; else rec := new; end if;

    if tg_table_name = 'conversations' then
      v_conversation := rec.id;
      v_id := rec.id;
    elsif tg_table_name in ('message_reactions', 'message_receipts') then
      -- These carry only the message; its conversation is on the message.
      select m.conversation_id into v_conversation from public.messages m where m.id = rec.message_id;
      v_id := rec.message_id;
    else
      v_conversation := rec.conversation_id;
      if tg_table_name in ('messages', 'message_attachments') then v_id := rec.id; end if;
      if tg_table_name = 'messages' then v_sender := rec.sender_id; end if;
      -- Whoever just left still hears that they did.
      if tg_table_name = 'conversation_participants' and tg_op = 'DELETE' then v_leaver := rec.user_id; end if;
    end if;

    if v_conversation is null then
      return null;
    end if;

    v_event := 'chat.' || case tg_table_name
      when 'messages' then 'message'
      when 'message_attachments' then 'attachment'
      when 'message_reactions' then 'reaction'
      when 'message_receipts' then 'receipt'
      when 'conversations' then 'conversation'
      when 'conversation_participants' then 'participants'
      else tg_table_name end;

    for r in
      select p.user_id from public.conversation_participants p where p.conversation_id = v_conversation
      union
      select v_leaver where v_leaver is not null
    loop
      perform pg_notify('sv_user_notification', json_build_object(
        'id', v_id, 'user_id', r.user_id, 'event', v_event,
        'conversation_id', v_conversation,
        'sender_id', v_sender)::text);
    end loop;
  exception when others then
    raise warning 'chat change on % not announced: %', tg_table_name, sqlerrm;
  end;
  return null;
end $$;

revoke all on function public.sv_announce_chat_change() from public, anon, authenticated;

drop trigger if exists chat_announce on public.messages;
create trigger chat_announce after insert on public.messages
  for each row execute function public.sv_announce_chat_change();
drop trigger if exists chat_announce on public.message_attachments;
create trigger chat_announce after insert on public.message_attachments
  for each row execute function public.sv_announce_chat_change();
drop trigger if exists chat_announce on public.message_reactions;
create trigger chat_announce after insert or delete on public.message_reactions
  for each row execute function public.sv_announce_chat_change();
drop trigger if exists chat_announce on public.message_receipts;
create trigger chat_announce after insert or update on public.message_receipts
  for each row execute function public.sv_announce_chat_change();
drop trigger if exists chat_announce on public.conversations;
create trigger chat_announce after update on public.conversations
  for each row execute function public.sv_announce_chat_change();
drop trigger if exists chat_announce on public.conversation_participants;
create trigger chat_announce after insert or delete on public.conversation_participants
  for each row execute function public.sv_announce_chat_change();

commit;
