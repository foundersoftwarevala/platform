-- Atomic Chat Manager operations. These mutate only canonical Chat rows and
-- keep the operator permission checks and audit record in the database.

begin;

insert into public.role_permissions (role, permission)
values
  ('admin', 'chat.permissions.manage'),
  ('boss', 'chat.permissions.manage'),
  ('founder', 'chat.permissions.manage')
on conflict do nothing;

create or replace function public.chat_manager_set_role_permission(
  p_role text,
  p_permission text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'chat.permissions.manage') then
    raise exception 'You do not have permission to manage Chat roles.' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'boss', 'founder', 'developer', 'employee', 'seo', 'marketing', 'sales', 'finance', 'support') then
    raise exception 'Chat permissions can only be assigned to staff roles.';
  end if;
  if p_permission !~ '^chat\.[a-z_]+$' or p_permission = 'chat.permissions.manage' then
    raise exception 'This permission cannot be changed in the Chat role matrix.';
  end if;
  if p_enabled is null then
    raise exception 'A permission state is required.';
  end if;

  if p_enabled then
    insert into public.role_permissions (role, permission)
    values (p_role::public.app_role, p_permission)
    on conflict (role, permission) do nothing;
  else
    delete from public.role_permissions
     where role = p_role::public.app_role and permission = p_permission;
  end if;

  insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
  values (
    auth.uid()::text,
    'chat.permission.changed',
    'role_permission',
    p_role || ':' || p_permission,
    'medium',
    jsonb_build_object('role', p_role, 'permission', p_permission, 'enabled', p_enabled)
  );
end;
$$;
revoke all on function public.chat_manager_set_role_permission(text, text, boolean) from public, anon;
grant execute on function public.chat_manager_set_role_permission(text, text, boolean) to authenticated;

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

  insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
  values (
    auth.uid()::text,
    case when v_previous is null then 'chat.conversation.assigned' else 'chat.conversation.transferred' end,
    'conversation',
    p_conversation::text,
    'low',
    jsonb_build_object('from_assignee', v_previous, 'to_assignee', p_assignee)
  );
end;
$$;
revoke all on function public.chat_manager_set_assignee(uuid, uuid) from public, anon;
grant execute on function public.chat_manager_set_assignee(uuid, uuid) to authenticated;

create or replace function public.chat_manager_update_conversation(
  p_conversation uuid,
  p_status text default null,
  p_priority text default null,
  p_ai_enabled boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.conversations%rowtype;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'chat.manage') then
    raise exception 'You do not have permission to manage chat.' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('open', 'pending', 'escalated', 'closed', 'resolved') then
    raise exception 'Unknown conversation status.';
  end if;
  if p_priority is not null and p_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'Unknown conversation priority.';
  end if;
  if p_status is null and p_priority is null and p_ai_enabled is null then
    raise exception 'No conversation change was provided.';
  end if;

  select * into v_before
    from public.conversations
   where id = p_conversation
   for update;
  if not found then
    raise exception 'Conversation not found.';
  end if;

  update public.conversations
     set status = coalesce(p_status, status),
         priority = coalesce(p_priority, priority),
         ai_enabled = coalesce(p_ai_enabled, ai_enabled)
   where id = p_conversation;

  if p_status is not null and p_status is distinct from v_before.status then
    insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
    values (
      auth.uid()::text, 'chat.conversation.status', 'conversation', p_conversation::text, 'low',
      jsonb_build_object('from', v_before.status, 'to', p_status)
    );
  end if;
  if p_priority is not null and p_priority is distinct from v_before.priority then
    insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
    values (
      auth.uid()::text, 'chat.conversation.priority', 'conversation', p_conversation::text, 'low',
      jsonb_build_object('from', v_before.priority, 'to', p_priority)
    );
  end if;
  if p_ai_enabled is not null and p_ai_enabled is distinct from v_before.ai_enabled then
    insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
    values (
      auth.uid()::text, 'chat.conversation.ai', 'conversation', p_conversation::text, 'low',
      jsonb_build_object('from', v_before.ai_enabled, 'to', p_ai_enabled)
    );
  end if;
end;
$$;
revoke all on function public.chat_manager_update_conversation(uuid, text, text, boolean) from public, anon;
grant execute on function public.chat_manager_update_conversation(uuid, text, text, boolean) to authenticated;

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
  if v_current_status <> 'pending' then
    raise exception 'Only pending handoffs can be actioned.';
  end if;

  update public.chat_handoffs
     set status = p_status,
         assigned_to = auth.uid(),
         resolved_at = case when p_status = 'accepted' then null else now() end
   where id = p_handoff;

  if p_status = 'accepted' then
    update public.conversations
       set assigned_agent_id = auth.uid(),
           ai_enabled = false,
           status = 'open'
     where id = v_conversation;
  end if;

  insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
  values (
    auth.uid()::text,
    'chat.handoff.' || p_status,
    'chat_handoff',
    p_handoff::text,
    'low',
    jsonb_build_object('conversation_id', v_conversation)
  );
end;
$$;
revoke all on function public.chat_manager_resolve_handoff(uuid, text) from public, anon;
grant execute on function public.chat_manager_resolve_handoff(uuid, text) to authenticated;

create or replace function public.chat_manager_set_participant(
  p_conversation uuid,
  p_user uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'chat.assign') then
    raise exception 'You do not have permission to manage chat participants.' using errcode = '42501';
  end if;
  if p_action not in ('add', 'remove') then
    raise exception 'Unknown participant action.';
  end if;
  if not exists (select 1 from public.conversations where id = p_conversation) then
    raise exception 'Conversation not found.';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Participant not found.';
  end if;

  if p_action = 'add' then
    insert into public.conversation_participants (conversation_id, user_id)
    values (p_conversation, p_user)
    on conflict (conversation_id, user_id) do nothing;
  else
    delete from public.conversation_participants
     where conversation_id = p_conversation and user_id = p_user;
  end if;
  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
    values (
      auth.uid()::text,
      'chat.participant.' || p_action,
      'conversation',
      p_conversation::text,
      'medium',
      jsonb_build_object('user_id', p_user)
    );
  end if;
end;
$$;
revoke all on function public.chat_manager_set_participant(uuid, uuid, text) from public, anon;
grant execute on function public.chat_manager_set_participant(uuid, uuid, text) to authenticated;

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
