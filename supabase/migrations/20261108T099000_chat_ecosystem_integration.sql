-- Chat ecosystem integration: what the Chat App and Chat Manager need from the
-- canonical sv_platform database to run as one system.
--
-- 1. (The server's database role is a separate decision; see
--    20261108T099500_chat_server_role.sql.)
--
-- 2. Vala AI. AI replies are persisted as messages from one canonical
--    assistant account (handle vala-ai). It never signs in; it exists here, in
--    the database the messages live in.
--
-- 3. Identity mirror. Sign-in is hosted; Chat data is here. An account that
--    signed up after the database moved has no auth.users row here, so every
--    Chat foreign key would refuse it. chat_mirror_auth_user records the
--    verified account (id and email from the server-verified token) once.
--
-- 4. Live delivery. Moderation and handoffs are announced like every other
--    Chat change, and every Chat change is also announced once on the
--    sv_chat_manager channel, which the app server hands only to signed-in
--    Chat managers. Managers see the live queue without being participants.
--
-- 5. Handling. A manager who replies, accepts a handoff or is assigned joins
--    the conversation as its Software Vala handler, so the customer sees who
--    answered and the handler receives the conversation live.
--
-- Reversal: drop the three new triggers and
-- chat_mirror_auth_user; re-run 20261108T098000 for the manager functions and
-- the previous sv_announce_chat_change body. No data is changed or removed.

begin;

-- --------------------------------------------------------- 3. identity mirror
create or replace function public.chat_mirror_auth_user(p_user uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if p_user is null then
    raise exception 'user required';
  end if;
  insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at, updated_at)
  values (
    p_user,
    nullif(btrim(coalesce(p_email, '')), ''),
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    now(),
    now()
  )
  on conflict (id) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;
revoke all on function public.chat_mirror_auth_user(uuid, text) from public, anon, authenticated;
grant execute on function public.chat_mirror_auth_user(uuid, text) to service_role;

-- --------------------------------------------------------------- 2. Vala AI
do $$
declare
  v_bot uuid;
begin
  select id into v_bot from public.profiles where handle = 'vala-ai';
  if v_bot is null then
    select id into v_bot from auth.users where email = 'vala-ai@bot.softwarevala.app';
  end if;
  if v_bot is null then
    v_bot := gen_random_uuid();
    insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at, updated_at)
    values (
      v_bot, 'vala-ai@bot.softwarevala.app', 'authenticated', 'authenticated',
      jsonb_build_object('username', 'vala-ai', 'full_name', 'Vala AI'), now(), now()
    );
  end if;
  insert into public.profiles (id, email, username, full_name)
  values (v_bot, 'vala-ai@bot.softwarevala.app', 'vala-ai', 'Vala AI')
  on conflict (id) do nothing;
  update public.profiles
     set handle = 'vala-ai',
         display_name = 'Vala AI',
         job_title = 'AI Assistant'
   where id = v_bot;
end $$;

-- ---------------------------------------------------------- 4. live delivery
create or replace function public.sv_announce_chat_change()
returns trigger
language plpgsql
security definer
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
    elsif tg_table_name = 'chat_message_moderation' then
      v_conversation := rec.conversation_id;
      v_id := rec.message_id;
    else
      v_conversation := rec.conversation_id;
      if tg_table_name in ('messages', 'message_attachments', 'chat_handoffs') then v_id := rec.id; end if;
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
      when 'chat_message_moderation' then 'moderation'
      when 'chat_handoffs' then 'handoff'
      else tg_table_name end;

    -- Receipts are per reader and frequent; the participants need them, the
    -- managers' queue does not.
    if tg_table_name <> 'chat_handoffs' then
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
    end if;

    if tg_table_name <> 'message_receipts' then
      perform pg_notify('sv_chat_manager', json_build_object(
        'id', v_id, 'event', v_event,
        'conversation_id', v_conversation,
        'sender_id', v_sender)::text);
    end if;
  exception when others then
    raise warning 'chat change on % not announced: %', tg_table_name, sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists chat_announce on public.chat_message_moderation;
create trigger chat_announce after insert or update or delete on public.chat_message_moderation
  for each row execute function public.sv_announce_chat_change();

drop trigger if exists chat_announce on public.chat_handoffs;
create trigger chat_announce after insert or update on public.chat_handoffs
  for each row execute function public.sv_announce_chat_change();

-- A new conversation reaches the managers' queue as soon as it exists.
drop trigger if exists chat_announce_insert on public.conversations;
create trigger chat_announce_insert after insert on public.conversations
  for each row execute function public.sv_announce_chat_change();

-- ---------------------------------------------------------------- 5. handling
create or replace function public.chat_join_as_handler(p_conversation uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_conversation is null or p_user is null then
    return;
  end if;
  insert into public.conversation_participants (conversation_id, user_id, role_label)
  values (p_conversation, p_user, 'Software Vala Support')
  on conflict (conversation_id, user_id) do nothing;
end;
$$;
revoke all on function public.chat_join_as_handler(uuid, uuid) from public, anon, authenticated;
grant execute on function public.chat_join_as_handler(uuid, uuid) to service_role;

create or replace function public.chat_manager_set_assignee(
  p_conversation uuid,
  p_assignee uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous uuid;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'chat.assign') then
    raise exception 'You do not have permission to assign chat.' using errcode = '42501';
  end if;
  if p_assignee is not null and not public.has_permission(p_assignee, 'chat.assign') then
    raise exception 'The selected user cannot handle chat assignments.' using errcode = '42501';
  end if;

  select assigned_agent_id into v_previous
    from public.conversations
   where id = p_conversation
   for update;
  if not found then
    raise exception 'Conversation not found.';
  end if;
  if v_previous is not distinct from p_assignee then
    return;
  end if;

  update public.conversations
     set assigned_agent_id = p_assignee
   where id = p_conversation;

  -- The handler joins the conversation; a previous handler stays a participant
  -- so the history of who answered remains readable to them.
  perform public.chat_join_as_handler(p_conversation, p_assignee);

  insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
  values (
    auth.uid()::text,
    case
      when p_assignee is null then 'chat.conversation.unassigned'
      when v_previous is null then 'chat.conversation.assigned'
      else 'chat.conversation.transferred'
    end,
    'conversation',
    p_conversation::text,
    'low',
    jsonb_build_object('from_assignee', v_previous, 'to_assignee', p_assignee)
  );
end;
$$;
revoke all on function public.chat_manager_set_assignee(uuid, uuid) from public, anon;
grant execute on function public.chat_manager_set_assignee(uuid, uuid) to authenticated;

create or replace function public.chat_manager_resolve_handoff(
  p_handoff uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation uuid;
  v_current_status text;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'chat.assign') then
    raise exception 'You do not have permission to manage handoffs.' using errcode = '42501';
  end if;
  if p_status not in ('accepted', 'resolved', 'rejected') then
    raise exception 'Unknown handoff status.';
  end if;

  select conversation_id, status
    into v_conversation, v_current_status
    from public.chat_handoffs
   where id = p_handoff
   for update;
  if not found then
    raise exception 'Handoff not found.';
  end if;
  -- An accepted handoff is still open work: it is resolved (or rejected) later.
  if v_current_status = 'pending' then
    null;
  elsif v_current_status = 'accepted' and p_status in ('resolved', 'rejected') then
    null;
  else
    raise exception 'This handoff is already %.', v_current_status;
  end if;

  update public.chat_handoffs
     set status = p_status,
         assigned_to = coalesce(assigned_to, auth.uid()),
         resolved_at = case when p_status = 'accepted' then null else now() end
   where id = p_handoff;

  if p_status = 'accepted' then
    update public.conversations
       set assigned_agent_id = auth.uid(),
           ai_enabled = false,
           status = 'open'
     where id = v_conversation;
    perform public.chat_join_as_handler(v_conversation, auth.uid());
  end if;

  insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
  values (
    auth.uid()::text,
    'chat.handoff.' || p_status,
    'chat_handoff',
    p_handoff::text,
    'low',
    jsonb_build_object('conversation_id', v_conversation, 'from', v_current_status)
  );
end;
$$;
revoke all on function public.chat_manager_resolve_handoff(uuid, text) from public, anon;
grant execute on function public.chat_manager_resolve_handoff(uuid, text) to authenticated;

create or replace function public.chat_manager_send_message(
  p_conversation uuid,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject text;
begin
  if auth.uid() is null
     or not public.has_permission(auth.uid(), 'chat.manage')
     or not public.has_permission(auth.uid(), 'message.send') then
    raise exception 'You do not have permission to reply from Chat Manager.' using errcode = '42501';
  end if;
  if p_body is null or length(btrim(p_body)) = 0 or length(p_body) > 12000 then
    raise exception 'A message must contain 1 to 12,000 characters.';
  end if;

  select subject into v_subject
    from public.conversations
   where id = p_conversation and status not in ('closed', 'resolved')
   for update;
  if not found then
    raise exception 'Conversation not found or closed.';
  end if;

  -- Joined first, so the reply is announced to the handler as well.
  perform public.chat_join_as_handler(p_conversation, auth.uid());

  insert into public.messages (
    conversation_id, sender_id, kind, body, client_ref
  ) values (
    p_conversation, auth.uid(), 'text', btrim(p_body), gen_random_uuid()::text
  );

  insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
  values (
    auth.uid()::text,
    'chat.message.operator_sent',
    'conversation',
    p_conversation::text,
    'low',
    jsonb_build_object('subject', v_subject, 'body_length', length(btrim(p_body)))
  );
end;
$$;
revoke all on function public.chat_manager_send_message(uuid, text) from public, anon;
grant execute on function public.chat_manager_send_message(uuid, text) to authenticated;

commit;
