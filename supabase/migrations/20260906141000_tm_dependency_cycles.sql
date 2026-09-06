-- Section 8: dependencies that cannot close a loop.
--
-- Two tasks each waiting on the other is not a rare mistake - it is what
-- happens when somebody links a task to its own parent - and once created it
-- leaves both permanently unstartable with nothing on screen explaining why.

CREATE OR REPLACE FUNCTION public.tm_dependency_would_cycle(p_task uuid, p_depends_on uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- Does p_depends_on already wait, directly or at any remove, on p_task?
  with recursive chain as (
    select depends_on_task_id as node
    from public.tm_dependencies
    where task_id = p_depends_on
    union
    select d.depends_on_task_id
    from public.tm_dependencies d
    join chain c on d.task_id = c.node
  )
  select p_task = p_depends_on or exists (select 1 from chain where node = p_task);
$function$;

CREATE OR REPLACE FUNCTION public.tm_dependency_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.task_id = new.depends_on_task_id then
    raise exception 'a task cannot depend on itself'
      using errcode = 'check_violation';
  end if;

  if public.tm_dependency_would_cycle(new.task_id, new.depends_on_task_id) then
    raise exception
      'that dependency would close a loop: % already waits on %',
      new.depends_on_task_id, new.task_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tm_task_blockers(p_task_id uuid)
 RETURNS TABLE(dependency_id uuid, blocking_task_id uuid, blocking_code text, blocking_title text, blocking_status text, dependency_type text, resolved boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select d.id,
         t.id,
         t.code,
         t.title,
         t.status,
         d.dependency_type,
         t.status = any (array['completed','approved','closed','cancelled'])
  from public.tm_dependencies d
  join public.tm_tasks t on t.id = d.depends_on_task_id
  where d.task_id = p_task_id
  order by t.status, t.code;
$function$;

drop trigger if exists tm_dependencies_no_cycles on public.tm_dependencies;
CREATE TRIGGER tm_dependencies_no_cycles BEFORE INSERT OR UPDATE ON public.tm_dependencies FOR EACH ROW EXECUTE FUNCTION tm_dependency_guard();
