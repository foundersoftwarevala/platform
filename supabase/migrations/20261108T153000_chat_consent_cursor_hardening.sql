-- Chat consent, indexed keyset history, and server-only chat writes.
-- Existing canonical conversations/messages/attachments are intentionally reused.
-- Apply after 20261108T152000_assist_system_real.sql.

begin;

create table if not exists public.user_consents (
  event_id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  consent_type text not null
    check (consent_type in ('message_storage', 'ai_review')),
  granted boolean not null,
  policy_version text not null,
  granted_at timestamptz not null default now()
);

create index if not exists user_consents_current_lookup_idx
  on public.user_consents (user_id, consent_type, event_id desc);

alter table public.user_consents enable row level security;
revoke all on public.user_consents from anon, authenticated, service_role;
grant select on public.user_consents to authenticated;
grant select, insert on public.user_consents to service_role;

drop policy if exists "read own chat consent" on public.user_consents;
create policy "read own chat consent" on public.user_consents
  for select to authenticated using (user_id = auth.uid());

create or replace function public.chat_guard_consent_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Chat consent history is append-only';
end;
$$;
revoke all on function public.chat_guard_consent_immutable() from public, anon, authenticated;
drop trigger if exists user_consents_immutable_update on public.user_consents;
create trigger user_consents_immutable_update
  before update or delete on public.user_consents
  for each row execute function public.chat_guard_consent_immutable();
drop trigger if exists user_consents_immutable_truncate on public.user_consents;
create trigger user_consents_immutable_truncate
  before truncate on public.user_consents
  for each statement execute function public.chat_guard_consent_immutable();

create or replace function public.has_current_chat_consent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select c.granted and c.policy_version = 'chat-policy-2026-10-21-v1'
      from public.user_consents c
    where c.user_id = auth.uid() and c.consent_type = 'message_storage'
     order by c.event_id desc limit 1
  ), false)
  and coalesce((
    select c.granted and c.policy_version = 'chat-policy-2026-10-21-v1'
      from public.user_consents c
    where c.user_id = auth.uid() and c.consent_type = 'ai_review'
     order by c.event_id desc limit 1
  ), false)
$$;
revoke all on function public.has_current_chat_consent() from public, anon;
grant execute on function public.has_current_chat_consent() to authenticated, service_role;

create index if not exists conversation_participants_user_conversation_idx
  on public.conversation_participants (user_id, conversation_id);
create index if not exists messages_conversation_cursor_idx
  on public.messages (conversation_id, created_at desc, id desc);
create index if not exists message_receipts_user_message_idx
  on public.message_receipts (user_id, message_id);

-- Chat mutations are performed through authenticated server functions running
-- as service_role after verifying the caller and consent. Browser clients get
-- no direct DML privilege, even where an older permissive policy remains.
revoke insert, update, delete, truncate on public.conversations from anon, authenticated;
revoke insert, update, delete, truncate on public.conversation_participants from anon, authenticated;
revoke insert, update, delete, truncate on public.messages from anon, authenticated;
revoke insert, update, delete, truncate on public.message_attachments from anon, authenticated;
revoke insert, update, delete, truncate on public.message_receipts from anon, authenticated;
revoke insert, update, delete, truncate on public.message_mentions from anon, authenticated;
revoke insert, update, delete, truncate on public.message_reactions from anon, authenticated;
revoke insert, update, delete, truncate on public.message_bookmarks from anon, authenticated;
revoke insert, update, delete, truncate on public.chat_message_moderation from anon, authenticated;
revoke insert, update, delete, truncate on public.chat_handoffs from anon, authenticated;
revoke insert, update, delete, truncate on public.chat_message_translations from anon, authenticated;
revoke insert, update, delete, truncate on public.chat_ai_events from anon, authenticated;
revoke insert, update, delete, truncate on public.chat_conversation_links from anon, authenticated;

-- Direct reads are also consent-gated. The authenticated server functions
-- perform their own caller checks and run as service_role.
drop policy if exists "chat managers read conversations" on public.conversations;
drop policy if exists "chat managers read participants" on public.conversation_participants;
drop policy if exists "chat managers read messages" on public.messages;
drop policy if exists "chat managers read attachments" on public.message_attachments;

drop policy if exists "participants read conversations" on public.conversations;
create policy "participants read conversations" on public.conversations
  for select to authenticated
  using (
    public.has_current_chat_consent()
    and (public.is_participant(id, auth.uid()) or created_by = auth.uid())
  );

drop policy if exists "read own conversation memberships" on public.conversation_participants;
drop policy if exists "read participants" on public.conversation_participants;
create policy "read own conversation memberships" on public.conversation_participants
  for select to authenticated
  using (
    public.has_current_chat_consent()
    and (user_id = auth.uid() or public.is_participant(conversation_id, auth.uid()))
  );

drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages" on public.messages
  for select to authenticated
  using (
    public.has_current_chat_consent()
    and public.is_participant(conversation_id, auth.uid())
  );

drop policy if exists "read mentions in own conversations" on public.message_mentions;
drop policy if exists "participants read mentions" on public.message_mentions;
create policy "read mentions in own conversations" on public.message_mentions
  for select to authenticated
  using (
    public.has_current_chat_consent()
    and exists (
      select 1 from public.messages m
       where m.id = message_id and public.is_participant(m.conversation_id, auth.uid())
    )
  );

drop policy if exists "participants read attachments" on public.message_attachments;
create policy "participants read attachments" on public.message_attachments
  for select to authenticated
  using (
    public.has_current_chat_consent()
    and public.is_participant(conversation_id, auth.uid())
  );

drop policy if exists "participants read reactions" on public.message_reactions;
create policy "participants read reactions" on public.message_reactions
  for select to authenticated
  using (
    public.has_current_chat_consent()
    and exists (
      select 1 from public.messages m
       where m.id = message_id and public.is_participant(m.conversation_id, auth.uid())
    )
  );

drop policy if exists "participants read receipts" on public.message_receipts;
create policy "participants read receipts" on public.message_receipts
  for select to authenticated
  using (
    public.has_current_chat_consent()
    and exists (
      select 1 from public.messages m
       where m.id = message_id and public.is_participant(m.conversation_id, auth.uid())
    )
  );

drop policy if exists "own bookmarks" on public.message_bookmarks;
create policy "own bookmarks" on public.message_bookmarks
  for all to authenticated
  using (
    public.has_current_chat_consent()
    and user_id = auth.uid()
  )
  with check (
    public.has_current_chat_consent()
    and user_id = auth.uid()
    and exists (
      select 1 from public.messages m
       where m.id = message_id and public.is_participant(m.conversation_id, auth.uid())
    )
  );

drop policy if exists "participants read chat files" on storage.objects;
drop policy if exists "chat files readable by conversation participants" on storage.objects;
drop policy if exists "chat files uploadable by conversation participants" on storage.objects;
drop policy if exists "chat files removable by uploader" on storage.objects;
create policy "participants read chat files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-files'
    and public.has_current_chat_consent()
    and public.is_participant(((storage.foldername(name))[1])::uuid, auth.uid())
  );

drop policy if exists "participants and managers read moderation" on public.chat_message_moderation;
create policy "participants and managers read moderation" on public.chat_message_moderation
  for select to authenticated
  using (
    public.has_current_chat_consent()
    and (
      public.is_participant(conversation_id, auth.uid())
      or public.has_permission(auth.uid(), 'chat.manage')
    )
  );

drop policy if exists "participants read translations" on public.chat_message_translations;
create policy "participants read translations" on public.chat_message_translations
  for select to authenticated
  using (
    public.has_current_chat_consent()
    and (
      public.has_permission(auth.uid(), 'chat.manage')
      or (
        public.is_participant(conversation_id, auth.uid())
        and not exists (
          select 1 from public.chat_message_moderation mm
           where mm.message_id = chat_message_translations.message_id
        )
      )
    )
  );

drop policy if exists "read own or managed handoffs" on public.chat_handoffs;
create policy "read own or managed handoffs" on public.chat_handoffs
  for select to authenticated
  using (
    public.has_current_chat_consent()
    and (
      requested_by = auth.uid()
      or public.is_participant(conversation_id, auth.uid())
      or public.has_permission(auth.uid(), 'chat.manage')
    )
  );

drop policy if exists "chat managers read ai events" on public.chat_ai_events;
create policy "chat managers read ai events" on public.chat_ai_events
  for select to authenticated
  using (
    public.has_current_chat_consent()
    and public.has_permission(auth.uid(), 'chat.manage')
  );

drop policy if exists "handlers read conversation links" on public.chat_conversation_links;
create policy "handlers read conversation links" on public.chat_conversation_links
  for select to authenticated
  using (
    public.has_current_chat_consent()
    and (
      public.has_permission(auth.uid(), 'chat.manage')
      or (
        public.has_permission(auth.uid(), 'conversation.manage')
        and public.is_participant(conversation_id, auth.uid())
      )
    )
  );

-- Browser clients have no direct message write policy; authenticated server
-- functions enforce caller, participation, and consent checks before writing.
drop policy if exists "participants send messages" on public.messages;

drop trigger if exists messages_immutable_truncate on public.messages;
create trigger messages_immutable_truncate
  before truncate on public.messages
  for each statement execute function public.block_message_mutation();

commit;
