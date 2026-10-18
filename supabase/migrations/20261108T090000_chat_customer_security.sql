-- Connect Chat: customer boundary, message integrity and Chat Manager moderation.
--
-- Chat-only. Everything is additive or tightens an existing Chat policy; the
-- messages table stays append-only for everyone.
--
--  1. Only people who run conversations (conversation.manage / chat.assign /
--     chat.manage) may put anyone but themselves into a conversation. A
--     customer can never add, choose or remove a participant.
--  2. A message always takes the server clock and a person can never post as
--     "ai" or "system": history cannot be back-dated or impersonated.
--  3. A retried send with the same client_ref is the same message.
--  4. Chat Manager "edit / remove" is a recorded moderation layer over the
--     untouched original row (never UPDATE/DELETE on messages).

begin;

-- ------------------------------------------------------------ 1. who runs conversations

create or replace function public.chat_can_run_conversations(_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.has_permission(_user_id, 'conversation.manage')
      or public.has_permission(_user_id, 'chat.assign')
      or public.has_permission(_user_id, 'chat.manage')
$$;
revoke all on function public.chat_can_run_conversations(uuid) from public, anon;
grant execute on function public.chat_can_run_conversations(uuid) to authenticated, service_role;

alter policy "add participants to own conversations" on public.conversation_participants
  with check (
    -- Staff who run conversations: existing members and creators keep adding people.
    (
      public.chat_can_run_conversations(auth.uid())
      and (
        public.is_participant(conversation_id, auth.uid())
        or exists (
          select 1 from public.conversations c
          where c.id = conversation_participants.conversation_id
            and c.created_by = auth.uid()
        )
      )
    )
    -- Everyone else: only themselves, only into a conversation they created.
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.conversations c
        where c.id = conversation_participants.conversation_id
          and c.created_by = auth.uid()
      )
    )
  );

-- Removing a participant is a handler decision, never the customer's.
drop policy if exists "leave conversation" on public.conversation_participants;
create policy "leave conversation" on public.conversation_participants for delete to authenticated
  using (public.has_permission(auth.uid(), 'chat.assign'));
grant delete on public.conversation_participants to authenticated;

-- ------------------------------------------------------------ 2. message integrity

create or replace function public.chat_guard_message_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  -- Server time is the only time. Service-role inserts and migrations are
  -- trusted callers and keep whatever they set (e.g. imported history).
  if auth.uid() is not null then
    new.created_at := now();
    if new.kind in ('ai', 'system') then
      raise exception 'Only the platform can post % messages', new.kind
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists messages_guard_insert on public.messages;
create trigger messages_guard_insert before insert on public.messages
  for each row execute function public.chat_guard_message_insert();

-- ------------------------------------------------------------ 3. idempotent sends
-- A phone that retries over a weak network sends the same client_ref again.
-- Skipped (with a notice) if existing data already contains such duplicates, so
-- the migration never fails on live history.

do $$
begin
  if exists (
    select 1 from public.messages
    where client_ref is not null
    group by conversation_id, sender_id, client_ref
    having count(*) > 1
  ) then
    raise notice 'messages_client_ref_key not created: duplicate (conversation_id, sender_id, client_ref) rows exist';
  else
    create unique index if not exists messages_client_ref_key
      on public.messages (conversation_id, sender_id, client_ref)
      where client_ref is not null;
  end if;
end $$;

-- ------------------------------------------------------------ 4. moderation

create table if not exists public.chat_message_moderation (
  message_id uuid primary key references public.messages(id) on delete restrict,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  action text not null check (action in ('hidden', 'corrected')),
  corrected_body text,
  reason text not null check (length(btrim(reason)) > 0),
  acted_by uuid not null references auth.users(id) on delete restrict,
  acted_at timestamptz not null default now(),
  check ((action = 'corrected') = (corrected_body is not null))
);
create index if not exists chat_message_moderation_conversation_idx
  on public.chat_message_moderation (conversation_id);

alter table public.chat_message_moderation enable row level security;
revoke all on public.chat_message_moderation from anon, authenticated;
grant select on public.chat_message_moderation to authenticated;
grant all on public.chat_message_moderation to service_role;

drop policy if exists "participants and managers read moderation" on public.chat_message_moderation;
create policy "participants and managers read moderation" on public.chat_message_moderation
  for select to authenticated
  using (
    public.is_participant(conversation_id, auth.uid())
    or public.has_permission(auth.uid(), 'chat.manage')
  );

-- The only writer. Records who did what and why; restore removes the overlay,
-- the original message and the audit entries stay.
create or replace function public.chat_moderate_message(
  p_message uuid,
  p_action text,
  p_reason text,
  p_body text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_conversation uuid;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'chat.moderate') then
    raise exception 'You do not have permission to moderate chat.' using errcode = '42501';
  end if;
  if p_action not in ('hidden', 'corrected', 'restored') then
    raise exception 'Unknown moderation action %', p_action;
  end if;
  if p_action <> 'restored' and length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A reason is required.';
  end if;
  if p_action = 'corrected' and length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'The corrected text is required.';
  end if;

  select conversation_id into v_conversation from public.messages where id = p_message;
  if v_conversation is null then
    raise exception 'Message not found.';
  end if;

  if p_action = 'restored' then
    delete from public.chat_message_moderation where message_id = p_message;
  else
    insert into public.chat_message_moderation
      (message_id, conversation_id, action, corrected_body, reason, acted_by)
    values
      (p_message, v_conversation, p_action,
       case when p_action = 'corrected' then p_body end, btrim(p_reason), auth.uid())
    on conflict (message_id) do update
      set action = excluded.action,
          corrected_body = excluded.corrected_body,
          reason = excluded.reason,
          acted_by = excluded.acted_by,
          acted_at = now();
  end if;

  insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
  values (auth.uid()::text, 'chat.message.' || p_action, 'message', p_message::text, 'medium',
          jsonb_build_object('conversation_id', v_conversation, 'reason', nullif(btrim(coalesce(p_reason, '')), '')));
end;
$$;
revoke all on function public.chat_moderate_message(uuid, text, text, text) from public, anon;
grant execute on function public.chat_moderate_message(uuid, text, text, text) to authenticated, service_role;

commit;
