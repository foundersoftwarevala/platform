-- Tell members about a task they can no longer see.
--
-- tm_tasks_read entitles a member to unassigned work and their own work. The
-- moment somebody claims a task from the pool, everyone else stops satisfying
-- that policy, and Realtime will not deliver them the UPDATE - so their cached
-- row keeps its live buzzer and nothing ever corrects it. The database
-- therefore broadcasts the task id, and nothing else, on a topic every signed-in
-- member may hear. Clients re-run their own queries; each sees exactly what it
-- is entitled to, and no row data crosses the channel.

CREATE OR REPLACE FUNCTION public.tm_broadcast_pool_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'realtime', 'pg_temp'
AS $function$
declare
  v_task_id uuid;
begin
  if tg_op = 'DELETE' then
    v_task_id := old.id;
  else
    v_task_id := new.id;
  end if;

  -- Only visibility- and alarm-affecting changes are worth waking clients for.
  if tg_op = 'UPDATE'
     and new.assigned_to is not distinct from old.assigned_to
     and new.status is not distinct from old.status
     and new.buzzer_active is not distinct from old.buzzer_active then
    return null;
  end if;

  begin
    perform realtime.send(
      jsonb_build_object('task_id', v_task_id, 'op', tg_op),
      'pool_changed',
      'tm:pool',
      true
    );
  exception when others then
    -- Never let a notification failure roll back the claim it was announcing.
    raise warning 'tm pool broadcast failed for %: %', v_task_id, sqlerrm;
  end;

  return null;
end;
$function$;

revoke all on function public.tm_broadcast_pool_change() from public;
revoke all on function public.tm_broadcast_pool_change() from anon;
revoke all on function public.tm_broadcast_pool_change() from authenticated;

drop trigger if exists trg_tm_tasks_pool_broadcast on public.tm_tasks;

CREATE TRIGGER trg_tm_tasks_pool_broadcast AFTER INSERT OR DELETE OR UPDATE ON public.tm_tasks FOR EACH ROW EXECUTE FUNCTION tm_broadcast_pool_change();

drop policy if exists tm_pool_broadcast_read on realtime.messages;
create policy tm_pool_broadcast_read
on realtime.messages
for select
to authenticated
using (
  realtime.topic() = 'tm:pool'
  and extension = 'broadcast'
  and exists (select 1 from public.tm_members m where m.user_id = auth.uid())
);
