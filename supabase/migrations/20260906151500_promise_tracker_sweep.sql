-- The scheduled side: deadlines, reminders, the escalation ladder and the
-- automatic fines, run on a timer rather than by whoever happens to be looking.
-- Idempotent by construction - reminders are stamped, escalation levels are
-- unique per promise, and a rule may fine a promise once.

CREATE OR REPLACE FUNCTION public.pt_sweep()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s            public.promise_settings%rowtype;
  r            record;
  v_seen       integer := 0;
  v_due_soon   integer := 0;
  v_delayed    integer := 0;
  v_broken     integer := 0;
  v_reminded   integer := 0;
  v_escalated  integer := 0;
  v_fined      integer := 0;
  v_overdue_m  numeric;
  v_level      integer;
  v_target     integer;
  v_rule       public.promise_rules%rowtype;
  v_status     text;   -- r.status is the snapshot taken at the top of the
                       -- loop; this follows what the row actually becomes.
  v_result     jsonb;
begin
  select * into s from public.promise_settings limit 1;
  if s is null then
    return jsonb_build_object('ok', false, 'reason', 'no_settings_row');
  end if;

  for r in
    select * from public.promises
    where status in ('pending','active','due_soon','delayed','broken')
    order by deadline
  loop
    v_seen := v_seen + 1;
    v_status := r.status;
    v_level := coalesce(r.escalation_level, 0);

    -- ---------------------------------------------------------- reminder --
    -- Sent once, in the window before the deadline, and only while there is
    -- still a deadline to meet.
    if s.auto_reminder
       and r.reminded_at is null
       and now() >= r.deadline - make_interval(hours => s.reminder_before_hours)
       and now() < r.deadline then
      update public.promises set reminded_at = now() where id = r.id;
      perform public.pt_notify(r.id, 'owner',
        format('Reminder - %s', r.code),
        format('%s is due %s', r.title, to_char(r.deadline, 'DD Mon YYYY HH24:MI')),
        'promise_reminder');
      perform public.pt_audit('Promise Reminder', r.id,
        format('reminder sent %s hours before the deadline', s.reminder_before_hours),
        null, null, 'promise_tracker', true);
      v_reminded := v_reminded + 1;
    end if;

    -- ------------------------------------------------------- the deadline --
    if now() < r.deadline then
      -- Still in time. Mark it due soon so the board shows what is closing in.
      if r.status in ('pending','active')
         and now() >= r.deadline - make_interval(hours => s.reminder_before_hours) then
        update public.promises
           set status = 'due_soon',
               due_soon_at = coalesce(due_soon_at, now())
         where id = r.id;
        v_status := 'due_soon';
        v_due_soon := v_due_soon + 1;
      end if;
      continue;
    end if;

    -- Past the deadline. How far past, counted the way the business counts it.
    v_overdue_m := public.pt_business_minutes(r.deadline, now());

    if v_status in ('pending','active','due_soon') then
      update public.promises
         set status = 'delayed',
             delay_days = greatest(0, floor(extract(epoch from (now() - r.deadline)) / 86400))::int
       where id = r.id;
      v_status := 'delayed';
      v_delayed := v_delayed + 1;
      perform public.pt_notify(r.id, 'both',
        format('Delayed - %s', r.code),
        format('%s passed its deadline', r.title), 'promise_delayed');
    else
      update public.promises
         set delay_days = greatest(0, floor(extract(epoch from (now() - r.deadline)) / 86400))::int
       where id = r.id;
    end if;

    -- ------------------------------------------------------- escalation ---
    -- Each level is earned by another escalation_delay_hours of working time
    -- spent overdue. Level 1 lands as soon as the deadline passes.
    if s.auto_escalation then
      v_target := least(4, 1 + floor(v_overdue_m / greatest(s.escalation_delay_hours, 1) / 60)::int);
      while v_level < v_target loop
        v_level := v_level + 1;
        v_result := public.pt_escalate(
          r.id, v_level,
          format('%s overdue by %s working hours',
                 r.code, round(v_overdue_m / 60, 1)),
          'system');
        if coalesce((v_result ->> 'ok')::boolean, false)
           and not coalesce((v_result ->> 'already_raised')::boolean, false) then
          v_escalated := v_escalated + 1;
        end if;
      end loop;
    end if;

    -- ------------------------------------------------------------ broken --
    -- A promise is broken once it has run the whole ladder, or once it is past
    -- the configured expiry. Delayed means late; broken means it will not land.
    if v_status = 'delayed'
       and (v_level >= 4
            or now() > r.deadline + make_interval(days => s.promise_expiry_days)) then
      update public.promises
         set status = 'broken',
             breach_reason = coalesce(r.breach_reason,
               case when v_level >= 4 then 'escalation ladder exhausted'
                    else 'past the configured expiry' end)
       where id = r.id;
      v_status := 'broken';
      v_broken := v_broken + 1;
      perform public.pt_notify(r.id, 'admin',
        format('Broken - %s', r.code),
        format('%s was not delivered', r.title), 'promise_broken');
    end if;

    -- -------------------------------------------------------------- fine --
    -- Money last, and only from rules the operator marked auto-apply. A
    -- percentage fine needs something to take a percentage of; where there is
    -- no amount on the promise, pt_apply_fine declines rather than invent one.
    if s.fine_system_enabled then
      for v_rule in
        select * from public.promise_rules
        where kind = 'fine' and is_active and auto_apply
      loop
        if (v_rule.code = 'FR-001' and v_status in ('delayed','broken'))
           or (v_rule.code = 'FR-002' and v_status = 'broken')
           or (v_rule.code = 'FR-004' and r.priority = 'critical' and v_level >= 3) then
          v_result := public.pt_apply_fine(r.id, v_rule.id,
            format('auto-applied by the deadline sweep'), null, 'system');
          if coalesce((v_result ->> 'ok')::boolean, false) then
            v_fined := v_fined + 1;
          end if;
        end if;
      end loop;
    end if;
  end loop;

  -- Housekeeping the source also does, kept here so one schedule covers it.
  delete from public.promise_health_events
   where created_at < now() - make_interval(days => coalesce(s.health_retention_days, 14));

  return jsonb_build_object(
    'ok', true, 'swept_at', now(), 'examined', v_seen,
    'due_soon', v_due_soon, 'delayed', v_delayed, 'broken', v_broken,
    'reminders_sent', v_reminded, 'escalations_raised', v_escalated,
    'fines_applied', v_fined);
end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_prune_health_events()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  delete from public.promise_health_events
   where created_at < now() - make_interval(
     days => coalesce((select health_retention_days from public.promise_settings limit 1), 14));
$function$;
