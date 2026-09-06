-- Section 7: candidates with their reasoning, and routing to a role.
--
-- The screens could pick a person from a list. What they could not do is say
-- why that person - role, skill, workload and capacity weighed together. The
-- recommendation stays a recommendation: nothing here assigns anything.

CREATE OR REPLACE FUNCTION public.tm_assignment_candidates(p_task_id uuid)
 RETURNS TABLE(member_id uuid, full_name text, role text, department text, skills text[], open_tasks integer, committed_hours numeric, capacity_hours numeric, load_percent numeric, skill_matches text[], role_matches boolean, available boolean, score numeric, reasons text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_task     public.tm_tasks%rowtype;
  v_needed   text[];
  v_default  numeric;
begin
  select * into v_task from public.tm_tasks where id = p_task_id;
  if not found then
    return;
  end if;

  -- What the work needs: its tags are the closest thing the model has to a
  -- required-skills list, plus its category.
  v_needed := (
    select array(
      select distinct lower(x) from unnest(
        coalesce(v_task.tags, '{}'::text[]) ||
        case when v_task.category is null then '{}'::text[] else array[v_task.category] end
      ) as x
      where x is not null and x <> ''
    )
  );

  select coalesce(nullif(avg(nullif(m.capacity_hours, 0)), 0), 40)
    into v_default
  from public.tm_members m where m.active;

  return query
  with load as (
    select t.assigned_to as member,
           count(*)::int as open_tasks,
           coalesce(sum(coalesce(t.estimated_hours, 0)), 0)::numeric as committed
    from public.tm_tasks t
    where t.assigned_to is not null
      and t.status not in ('completed', 'cancelled', 'closed', 'approved', 'rejected')
    group by t.assigned_to
  ),
  scored as (
    select
      m.id,
      m.full_name,
      m.role,
      m.department,
      m.skills,
      coalesce(l.open_tasks, 0) as open_tasks,
      coalesce(l.committed, 0)  as committed,
      coalesce(nullif(m.capacity_hours, 0), v_default) as capacity,
      (select array(
         select s from unnest(coalesce(m.skills, '{}'::text[])) s
         where lower(s) = any (v_needed)))                      as matched,
      (v_task.assigned_role is null
        or lower(m.role) = lower(v_task.assigned_role))          as role_ok,
      m.active                                                   as is_active
    from public.tm_members m
    left join load l on l.member = m.id
    where m.active
  )
  select
    s.id,
    s.full_name,
    s.role,
    s.department,
    s.skills,
    s.open_tasks,
    round(s.committed, 2),
    round(s.capacity, 2),
    round(least(s.committed / nullif(s.capacity, 0) * 100, 999), 1) as load_percent,
    s.matched,
    s.role_ok,
    s.is_active,
    round(
      -- Routing by role is the strongest signal, then demonstrated skill,
      -- then how much room the person actually has left.
      (case when s.role_ok then 40 else 0 end)
      + least(coalesce(array_length(s.matched, 1), 0) * 15, 30)
      + greatest(0, 30 * (1 - least(s.committed / nullif(s.capacity, 0), 1)))
    , 1) as score,
    (
      array_remove(array[
        case when s.role_ok and v_task.assigned_role is not null
             then format('routed role: %s', s.role) end,
        case when coalesce(array_length(s.matched, 1), 0) > 0
             then format('skills: %s', array_to_string(s.matched, ', ')) end,
        case when s.committed >= s.capacity
             then format('at or over capacity (%s of %sh)', round(s.committed), round(s.capacity))
             else format('%sh of %sh committed', round(s.committed), round(s.capacity)) end,
        case when s.open_tasks = 0 then 'no open work' end
      ], null)
    ) as reasons
  from scored s
  order by score desc, s.committed asc, s.full_name asc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tm_route_task(p_task_id uuid, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_task    public.tm_tasks%rowtype;
  v_matches int;
begin
  if not public.tm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select * into v_task from public.tm_tasks where id = p_task_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_such_task');
  end if;

  select count(*) into v_matches
  from public.tm_members m where m.active and lower(m.role) = lower(p_role);

  update public.tm_tasks
     set assigned_role = p_role,
         status = case
                    when status in ('new', 'routed') and v_matches > 0 then 'available_for_claim'
                    when status = 'new' then 'routed'
                    else status
                  end,
         buzzer_active = case when v_matches > 0 then true else buzzer_active end,
         updated_at = now()
   where id = p_task_id;

  insert into public.tm_activity (task_id, actor_name, actor_role, action, action_type,
                                  from_value, to_value, details)
  values (p_task_id, 'Task Manager', 'system', 'Task routed', 'routing',
          coalesce(v_task.assigned_role, 'unrouted'), p_role,
          format('%s active member(s) hold that role', v_matches));

  return jsonb_build_object('ok', true, 'role', p_role, 'eligible_members', v_matches);
end;
$function$;
