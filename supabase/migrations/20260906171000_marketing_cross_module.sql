-- Sections 30 to 39: marketing references the platform, rather than copying it.
--
-- The brief is emphatic about what not to build. Marketing work that needs
-- doing goes to the Task Manager, not to a marketing task table. A genuine
-- delivery commitment becomes a Promise, not a marketing promise table.
-- Notifications go to the platform's notification table. Leads belong to the
-- existing lead system. None of those links existed: every marketing table sat
-- on its own with no foreign key to anything outside the module.
--
-- What is added is the smallest thing that makes the links real - reference
-- columns and the functions that create the work in the module that owns it.
-- Nothing is duplicated, and no marketing record becomes a task or a promise
-- automatically: section 32 is explicit that only real commitments become
-- promises, so both are deliberate calls.

-- ------------------------------------------------------------- references --
alter table public.marketing_campaigns
  add column if not exists task_id uuid,
  add column if not exists promise_id uuid;

alter table public.marketing_creatives
  add column if not exists task_id uuid,
  add column if not exists uploaded_by uuid;

alter table public.marketing_content_items
  add column if not exists task_id uuid,
  add column if not exists author_id uuid;

alter table public.marketing_reports
  add column if not exists promise_id uuid,
  add column if not exists generated_by uuid,
  add column if not exists file_path text;

alter table public.marketing_approvals
  add column if not exists decided_by uuid,
  add column if not exists decided_at timestamptz,
  add column if not exists task_id uuid;

alter table public.marketing_leads
  add column if not exists crm_lead_id uuid,
  add column if not exists assigned_to uuid;

create index if not exists marketing_campaigns_task_idx     on public.marketing_campaigns(task_id);
create index if not exists marketing_campaigns_promise_idx  on public.marketing_campaigns(promise_id);
create index if not exists marketing_creatives_task_idx     on public.marketing_creatives(task_id);
create index if not exists marketing_content_task_idx       on public.marketing_content_items(task_id);
create index if not exists marketing_leads_crm_idx          on public.marketing_leads(crm_lead_id);

-- ------------------------------------------------------- audit completeness --
-- Section 25 lists what an audit event has to carry: who, what, when, where,
-- the entity, the state before and after, the result and the severity, plus
-- something to correlate a request by. The table carried the first half only,
-- so a change could be recorded without any way of saying what it changed.
alter table public.marketing_audit_logs
  add column if not exists actor_role   text,
  add column if not exists actor_id     uuid,
  add column if not exists before_state jsonb,
  add column if not exists after_state  jsonb,
  add column if not exists severity     text not null default 'info',
  add column if not exists result       text not null default 'success',
  add column if not exists request_id   text,
  add column if not exists session_id   text;

create index if not exists marketing_audit_entity_idx
  on public.marketing_audit_logs(entity_type, entity_id);
create index if not exists marketing_audit_created_idx
  on public.marketing_audit_logs(created_at desc);

-- ------------------------------------------------------------ audit trail --
-- One place that writes marketing history, resolving the real actor rather than
-- trusting the caller to name themselves.
create or replace function public.marketing_audit(
  p_action text, p_entity_type text, p_entity_id text default null,
  p_module text default 'marketing', p_before jsonb default null,
  p_after jsonb default null, p_severity text default 'info',
  p_result text default 'success')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id    uuid;
  v_email text;
  v_role  text;
begin
  select u.email into v_email from auth.users u where u.id = auth.uid();
  select ur.role::text into v_role from public.user_roles ur
   where ur.user_id = auth.uid() limit 1;

  insert into public.marketing_audit_logs
    (action, entity_type, entity_id, module, actor, actor_id, actor_role,
     before_state, after_state, severity, result)
  values
    (p_action, p_entity_type, p_entity_id, p_module,
     coalesce(v_email, case when auth.uid() is null then 'system' else 'account' end),
     auth.uid(),
     coalesce(v_role, 'system'),
     p_before, p_after, p_severity, p_result)
  returning id into v_id;

  return v_id;
end;
$$;

-- ------------------------------------------------------ task manager link --
-- Section 30: marketing work that needs doing becomes a Task Manager task, and
-- marketing keeps only the reference.
create or replace function public.marketing_open_task(
  p_entity_type text, p_entity_id uuid, p_title text,
  p_description text default '', p_priority text default 'medium',
  p_deadline timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
  v_task uuid;
begin
  if not public.marketing_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_entity_type not in ('campaign', 'creative', 'content', 'seo', 'approval') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_entity_type');
  end if;

  v_code := 'MKT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.tm_tasks (code, title, description, module, source_reference,
                               status, priority, deadline, category, created_by)
  values (v_code, p_title, coalesce(p_description, ''), 'marketing_manager',
          p_entity_id::text, 'new', p_priority, p_deadline, p_entity_type, auth.uid())
  returning id into v_task;

  -- The reference is stored on the marketing row; the task itself lives in the
  -- Task Manager and is never copied here.
  case p_entity_type
    when 'campaign' then update public.marketing_campaigns    set task_id = v_task where id = p_entity_id;
    when 'creative' then update public.marketing_creatives    set task_id = v_task where id = p_entity_id;
    when 'content'  then update public.marketing_content_items set task_id = v_task where id = p_entity_id;
    when 'approval' then update public.marketing_approvals    set task_id = v_task where id = p_entity_id;
    else null;
  end case;

  perform public.marketing_audit('Task Opened', p_entity_type, p_entity_id::text,
    'marketing', null, jsonb_build_object('task_id', v_task, 'code', v_code));

  return jsonb_build_object('ok', true, 'task_id', v_task, 'code', v_code);
end;
$$;

-- ---------------------------------------------------- promise tracker link --
-- Section 32: only a genuine delivery commitment becomes a promise, so this is
-- an explicit call and never a trigger.
create or replace function public.marketing_make_promise(
  p_entity_type text, p_entity_id uuid, p_title text,
  p_receiver text, p_deadline timestamptz, p_priority text default 'high')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code    text;
  v_promise uuid;
  v_email   text;
begin
  if not public.marketing_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_deadline is null then
    return jsonb_build_object('ok', false, 'reason', 'a promise needs a hard deadline');
  end if;

  select u.email into v_email from auth.users u where u.id = auth.uid();
  v_code := public.pt_next_code();

  insert into public.promises (code, title, owner, receiver, owner_user_id,
                               deadline, priority, status, linked_module,
                               linked_record_id, created_by)
  values (v_code, p_title, coalesce(v_email, 'Marketing'), p_receiver, auth.uid(),
          p_deadline, p_priority, 'active', 'marketing_manager',
          p_entity_id::text, auth.uid())
  returning id into v_promise;

  insert into public.promise_links (promise_id, module, record_id, relation, label, created_by)
  values (v_promise, 'marketing_manager', p_entity_id::text, 'committed_by', p_entity_type, auth.uid())
  on conflict do nothing;

  if p_entity_type = 'campaign' then
    update public.marketing_campaigns set promise_id = v_promise where id = p_entity_id;
  elsif p_entity_type = 'report' then
    update public.marketing_reports set promise_id = v_promise where id = p_entity_id;
  end if;

  perform public.marketing_audit('Promise Created', p_entity_type, p_entity_id::text,
    'marketing', null, jsonb_build_object('promise_id', v_promise, 'code', v_code));

  return jsonb_build_object('ok', true, 'promise_id', v_promise, 'code', v_code);
end;
$$;

-- ------------------------------------------------------------ notifications --
-- Section 29: the platform's own notification table, never a second one.
create or replace function public.marketing_notify(
  p_audience text, p_title text, p_body text, p_kind text default 'marketing',
  p_entity_id text default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
begin
  with targets as (
    select distinct u.id as user_id
    from auth.users u
    where exists (
      select 1 from public.user_roles ur
      where ur.user_id = u.id
        and ur.role::text = any (
          case p_audience
            when 'marketing' then array['admin','boss','founder','super_admin','boss_owner','marketing']
            when 'admin'     then array['admin','boss','founder','super_admin','boss_owner']
            else array['admin','boss','founder','super_admin','boss_owner','marketing']
          end)
    )
  )
  insert into public.notifications (user_id, title, body, kind, data)
  select t.user_id, p_title, p_body, p_kind,
         jsonb_build_object('module', 'marketing_manager', 'entity_id', p_entity_id)
  from targets t;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.marketing_audit(text, text, text, text, jsonb, jsonb, text, text) from public, anon;
revoke all on function public.marketing_open_task(text, uuid, text, text, text, timestamptz) from public, anon;
revoke all on function public.marketing_make_promise(text, uuid, text, text, timestamptz, text) from public, anon;
revoke all on function public.marketing_notify(text, text, text, text, text) from public, anon;
grant execute on function public.marketing_audit(text, text, text, text, jsonb, jsonb, text, text) to authenticated;
grant execute on function public.marketing_open_task(text, uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.marketing_make_promise(text, uuid, text, text, timestamptz, text) to authenticated;
grant execute on function public.marketing_notify(text, text, text, text, text) to authenticated;

-- Corrected after testing against the real API; emitted from the live definition.

CREATE OR REPLACE FUNCTION public.marketing_open_task(p_entity_type text, p_entity_id uuid, p_title text, p_description text DEFAULT ''::text, p_priority text DEFAULT 'medium'::text, p_deadline timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_code   text;
  v_task   uuid;
  v_member uuid;
begin
  if not public.marketing_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_entity_type not in ('campaign', 'creative', 'content', 'seo', 'approval') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_entity_type');
  end if;

  v_code := 'MKT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  select id into v_member from public.tm_members where user_id = auth.uid() limit 1;

  insert into public.tm_tasks (code, title, description, module, source_reference,
                               status, priority, deadline, category, created_by)
  values (v_code, p_title, coalesce(p_description, ''), 'marketing_manager',
          p_entity_id::text, 'new', p_priority, p_deadline, p_entity_type, v_member)
  returning id into v_task;

  -- The reference is stored on the marketing row; the task itself lives in the
  -- Task Manager and is never copied here.
  case p_entity_type
    when 'campaign' then update public.marketing_campaigns    set task_id = v_task where id = p_entity_id;
    when 'creative' then update public.marketing_creatives    set task_id = v_task where id = p_entity_id;
    when 'content'  then update public.marketing_content_items set task_id = v_task where id = p_entity_id;
    when 'approval' then update public.marketing_approvals    set task_id = v_task where id = p_entity_id;
    else null;
  end case;

  perform public.marketing_audit('Task Opened', p_entity_type, p_entity_id::text,
    'marketing', null, jsonb_build_object('task_id', v_task, 'code', v_code));

  return jsonb_build_object('ok', true, 'task_id', v_task, 'code', v_code);
end;
$function$;
