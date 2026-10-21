-- Fresh canonical task store. Legacy task tables remain in place and become
-- read-only; this migration does not copy or rewrite their existing rows.

DO $phase3_preflight$
DECLARE
  missing_columns text[];
  missing_roles text[];
  service_role_bypass boolean;
BEGIN
  SELECT array_agg(required.role_name ORDER BY required.role_name)
    INTO missing_roles
    FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS required(role_name)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_roles WHERE rolname = required.role_name
   );
  IF missing_roles IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 3 requires PostgreSQL roles: %', missing_roles;
  END IF;
  SELECT rolbypassrls
    INTO service_role_bypass
    FROM pg_roles
   WHERE rolname = 'service_role';
  IF NOT service_role_bypass THEN
    RAISE EXCEPTION 'Phase 3 requires service_role to have BYPASSRLS';
  END IF;
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Phase 3 requires auth.users in the platform database';
  END IF;
  IF to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'Phase 3 requires auth.uid() in the platform database';
  END IF;
  IF to_regprocedure('public.tm_is_operator()') IS NULL THEN
    RAISE EXCEPTION 'Phase 3 requires public.tm_is_operator()';
  END IF;
  IF to_regclass('public.developer_tasks') IS NULL
     OR to_regclass('public.tm_tasks') IS NULL THEN
    RAISE EXCEPTION 'Phase 3 requires both legacy task tables';
  END IF;

  SELECT array_agg(required.column_name ORDER BY required.column_name)
    INTO missing_columns
    FROM unnest(ARRAY[
      'actor_id', 'actor', 'action', 'entity_type', 'entity_id',
      'before_state', 'after_state', 'before_status', 'after_status',
      'before_payment', 'after_payment', 'hash', 'occurred_at'
    ]) AS required(column_name)
   WHERE NOT EXISTS (
     SELECT 1
       FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'audit_logs'
        AND c.column_name = required.column_name
   );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION
      'Phase 3 requires the audit_logs foundation migration first; missing columns: %',
      missing_columns;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger t
     WHERE t.tgrelid = 'public.audit_logs'::regclass
       AND t.tgname = 'audit_logs_append_only'
       AND t.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION
      'Phase 3 requires the enabled audit_logs_append_only trigger';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger t
     WHERE t.tgrelid = 'public.audit_logs'::regclass
       AND t.tgname = 'audit_logs_hash_chain'
       AND t.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION
      'Phase 3 requires the enabled audit_logs_hash_chain trigger';
  END IF;
END;
$phase3_preflight$;

DO $task_status_type$
DECLARE
  existing_labels text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'task_status'
  ) THEN
    CREATE TYPE public.task_status AS ENUM (
      'assigned', 'in_progress', 'submitted', 'rejected',
      'verified', 'paid', 'cancelled'
    );
  ELSE
    SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
      INTO existing_labels
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public' AND t.typname = 'task_status';

    IF existing_labels IS DISTINCT FROM ARRAY[
      'assigned', 'in_progress', 'submitted', 'rejected',
      'verified', 'paid', 'cancelled'
    ]::text[] THEN
      RAISE EXCEPTION 'public.task_status exists with unexpected labels: %',
        existing_labels;
    END IF;
  END IF;
END;
$task_status_type$;

DO $task_payment_status_type$
DECLARE
  existing_labels text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'task_payment_status'
  ) THEN
    CREATE TYPE public.task_payment_status AS ENUM (
      'pending', 'verified', 'due', 'paid'
    );
  ELSE
    SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
      INTO existing_labels
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public' AND t.typname = 'task_payment_status';

    IF existing_labels IS DISTINCT FROM ARRAY[
      'pending', 'verified', 'due', 'paid'
    ]::text[] THEN
      RAISE EXCEPTION 'public.task_payment_status exists with unexpected labels: %',
        existing_labels;
    END IF;
  END IF;
END;
$task_payment_status_type$;

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status public.task_status NOT NULL DEFAULT 'assigned',
  payment_status public.task_payment_status NOT NULL DEFAULT 'pending',
  verified_at timestamptz NULL,
  paid_at timestamptz NULL,
  due_at timestamptz NULL,
  priority text,
  artifacts jsonb,
  submission_notes text,
  manager_notes text,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.tasks_prepare_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
DECLARE
  write_time timestamptz := now();
BEGIN
  NEW.updated_at := write_time;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'assigned' THEN
      RAISE EXCEPTION 'A new task must start in assigned status';
    END IF;
    IF NEW.payment_status <> 'pending' THEN
      RAISE EXCEPTION 'A new task must start with pending payment';
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'assigned' AND NEW.status IN ('in_progress', 'cancelled'))
      OR (OLD.status = 'in_progress' AND NEW.status IN ('submitted', 'cancelled'))
      OR (OLD.status = 'submitted' AND NEW.status IN ('verified', 'rejected'))
      OR (OLD.status = 'rejected' AND NEW.status = 'in_progress')
      OR (OLD.status = 'verified' AND NEW.status = 'paid')
    ) THEN
      RAISE EXCEPTION 'Illegal task status transition: % -> %',
        OLD.status, NEW.status;
    END IF;
  END IF;

  IF NEW.status = 'verified' AND NEW.verified_at IS NULL THEN
    NEW.verified_at := write_time;
  END IF;

  IF NEW.verified_at IS NOT NULL THEN
    NEW.due_at := NEW.verified_at + interval '7 days';
  END IF;

  IF NEW.status = 'paid' AND NEW.paid_at IS NULL THEN
    NEW.paid_at := write_time;
  END IF;

  IF NEW.paid_at IS NOT NULL THEN
    IF NEW.status <> 'paid' THEN
      RAISE EXCEPTION 'paid_at can be set only when task status is paid';
    END IF;
    NEW.payment_status := 'paid';
  ELSIF NEW.verified_at IS NOT NULL THEN
    NEW.payment_status := CASE
      WHEN NEW.due_at < write_time THEN 'due'::public.task_payment_status
      ELSE 'verified'::public.task_payment_status
    END;
  ELSE
    NEW.payment_status := 'pending';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tasks_prepare_write ON public.tasks;
CREATE TRIGGER tasks_prepare_write
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tasks_prepare_write();

CREATE OR REPLACE FUNCTION public.tasks_audit_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
DECLARE
  changed_status boolean;
  changed_payment boolean;
  before_row jsonb;
  before_status text;
  before_payment text;
  actor uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    changed_status := true;
    changed_payment := true;
    before_row := NULL;
    before_status := NULL;
    before_payment := NULL;
  ELSE
    changed_status := NEW.status IS DISTINCT FROM OLD.status;
    changed_payment := NEW.payment_status IS DISTINCT FROM OLD.payment_status;
    IF NOT changed_status AND NOT changed_payment THEN
      RETURN NEW;
    END IF;
    before_row := to_jsonb(OLD);
    before_status := OLD.status::text;
    before_payment := OLD.payment_status::text;
  END IF;

  actor := auth.uid();

  INSERT INTO public.audit_logs (
    actor_id,
    actor,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state,
    before_status,
    after_status,
    before_payment,
    after_payment
  ) VALUES (
    actor,
    coalesce(actor::text, 'system'),
    CASE
      WHEN changed_status THEN 'task.status_changed'
      ELSE 'task.payment_changed'
    END,
    'task',
    NEW.id::text,
    before_row,
    to_jsonb(NEW),
    before_status,
    NEW.status::text,
    before_payment,
    NEW.payment_status::text
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tasks_audit_change ON public.tasks;
CREATE TRIGGER tasks_audit_change
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tasks_audit_change();

CREATE INDEX IF NOT EXISTS tasks_developer_status_idx
  ON public.tasks (developer_id, status);
CREATE INDEX IF NOT EXISTS tasks_assigned_by_status_idx
  ON public.tasks (assigned_by, status);
CREATE INDEX IF NOT EXISTS tasks_status_due_at_idx
  ON public.tasks (status, due_at);
CREATE INDEX IF NOT EXISTS tasks_payment_status_verified_at_idx
  ON public.tasks (payment_status, verified_at);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_read_scoped ON public.tasks;
CREATE POLICY tasks_read_scoped
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    developer_id = auth.uid()
    OR assigned_by = auth.uid()
    OR created_by = auth.uid()
    OR public.tm_is_operator()
  );

REVOKE ALL PRIVILEGES ON public.tasks FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tasks TO service_role;

DO $legacy_read_only$
DECLARE
  legacy_table text;
  db_role text;
BEGIN
  FOREACH legacy_table IN ARRAY ARRAY['developer_tasks', 'tm_tasks']
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON public.%I FROM PUBLIC', legacy_table);

    FOREACH db_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
    LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = db_role) THEN
        EXECUTE format(
          'REVOKE ALL PRIVILEGES ON public.%I FROM %I',
          legacy_table,
          db_role
        );
        EXECUTE format(
          'GRANT SELECT ON public.%I TO %I',
          legacy_table,
          db_role
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$legacy_read_only$;
