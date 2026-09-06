-- Identity, approval, AI actions and the cross-module links.
--
-- Sections 11 and 12 both say not to create duplicate people, so a typed name
-- is matched against the accounts that already exist. Section 6's approval gate
-- was configurable and unread. Section 21's "Apply Suggestion" wrote a log line
-- and did nothing. And sections 8, 9 and 32 want modules linked by reference,
-- never by copying each other's rows.

CREATE OR REPLACE FUNCTION public.pt_resolve_identity(p_needle text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_needle text := lower(trim(coalesce(p_needle, '')));
  v_id     uuid;
begin
  if v_needle = '' then
    return null;
  end if;

  -- An email address is unambiguous, so it is tried first.
  select u.id into v_id from auth.users u where lower(u.email) = v_needle limit 1;
  if v_id is not null then return v_id; end if;

  select p.id into v_id from public.profiles p where lower(p.email) = v_needle limit 1;
  if v_id is not null then return v_id; end if;

  -- Then a full name, but only when it identifies exactly one person. Two
  -- people sharing a name is precisely when guessing would do harm.
  select p.id into v_id
  from public.profiles p
  where lower(p.full_name) = v_needle
  group by p.id
  having count(*) = 1
  limit 1;
  if v_id is not null and (
       select count(*) from public.profiles q where lower(q.full_name) = v_needle) = 1 then
    return v_id;
  end if;

  select p.id into v_id
  from public.profiles p
  where lower(p.username) = v_needle
  limit 1;
  if v_id is not null and (
       select count(*) from public.profiles q where lower(q.username) = v_needle) = 1 then
    return v_id;
  end if;

  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_decide_approval(p_promise_id uuid, p_decision text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  p public.promises%rowtype;
begin
  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_decision');
  end if;

  -- Approving your own promise is not an approval.
  if not (public.pt_is_operator() or public.pt_is_manager()) then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select * into p from public.promises where id = p_promise_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_such_promise');
  end if;
  if p.status <> 'pending_approval' then
    return jsonb_build_object('ok', false, 'reason', 'not_awaiting_approval');
  end if;

  update public.promises
     set status = case when p_decision = 'approved' then 'active' else 'draft' end,
         approval_status = p_decision,
         approved_by = auth.uid(),
         approved_at = now()
   where id = p_promise_id;

  perform public.pt_audit(
    case when p_decision = 'approved' then 'Promise Approved' else 'Promise Rejected' end,
    p_promise_id, p_note, 'pending_approval',
    case when p_decision = 'approved' then 'active' else 'draft' end);

  perform public.pt_notify(p_promise_id, 'owner',
    format('%s - %s', case when p_decision = 'approved' then 'Approved' else 'Sent back' end, p.code),
    coalesce(p_note, p.title), 'promise_approval');

  return jsonb_build_object('ok', true, 'decision', p_decision);
end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_apply_insight(p_insight_id uuid, p_action text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  i        public.promise_ai_insights%rowtype;
  p        public.promises%rowtype;
  v_action text;
  v_level  integer;
  v_result jsonb;
begin
  select * into i from public.promise_ai_insights where id = p_insight_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_such_insight');
  end if;
  if i.state <> 'open' then
    return jsonb_build_object('ok', false, 'reason', 'already_actioned');
  end if;

  select * into p from public.promises where id = i.promise_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_such_promise');
  end if;

  if not (public.pt_is_operator() or public.pt_is_manager()) then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  -- Where the caller does not name an action, take the one the advice implies.
  v_action := coalesce(p_action,
    case
      when i.escalation_advice ilike '%level 4%' or i.escalation_advice ilike '%legal%'
        then 'notify_manager'   -- never escalate straight to legal on advice alone
      when i.escalation_advice ilike '%level%' then 'raise_escalation'
      when i.delay_risk >= 70 then 'notify_manager'
      else 'send_reminder'
    end);

  if v_action not in ('send_reminder', 'notify_manager', 'raise_escalation') then
    return jsonb_build_object('ok', false, 'reason', 'action_not_allowed');
  end if;

  if v_action = 'send_reminder' then
    perform public.pt_notify(p.id, 'owner',
      format('Reminder - %s', p.code),
      coalesce(i.suggested_action, p.title), 'promise_reminder');
    update public.promises set reminded_at = now() where id = p.id;

  elsif v_action = 'notify_manager' then
    perform public.pt_notify(p.id, 'manager',
      format('Attention - %s', p.code),
      format('%s (miss probability %s%%). %s',
             p.title, i.miss_probability, coalesce(i.suggested_action, '')),
      'promise_attention');

  else
    -- One step up the ladder, never a jump to the end of it. pt_escalate
    -- refuses a level already raised, so applying twice cannot double-escalate.
    v_level := least(4, coalesce(p.escalation_level, 0) + 1);
    v_result := public.pt_escalate(p.id, v_level,
      coalesce(i.escalation_advice, 'raised on AI advice'), 'ai_advice');
    if not coalesce((v_result ->> 'ok')::boolean, false) then
      return jsonb_build_object('ok', false, 'reason', v_result ->> 'reason');
    end if;
  end if;

  update public.promise_ai_insights
     set state = 'applied', acted_by = auth.uid(), acted_at = now()
   where id = p_insight_id;

  perform public.pt_audit('AI Suggestion Applied', p.id,
    format('%s: %s', v_action, coalesce(i.suggested_action, '')), 'open', 'applied');

  return jsonb_build_object('ok', true, 'action', v_action);
end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_dismiss_insight(p_insight_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  i public.promise_ai_insights%rowtype;
begin
  select * into i from public.promise_ai_insights where id = p_insight_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_such_insight');
  end if;
  if not (public.pt_is_operator() or public.pt_is_manager()) then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  -- Dismissed, not deleted. Section 21 wants the dismissal on the record too,
  -- and the source removes the row so nobody can later ask who waved it away.
  update public.promise_ai_insights
     set state = 'dismissed', acted_by = auth.uid(), acted_at = now()
   where id = p_insight_id;

  perform public.pt_audit('AI Suggestion Dismissed', i.promise_id,
    coalesce(p_reason, i.suggested_action), 'open', 'dismissed');

  return jsonb_build_object('ok', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_link(p_promise_id uuid, p_module text, p_record_id text, p_relation text DEFAULT 'linked'::text, p_label text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id uuid;
begin
  if not public.pt_can_see_promise(p_promise_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  insert into public.promise_links (promise_id, module, record_id, relation, label, created_by)
  values (p_promise_id, p_module, p_record_id, p_relation, p_label, auth.uid())
  on conflict (promise_id, module, record_id) do update
     set relation = excluded.relation, label = coalesce(excluded.label, promise_links.label)
  returning id into v_id;

  -- The first link is also recorded on the promise itself, which is what
  -- section 32 asks for and what the list screens filter on.
  update public.promises
     set linked_module = coalesce(linked_module, p_module),
         linked_record_id = coalesce(linked_record_id, p_record_id)
   where id = p_promise_id;

  perform public.pt_audit('Promise Linked', p_promise_id,
    format('%s %s (%s)', p_module, p_record_id, p_relation));

  return jsonb_build_object('ok', true, 'link_id', v_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_promises_for(p_module text, p_record_id text)
 RETURNS TABLE(promise_id uuid, code text, title text, status text, priority text, deadline timestamp with time zone, escalation_level integer, owner text, receiver text, fine_amount numeric, tip_amount numeric, relation text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select p.id, p.code, p.title, p.status, p.priority, p.deadline,
         p.escalation_level, p.owner, p.receiver, p.fine_amount, p.tip_amount,
         coalesce(l.relation, 'linked')
  from public.promises p
  left join public.promise_links l
    on l.promise_id = p.id and l.module = p_module and l.record_id = p_record_id
  where (l.id is not null
         or (p.linked_module = p_module and p.linked_record_id = p_record_id))
    and public.pt_can_see_promise(p.id)
  order by p.deadline;
$function$;

CREATE OR REPLACE FUNCTION public.pt_owner_scorecard(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- Every figure is counted from real rows. Where somebody has made no
  -- promises the answer is zero, not a placeholder.
  select jsonb_build_object(
    'user_id', p_user_id,
    'total', count(*),
    'fulfilled', count(*) filter (where status in ('fulfilled','locked')),
    'on_time', count(*) filter (where status in ('fulfilled','locked')
                                  and fulfilled_at is not null
                                  and fulfilled_at <= deadline),
    'late', count(*) filter (where status in ('fulfilled','locked')
                               and fulfilled_at is not null
                               and fulfilled_at > deadline),
    'delayed', count(*) filter (where status = 'delayed'),
    'broken', count(*) filter (where status = 'broken'),
    'open', count(*) filter (where status in ('pending','active','due_soon','pending_approval')),
    'escalations', coalesce(sum(escalation_level), 0),
    'fines_total', coalesce(sum(fine_amount), 0),
    'tips_total', coalesce(sum(tip_amount), 0),
    'sla_rate', case when count(*) filter (where status in ('fulfilled','locked','broken')) = 0
                     then null
                     else round(
                       100.0 * count(*) filter (where status in ('fulfilled','locked')
                                                  and fulfilled_at is not null
                                                  and fulfilled_at <= deadline)
                       / count(*) filter (where status in ('fulfilled','locked','broken')), 1)
                end
  )
  from public.promises
  where owner_user_id = p_user_id;
$function$;

CREATE OR REPLACE FUNCTION public.pt_task_completed(p_task_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  r        record;
  v_closed integer := 0;
begin
  for r in
    select p.id, p.code, p.status
    from public.promises p
    join public.promise_links l on l.promise_id = p.id
    where l.module = 'task_manager'
      and l.record_id = p_task_id::text
      and l.relation = 'delivered_by'
      and p.status in ('pending','active','due_soon','delayed')
  loop
    update public.promises set status = 'fulfilled' where id = r.id;
    perform public.pt_audit('Promise Fulfilled', r.id,
      format('the delivering task %s was completed', p_task_id),
      r.status, 'fulfilled', 'task_manager', true);
    perform public.pt_notify(r.id, 'both',
      format('Fulfilled - %s', r.code),
      'The work this promise was made against has been completed.',
      'promise_fulfilled');
    v_closed := v_closed + 1;
  end loop;

  return jsonb_build_object('ok', true, 'promises_fulfilled', v_closed);
end;
$function$;

CREATE OR REPLACE FUNCTION public.tm_task_completion_to_promises()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  if new.status is distinct from old.status
     and new.status in ('completed', 'approved', 'closed') then
    perform public.pt_task_completed(new.id);
  end if;
  return null;
end;
$function$;

drop trigger if exists tm_tasks_settle_promises on public.tm_tasks;
CREATE TRIGGER tm_tasks_settle_promises AFTER UPDATE OF status ON public.tm_tasks FOR EACH ROW EXECUTE FUNCTION tm_task_completion_to_promises();
