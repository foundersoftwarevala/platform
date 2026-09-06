-- The Promise Tracker engines: lifecycle, working hours, escalation, money.
--
-- In the source repository these are frontend concerns. A promise becomes
-- "delayed" because a browser compared its deadline to Date.now(), escalation
-- is a number a button increments, and a fine is a column that goes up. All of
-- it stops the moment nobody has the page open, which is exactly when deadlines
-- pass. Section 15 asks for processing that continues regardless, so the rules
-- live in the database where a schedule can drive them.

CREATE OR REPLACE FUNCTION public.pt_is_operator()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- The same operator roles the Control Panel already uses everywhere else.
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin','boss','founder','super_admin','boss_owner')
  );
$function$;

CREATE OR REPLACE FUNCTION public.pt_is_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- Managers may review and escalate their teams' commitments without holding
  -- full Control Panel rights.
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin','boss','founder','super_admin','boss_owner',
                      'employee','sales','support','finance','sales_support_manager')
  );
$function$;

CREATE OR REPLACE FUNCTION public.pt_can_see_promise(p_promise_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.promises p
    where p.id = p_promise_id
      and (
        public.pt_is_operator()
        or public.pt_is_manager()
        or p.owner_user_id = auth.uid()
        or p.receiver_user_id = auth.uid()
        or p.created_by = auth.uid()
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.pt_audit(p_action text, p_promise_id uuid DEFAULT NULL::uuid, p_details text DEFAULT NULL::text, p_old text DEFAULT NULL::text, p_new text DEFAULT NULL::text, p_source text DEFAULT 'promise_tracker'::text, p_system boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id     uuid;
  v_email  text;
  v_role   text;
  v_code   text;
begin
  select u.email into v_email from auth.users u where u.id = auth.uid();
  select ur.role::text into v_role from public.user_roles ur
   where ur.user_id = auth.uid()
   order by case ur.role::text
     when 'boss_owner' then 1 when 'founder' then 2 when 'boss' then 3
     when 'super_admin' then 4 when 'admin' then 5 else 9 end
   limit 1;
  select code into v_code from public.promises where id = p_promise_id;

  insert into public.promise_audit_logs
    (action, promise_id, promise_code, actor, actor_key, actor_user_id,
     actor_role, details, old_value, new_value, source_module, is_system)
  values
    (p_action, p_promise_id, v_code,
     coalesce(v_email, case when auth.uid() is null then 'system' else 'account' end),
     lower(coalesce(v_email, 'system')),
     auth.uid(),
     coalesce(v_role, case when auth.uid() is null then 'System' else 'Member' end),
     p_details, p_old, p_new, p_source,
     p_system or auth.uid() is null)
  returning id into v_id;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_next_code()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- PRM-001 upwards, continuing from whatever already exists.
  select 'PRM-' || lpad((
    coalesce(max(nullif(regexp_replace(code, '^PRM-', ''), '')::int), 0) + 1
  )::text, 3, '0')
  from public.promises
  where code ~ '^PRM-[0-9]+$';
$function$;

CREATE OR REPLACE FUNCTION public.pt_allowed_transitions(p_from text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case p_from
    when 'draft'            then array['pending_approval','pending','active','cancelled']
    when 'pending_approval' then array['active','pending','draft','cancelled']
    when 'pending'          then array['active','due_soon','delayed','fulfilled','cancelled']
    when 'active'           then array['due_soon','delayed','fulfilled','broken','cancelled']
    when 'due_soon'         then array['active','delayed','fulfilled','broken','cancelled']
    when 'delayed'          then array['broken','fulfilled','active','cancelled']
    when 'broken'           then array['fulfilled','delayed','cancelled']
    when 'fulfilled'        then array['locked','active']
    when 'locked'           then array['fulfilled']   -- only via an authorised unlock
    when 'cancelled'        then array[]::text[]
    else array[]::text[]
  end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_enforce_lifecycle()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if not (new.status = any (public.pt_allowed_transitions(old.status))) then
    raise exception
      'invalid promise transition: % cannot become % (allowed: %)',
      old.status, new.status,
      array_to_string(public.pt_allowed_transitions(old.status), ', ')
      using errcode = 'check_violation';
  end if;

  if new.status = 'fulfilled' and new.fulfilled_at is null then
    new.fulfilled_at := now();
  end if;
  if new.status = 'locked' then
    new.is_locked := true;
    if new.locked_at is null then new.locked_at := now(); end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_guard_locked()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if old.is_locked and not public.pt_is_operator() and auth.uid() is not null then
    raise exception 'promise % is locked; an operator must unlock it first', old.code
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_audit_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.status is distinct from old.status then
    perform public.pt_audit('Status Changed', new.id,
      format('%s to %s', old.status, new.status), old.status, new.status);
  end if;
  if new.is_locked is distinct from old.is_locked then
    perform public.pt_audit(
      case when new.is_locked then 'Promise Locked' else 'Promise Unlocked' end,
      new.id, null, old.is_locked::text, new.is_locked::text);
  end if;
  if new.escalation_level is distinct from old.escalation_level then
    perform public.pt_audit('Escalated', new.id, new.escalation_reason,
      old.escalation_level::text, new.escalation_level::text);
  end if;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_audit_is_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  raise exception 'the promise audit log is append-only; % is not permitted', tg_op
    using errcode = 'insufficient_privilege';
end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_business_minutes(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s          public.promise_settings%rowtype;
  v_cursor   timestamptz;
  v_total    numeric := 0;
  v_day_open timestamptz;
  v_day_shut timestamptz;
  v_from     timestamptz := least(p_from, p_to);
  v_to       timestamptz := greatest(p_from, p_to);
  v_guard    integer := 0;
begin
  select * into s from public.promise_settings limit 1;

  -- With working hours switched off, elapsed time is simply elapsed time.
  if s is null or not s.working_hours_only then
    return extract(epoch from (v_to - v_from)) / 60;
  end if;

  v_cursor := date_trunc('day', v_from);
  while v_cursor < v_to and v_guard < 3660 loop
    v_guard := v_guard + 1;
    -- isodow: Monday is 1. The default configuration is Monday to Friday.
    if extract(isodow from v_cursor)::int = any (s.working_days) then
      v_day_open := v_cursor + s.work_start_time::time;
      v_day_shut := v_cursor + s.work_end_time::time;
      v_total := v_total + greatest(
        extract(epoch from (least(v_to, v_day_shut) - greatest(v_from, v_day_open))) / 60, 0);
    end if;
    v_cursor := v_cursor + interval '1 day';
  end loop;

  return v_total;
end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_notify(p_promise_id uuid, p_audience text, p_title text, p_body text, p_kind text DEFAULT 'promise'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  p       public.promises%rowtype;
  v_count integer := 0;
begin
  select * into p from public.promises where id = p_promise_id;
  if not found then return 0; end if;

  with targets as (
    select distinct u.id as user_id
    from auth.users u
    where
      case p_audience
        when 'owner'    then u.id = p.owner_user_id
        when 'receiver' then u.id = p.receiver_user_id
        when 'both'     then u.id in (p.owner_user_id, p.receiver_user_id)
        when 'manager'  then exists (
          select 1 from public.user_roles ur where ur.user_id = u.id
           and ur.role in ('admin','boss','founder','super_admin','boss_owner',
                           'employee','sales','support','finance','sales_support_manager'))
        when 'admin'    then exists (
          select 1 from public.user_roles ur where ur.user_id = u.id
           and ur.role in ('admin','boss','founder','super_admin','boss_owner'))
        when 'legal'    then exists (
          select 1 from public.user_roles ur where ur.user_id = u.id
           and ur.role in ('admin','boss','founder','super_admin','boss_owner'))
        else false
      end
  )
  insert into public.notifications (user_id, title, body, kind, data)
  select t.user_id, p_title, p_body, p_kind,
         jsonb_build_object('promise_id', p.id, 'promise_code', p.code,
                            'module', 'promise_tracker', 'audience', p_audience)
  from targets t;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_escalation_label(p_level integer)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p_level
    when 1 then 'Reminder'
    when 2 then 'Manager Alert'
    when 3 then 'Admin Alert'
    when 4 then 'Legal / Penalty'
    else 'Unknown' end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_escalate(p_promise_id uuid, p_level integer, p_reason text DEFAULT NULL::text, p_raised_by text DEFAULT 'system'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  p         public.promises%rowtype;
  v_label   text;
  v_audience text;
begin
  select * into p from public.promises where id = p_promise_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_such_promise');
  end if;
  if p_level < 1 or p_level > 4 then
    return jsonb_build_object('ok', false, 'reason', 'level_out_of_range');
  end if;

  v_label := public.pt_escalation_label(p_level);
  v_audience := case p_level
    when 1 then 'owner' when 2 then 'manager'
    when 3 then 'admin' else 'legal' end;

  -- Section 14: the same level is never raised twice for one promise. The
  -- unique key does the deciding, so two concurrent sweeps cannot both raise it.
  insert into public.promise_escalations
    (promise_id, level, label, reason, raised_by, raised_by_user_id, notified_audience, status)
  values (p_promise_id, p_level, v_label, p_reason, p_raised_by, auth.uid(), v_audience, 'open')
  on conflict (promise_id, level) do nothing;

  if not found then
    return jsonb_build_object('ok', true, 'already_raised', true, 'level', p_level);
  end if;

  update public.promises
     set escalation_level = greatest(escalation_level, p_level),
         escalated_at = now(),
         escalation_reason = coalesce(p_reason, escalation_reason),
         escalation_status = 'pending'
   where id = p_promise_id;

  -- Section 13: the platform's own notification table, not a second one.
  perform public.pt_notify(
    p_promise_id, v_audience,
    format('%s - %s', v_label, p.code),
    coalesce(p_reason, format('%s reached escalation level %s', p.title, p_level)),
    'promise_escalation');

  perform public.pt_audit('Escalated', p_promise_id,
    format('%s: %s', v_label, coalesce(p_reason, 'no reason recorded')),
    (p.escalation_level)::text, p_level::text, 'promise_tracker', p_raised_by = 'system');

  return jsonb_build_object('ok', true, 'level', p_level, 'label', v_label,
                            'audience', v_audience);
end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_rule_amount(p_rule promise_rules, p_basis numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
AS $function$
  -- A percentage rule with nothing to take a percentage of yields nothing,
  -- rather than quietly falling back to the fixed amount.
  select case p_rule.rule_type
    when 'percentage' then round(coalesce(p_basis, 0) * p_rule.amount / 100.0, 2)
    else round(p_rule.amount, 2)
  end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_rule_amount(p_rule promise_rules, p_basis numeric, p_delay_days integer DEFAULT 0)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
AS $function$
  -- A percentage rule with nothing to take a percentage of yields nothing,
  -- rather than quietly falling back to the fixed amount.
  select case p_rule.rule_type
    when 'percentage' then round(coalesce(p_basis, 0) * p_rule.amount / 100.0, 2)
    when 'per_day'    then round(greatest(coalesce(p_delay_days, 0), 1) * p_rule.amount, 2)
    else round(p_rule.amount, 2)
  end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_apply_fine(p_promise_id uuid, p_rule_id uuid, p_note text DEFAULT NULL::text, p_basis numeric DEFAULT NULL::numeric, p_actor text DEFAULT 'system'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  p        public.promises%rowtype;
  r        public.promise_rules%rowtype;
  s        public.promise_settings%rowtype;
  v_amount numeric;
  v_id     uuid;
begin
  -- Money is an operator decision. These run as SECURITY DEFINER and were
  -- granted to authenticated, so without this any signed-in person could fine
  -- somebody else or release a tip to themselves.
  if auth.uid() is not null and not public.pt_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select * into s from public.promise_settings limit 1;
  if s is not null and not s.fine_system_enabled then
    return jsonb_build_object('ok', false, 'reason', 'fine_system_disabled');
  end if;

  select * into p from public.promises where id = p_promise_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_such_promise'); end if;

  select * into r from public.promise_rules where id = p_rule_id and is_active;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_such_rule'); end if;
  if r.kind <> 'fine' then return jsonb_build_object('ok', false, 'reason', 'not_a_fine_rule'); end if;

  -- One rule fines one promise once.
  if exists (select 1 from public.promise_ledger
             where promise_id = p_promise_id and rule_id = p_rule_id
               and kind = 'fine' and status <> 'reversed') then
    return jsonb_build_object('ok', false, 'reason', 'already_applied');
  end if;

  v_amount := public.pt_rule_amount(r, p_basis, p.delay_days);
  if v_amount <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'nothing_to_charge');
  end if;

  insert into public.promise_ledger
    (promise_id, rule_id, kind, amount, currency, basis, status, actor, actor_user_id, note)
  values (p_promise_id, p_rule_id, 'fine', v_amount, p.currency,
          r.rule_type || case when p_basis is not null then ' of ' || p_basis::text else '' end,
          'applied', p_actor, auth.uid(), coalesce(p_note, r.name))
  returning id into v_id;

  update public.promises
     set fine_amount = (select coalesce(sum(amount), 0) from public.promise_ledger
                        where promise_id = p_promise_id and kind = 'fine' and status = 'applied'),
         fine_status = 'applied'
   where id = p_promise_id;

  perform public.pt_audit('Fine Applied', p_promise_id,
    format('%s: %s %s', r.name, p.currency, v_amount), null, v_amount::text,
    'promise_tracker', p_actor = 'system');

  return jsonb_build_object('ok', true, 'ledger_id', v_id, 'amount', v_amount,
                            'rule', r.name);
end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_release_tip(p_promise_id uuid, p_rule_id uuid, p_note text DEFAULT NULL::text, p_basis numeric DEFAULT NULL::numeric, p_actor text DEFAULT 'system'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  p        public.promises%rowtype;
  r        public.promise_rules%rowtype;
  s        public.promise_settings%rowtype;
  v_amount numeric;
  v_id     uuid;
begin
  -- Money is an operator decision. These run as SECURITY DEFINER and were
  -- granted to authenticated, so without this any signed-in person could fine
  -- somebody else or release a tip to themselves.
  if auth.uid() is not null and not public.pt_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select * into s from public.promise_settings limit 1;
  if s is not null and not s.tip_system_enabled then
    return jsonb_build_object('ok', false, 'reason', 'tip_system_disabled');
  end if;

  select * into p from public.promises where id = p_promise_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_such_promise'); end if;

  select * into r from public.promise_rules where id = p_rule_id and is_active;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_such_rule'); end if;
  if r.kind <> 'tip' then return jsonb_build_object('ok', false, 'reason', 'not_a_tip_rule'); end if;

  if exists (select 1 from public.promise_ledger
             where promise_id = p_promise_id and rule_id = p_rule_id
               and kind = 'tip' and status <> 'reversed') then
    return jsonb_build_object('ok', false, 'reason', 'already_released');
  end if;

  v_amount := public.pt_rule_amount(r, p_basis, p.delay_days);
  if v_amount <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'nothing_to_release');
  end if;

  insert into public.promise_ledger
    (promise_id, rule_id, kind, amount, currency, basis, status, actor, actor_user_id, note)
  values (p_promise_id, p_rule_id, 'tip', v_amount, p.currency,
          r.rule_type || case when p_basis is not null then ' of ' || p_basis::text else '' end,
          'released', p_actor, auth.uid(), coalesce(p_note, r.name))
  returning id into v_id;

  update public.promises
     set tip_amount = (select coalesce(sum(amount), 0) from public.promise_ledger
                       where promise_id = p_promise_id and kind = 'tip' and status = 'released'),
         tip_status = 'released'
   where id = p_promise_id;

  perform public.pt_audit('Tip Released', p_promise_id,
    format('%s: %s %s', r.name, p.currency, v_amount), null, v_amount::text,
    'promise_tracker', p_actor = 'system');

  return jsonb_build_object('ok', true, 'ledger_id', v_id, 'amount', v_amount,
                            'rule', r.name);
end;
$function$;

CREATE OR REPLACE FUNCTION public.pt_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin new.updated_at = now(); return new; end; $function$;

drop trigger if exists promises_audit_status on public.promises;
CREATE TRIGGER promises_audit_status AFTER UPDATE ON public.promises FOR EACH ROW EXECUTE FUNCTION pt_audit_status();

drop trigger if exists promises_enforce_lifecycle on public.promises;
CREATE TRIGGER promises_enforce_lifecycle BEFORE UPDATE ON public.promises FOR EACH ROW EXECUTE FUNCTION pt_enforce_lifecycle();

drop trigger if exists promises_guard_locked on public.promises;
CREATE TRIGGER promises_guard_locked BEFORE UPDATE ON public.promises FOR EACH ROW EXECUTE FUNCTION pt_guard_locked();

drop trigger if exists promises_touch on public.promises;
CREATE TRIGGER promises_touch BEFORE UPDATE ON public.promises FOR EACH ROW EXECUTE FUNCTION pt_touch_updated_at();

drop trigger if exists promise_audit_no_rewrite on public.promise_audit_logs;
CREATE TRIGGER promise_audit_no_rewrite BEFORE DELETE OR UPDATE ON public.promise_audit_logs FOR EACH ROW EXECUTE FUNCTION pt_audit_is_append_only();
