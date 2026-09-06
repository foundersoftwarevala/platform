-- Developer Manager and Task Manager over one set of rows.
--
-- The two modules were built against different tables and each believed it
-- owned the task. Rather than migrate one into the other and lose a working
-- screen, every developer task is mirrored to a canonical tm_tasks row and the
-- two are kept in step by triggers. The recursion guard matters: without it the
-- two triggers would call each other forever on the first write.

alter table public.developer_tasks
  add column if not exists tm_task_id uuid references public.tm_tasks(id);

create index if not exists developer_tasks_tm_task_id_idx
  on public.developer_tasks(tm_task_id);

CREATE OR REPLACE FUNCTION public.tm_status_from_developer(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE lower(coalesce(p,''))
    WHEN 'assigned'    THEN 'assigned'
    WHEN 'accepted'    THEN 'accepted'
    WHEN 'working'     THEN 'in_progress'
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'paused'      THEN 'on_hold'
    WHEN 'on_hold'     THEN 'on_hold'
    WHEN 'blocked'     THEN 'blocked'
    WHEN 'submitted'   THEN 'ai_review'
    WHEN 'review'      THEN 'ai_review'
    WHEN 'testing'     THEN 'testing'
    WHEN 'completed'   THEN 'completed'
    WHEN 'delivered'   THEN 'completed'
    WHEN 'cancelled'   THEN 'cancelled'
    ELSE 'assigned'
  END;
$function$;

CREATE OR REPLACE FUNCTION public.tm_status_to_developer(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE lower(coalesce(p,''))
    WHEN 'new'            THEN 'assigned'
    WHEN 'assigned'       THEN 'assigned'
    WHEN 'accepted'       THEN 'accepted'
    WHEN 'in_progress'    THEN 'working'
    WHEN 'on_hold'        THEN 'paused'
    WHEN 'blocked'        THEN 'blocked'
    WHEN 'ai_review'      THEN 'submitted'
    WHEN 'waiting_client' THEN 'submitted'
    WHEN 'testing'        THEN 'testing'
    WHEN 'completed'      THEN 'completed'
    WHEN 'cancelled'      THEN 'cancelled'
    ELSE 'assigned'
  END;
$function$;

CREATE OR REPLACE FUNCTION public.tm_member_for_developer(p_developer_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.id FROM public.tm_members m
  JOIN public.developers d ON d.user_id = m.user_id
  WHERE d.id = p_developer_id
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.tm_developer_for_member(p_member_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.id FROM public.developers d
  JOIN public.tm_members m ON m.user_id = d.user_id
  WHERE m.id = p_member_id
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.tm_sync_from_developer_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- fired by the other trigger's write; the change is already applied
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.tm_task_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.tm_tasks t
     SET status      = public.tm_status_from_developer(NEW.status),
         progress    = coalesce(NEW.progress_percent, t.progress),
         deadline    = coalesce(NEW.deadline, t.deadline),
         assigned_to = coalesce(public.tm_member_for_developer(NEW.developer_id), t.assigned_to),
         updated_at  = now()
   WHERE t.id = NEW.tm_task_id
     AND (t.status IS DISTINCT FROM public.tm_status_from_developer(NEW.status)
          OR t.progress IS DISTINCT FROM coalesce(NEW.progress_percent, t.progress));
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tm_sync_to_developer_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  UPDATE public.developer_tasks d
     SET status           = public.tm_status_to_developer(NEW.status),
         progress_percent = coalesce(NEW.progress, d.progress_percent),
         deadline         = coalesce(NEW.deadline, d.deadline),
         developer_id     = coalesce(public.tm_developer_for_member(NEW.assigned_to), d.developer_id),
         updated_at       = now()
   WHERE d.tm_task_id = NEW.id
     AND (d.status IS DISTINCT FROM public.tm_status_to_developer(NEW.status)
          OR d.progress_percent IS DISTINCT FROM coalesce(NEW.progress, d.progress_percent));
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tm_open_developer_task(p_title text, p_description text DEFAULT ''::text, p_developer_id uuid DEFAULT NULL::uuid, p_priority text DEFAULT 'medium'::text, p_deadline timestamp with time zone DEFAULT NULL::timestamp with time zone, p_amount numeric DEFAULT NULL::numeric, p_module text DEFAULT 'developer_manager'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task public.tm_tasks%ROWTYPE;
  v_dev  uuid;
  v_code text;
BEGIN
  IF NOT public.tm_is_operator() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  v_code := 'DEV-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8));

  INSERT INTO public.tm_tasks (code, title, description, module, status, priority,
                               deadline, assigned_to, billable, cost, buzzer_active)
  VALUES (v_code, p_title, coalesce(p_description,''), p_module,
          CASE WHEN p_developer_id IS NULL THEN 'new' ELSE 'assigned' END,
          p_priority, p_deadline,
          public.tm_member_for_developer(p_developer_id),
          p_amount IS NOT NULL, coalesce(p_amount, 0),
          p_developer_id IS NULL)
  RETURNING * INTO v_task;

  INSERT INTO public.developer_tasks (title, description, status, priority,
                                      developer_id, deadline, task_amount, tm_task_id)
  VALUES (p_title, coalesce(p_description,''),
          public.tm_status_to_developer(v_task.status), p_priority,
          p_developer_id, p_deadline, p_amount, v_task.id)
  RETURNING id INTO v_dev;

  INSERT INTO public.tm_activity (task_id, actor_name, actor_role, action, action_type, details)
  VALUES (v_task.id, 'developer_manager', 'operator', 'Task opened', 'create',
          'Opened on the canonical engine and mirrored to developer_tasks');

  RETURN jsonb_build_object('ok', true, 'tm_task_id', v_task.id,
                            'developer_task_id', v_dev, 'code', v_code);
END;
$function$;

drop trigger if exists trg_developer_task_to_tm on public.developer_tasks;

drop trigger if exists trg_tm_task_to_developer on public.tm_tasks;

CREATE TRIGGER trg_developer_task_to_tm AFTER UPDATE ON public.developer_tasks FOR EACH ROW EXECUTE FUNCTION tm_sync_from_developer_task();

CREATE TRIGGER trg_tm_task_to_developer AFTER UPDATE ON public.tm_tasks FOR EACH ROW EXECUTE FUNCTION tm_sync_to_developer_task();
