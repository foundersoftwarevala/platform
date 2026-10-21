-- Extend the platform's existing notifications table for canonical task events.
-- The existing general-purpose notification columns and non-task policies remain.

DO $phase4_preflight$
BEGIN
  IF to_regclass('public.tasks') IS NULL THEN
    RAISE EXCEPTION 'Phase 4 requires the canonical public.tasks table first';
  END IF;
  IF to_regclass('public.notifications') IS NULL THEN
    RAISE EXCEPTION 'Phase 4 expected the existing public.notifications table';
  END IF;
  IF to_regclass('public.audit_logs') IS NULL
     OR to_regprocedure('public.audit_logs_hash_chain()') IS NULL THEN
    RAISE EXCEPTION 'Phase 4 requires the append-only audit_logs hash-chain foundation';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgrelid = 'public.audit_logs'::regclass
       AND tgname = 'audit_logs_append_only'
       AND tgenabled IN ('O', 'A')
  ) OR NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgrelid = 'public.audit_logs'::regclass
       AND tgname = 'audit_logs_hash_chain'
       AND tgenabled IN ('O', 'A')
  ) THEN
    RAISE EXCEPTION 'Phase 4 requires enabled append-only and hash-chain audit_logs triggers';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgrelid = 'public.tasks'::regclass
       AND tgname = 'tasks_prepare_write'
       AND tgenabled IN ('O', 'A')
  ) OR NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgrelid = 'public.tasks'::regclass
       AND tgname = 'tasks_audit_change'
       AND tgenabled IN ('O', 'A')
  ) THEN
    RAISE EXCEPTION 'Phase 4 requires enabled canonical task transition and audit triggers';
  END IF;
END;
$phase4_preflight$;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz;

CREATE INDEX IF NOT EXISTS tasks_status_deadline_at_idx
  ON public.tasks (status, deadline_at)
  WHERE deadline_at IS NOT NULL;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid;

UPDATE public.notifications
   SET message = coalesce(nullif(body, ''), title)
 WHERE message IS NULL;

ALTER TABLE public.notifications
  ALTER COLUMN message SET NOT NULL;

DO $task_kind_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.notifications'::regclass
       AND conname = 'notifications_task_kind_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_task_kind_check
      CHECK (
        entity_type IS DISTINCT FROM 'task'
        OR kind IN (
          'deadline_warn', 'deadline_overdue', 'payment_due', 'payment_paid',
          'task_assigned', 'task_verified', 'task_rejected'
        )
      );
  END IF;
END;
$task_kind_constraint$;

CREATE INDEX IF NOT EXISTS notifications_user_read_at_idx
  ON public.notifications (user_id, read_at);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx
  ON public.notifications (created_at);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Task notices must be visible only to their recipient. Existing non-task
-- notification visibility remains governed by the platform's existing policy.
DROP POLICY IF EXISTS notifications_task_recipient_only ON public.notifications;
CREATE POLICY notifications_task_recipient_only
  ON public.notifications
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (entity_type IS DISTINCT FROM 'task' OR user_id = auth.uid());

-- Task notices are created and marked read only by trusted server/database code.
DROP POLICY IF EXISTS notifications_task_insert_server_only ON public.notifications;
CREATE POLICY notifications_task_insert_server_only
  ON public.notifications
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (entity_type IS DISTINCT FROM 'task');

DROP POLICY IF EXISTS notifications_task_update_server_only ON public.notifications;
CREATE POLICY notifications_task_update_server_only
  ON public.notifications
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (entity_type IS DISTINCT FROM 'task')
  WITH CHECK (entity_type IS DISTINCT FROM 'task');

DROP POLICY IF EXISTS notifications_task_delete_server_only ON public.notifications;
CREATE POLICY notifications_task_delete_server_only
  ON public.notifications
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (entity_type IS DISTINCT FROM 'task');

CREATE OR REPLACE FUNCTION public.tasks_notify_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
DECLARE
  notification_kind text;
  notification_message text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    notification_kind := 'task_assigned';
    notification_message := 'A task was assigned to you: ' || NEW.title;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'verified' THEN
    notification_kind := 'task_verified';
    notification_message := 'Your task was verified: ' || NEW.title;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'rejected' THEN
    notification_kind := 'task_rejected';
    notification_message := 'Your task needs changes: ' || NEW.title;
  ELSIF NEW.payment_status IS DISTINCT FROM OLD.payment_status
        AND NEW.payment_status = 'due' THEN
    notification_kind := 'payment_due';
    notification_message := 'Payment is due for task: ' || NEW.title;
  ELSIF NEW.payment_status IS DISTINCT FROM OLD.payment_status
        AND NEW.payment_status = 'paid' THEN
    notification_kind := 'payment_paid';
    notification_message := 'Payment was marked paid for task: ' || NEW.title;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id, title, body, kind, data, message, entity_type, entity_id
  ) VALUES (
    NEW.developer_id,
    notification_kind,
    notification_message,
    notification_kind,
    jsonb_build_object('task_id', NEW.id),
    notification_message,
    'task',
    NEW.id
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tasks_notify_changes ON public.tasks;
CREATE TRIGGER tasks_notify_changes
  AFTER INSERT OR UPDATE OF status, payment_status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tasks_notify_changes();

-- The canonical due_at is the seven-day payment SLA. Delivery deadlines have a
-- separate nullable column so in-progress work is never compared with payment due.
CREATE OR REPLACE FUNCTION public.tasks_deadline_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  task_row record;
  event_action text;
  event_kind text;
  event_message text;
  recipient uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(725202611081455::bigint);

  FOR task_row IN
    SELECT t.*
      FROM public.tasks t
     WHERE t.status = 'in_progress'
       AND t.deadline_at IS NOT NULL
       AND (
         t.deadline_at < now()
         OR t.deadline_at BETWEEN now() AND now() + interval '24 hours'
       )
     ORDER BY t.deadline_at, t.id
     FOR UPDATE
  LOOP
    IF task_row.deadline_at < now() THEN
      event_action := 'TASK_DEADLINE_OVERDUE';
      event_kind := 'deadline_overdue';
      event_message := 'Task deadline has passed: ' || task_row.title;
    ELSE
      event_action := 'TASK_DEADLINE_WARNING';
      event_kind := 'deadline_warn';
      event_message := 'Task deadline is within 24 hours: ' || task_row.title;
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM public.audit_logs al
       WHERE al.entity_type = 'task'
         AND al.entity_id = task_row.id::text
         AND al.action = event_action
    ) THEN
      INSERT INTO public.audit_logs (
        actor, actor_id, action, entity_type, entity_id, severity,
        before_state, after_state, before_status, after_status,
        before_payment, after_payment, metadata
      ) VALUES (
        'system', NULL, event_action, 'task', task_row.id::text, 'warning',
        jsonb_build_object('status', task_row.status, 'deadline_at', task_row.deadline_at),
        jsonb_build_object('status', task_row.status, 'deadline_at', task_row.deadline_at),
        task_row.status::text, task_row.status::text,
        task_row.payment_status::text, task_row.payment_status::text,
        jsonb_build_object('source', 'phase4-deadline-cron')
      );

      FOR recipient IN
        SELECT DISTINCT recipients.user_id
          FROM (VALUES
            (task_row.developer_id),
            (task_row.assigned_by),
            (task_row.created_by)
          ) AS recipients(user_id)
         WHERE recipients.user_id IS NOT NULL
      LOOP
        INSERT INTO public.notifications (
          user_id, title, body, kind, data, message, entity_type, entity_id
        ) VALUES (
          recipient,
          event_kind,
          event_message,
          event_kind,
          jsonb_build_object('task_id', task_row.id),
          event_message,
          'task',
          task_row.id
        );
      END LOOP;
    END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.tasks_deadline_alerts() FROM PUBLIC;
DO $service_grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.tasks_deadline_alerts() TO service_role;
  END IF;
END;
$service_grant$;
