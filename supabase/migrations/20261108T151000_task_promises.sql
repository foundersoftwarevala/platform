-- Canonical task promises are separate from the existing Promise Tracker's
-- public.promises table, whose broader contract and data remain untouched.

DO $phase6_preflight$
BEGIN
  IF to_regclass('public.tasks') IS NULL THEN
    RAISE EXCEPTION 'Phase 6 requires public.tasks';
  END IF;
  IF to_regclass('public.developer_wallets') IS NULL
     OR to_regclass('public.developer_wallet_transactions') IS NULL THEN
    RAISE EXCEPTION 'Phase 6 requires the Phase 5 developer wallet ledger';
  END IF;
  IF to_regclass('public.audit_logs') IS NULL THEN
    RAISE EXCEPTION 'Phase 6 requires public.audit_logs';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.audit_logs'::regclass
       AND tgname = 'audit_logs_append_only'
       AND tgenabled <> 'D'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.audit_logs'::regclass
       AND tgname = 'audit_logs_hash_chain'
       AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'Phase 6 requires active append-only and hash-chain audit_logs triggers';
  END IF;
  IF to_regprocedure('public.pt_is_manager()') IS NULL THEN
    RAISE EXCEPTION 'Phase 6 requires public.pt_is_manager()';
  END IF;
END;
$phase6_preflight$;

CREATE TABLE IF NOT EXISTS public.task_promises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE RESTRICT,
  developer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  promised_at timestamptz NOT NULL DEFAULT now(),
  deadline_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'fulfilled', 'broken')),
  fine_cents bigint NOT NULL DEFAULT 0 CHECK (fine_cents >= 0),
  fine_applied_at timestamptz NULL,
  note text,
  break_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_promises_deadline_after_promise
    CHECK (deadline_at > promised_at),
  CONSTRAINT task_promises_fine_applied_only_when_broken
    CHECK (fine_applied_at IS NULL OR (status = 'broken' AND fine_cents > 0)),
  CONSTRAINT task_promises_broken_reason_required
    CHECK (status <> 'broken' OR break_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS task_promises_developer_status_idx
  ON public.task_promises (developer_id, status);
CREATE INDEX IF NOT EXISTS task_promises_deadline_status_idx
  ON public.task_promises (deadline_at, status);
CREATE INDEX IF NOT EXISTS task_promises_task_idx
  ON public.task_promises (task_id);
CREATE UNIQUE INDEX IF NOT EXISTS task_promises_one_pending_per_task_idx
  ON public.task_promises (task_id)
  WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS developer_wallet_promise_fine_unique_idx
  ON public.developer_wallet_transactions (reference)
  WHERE type = 'fine' AND reference LIKE 'task-promise:%';

CREATE OR REPLACE FUNCTION public.task_promises_prepare_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
DECLARE
  task_developer uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' THEN
      RAISE EXCEPTION 'New task promises must start pending';
    END IF;
    SELECT developer_id INTO task_developer
      FROM public.tasks
     WHERE id = NEW.task_id;
    IF NOT FOUND OR task_developer <> NEW.developer_id THEN
      RAISE EXCEPTION 'Task promise developer must own the canonical task';
    END IF;
  ELSE
    IF NEW.task_id IS DISTINCT FROM OLD.task_id
       OR NEW.developer_id IS DISTINCT FROM OLD.developer_id
       OR NEW.promised_at IS DISTINCT FROM OLD.promised_at
       OR NEW.deadline_at IS DISTINCT FROM OLD.deadline_at
       OR NEW.note IS DISTINCT FROM OLD.note
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Task promise identity and commitment fields are immutable';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
      OLD.status = 'pending' AND NEW.status IN ('fulfilled', 'broken')
    ) THEN
      RAISE EXCEPTION 'Illegal task promise status transition: % -> %', OLD.status, NEW.status;
    END IF;
    IF NEW.fine_cents IS DISTINCT FROM OLD.fine_cents AND OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'Fine amount can change only while a task promise is pending';
    END IF;
    IF NEW.fine_applied_at IS DISTINCT FROM OLD.fine_applied_at
       AND NOT (
         OLD.status = 'pending'
         AND NEW.status = 'broken'
         AND NEW.fine_cents > 0
         AND NEW.fine_applied_at IS NOT NULL
       ) THEN
      RAISE EXCEPTION 'Fine application timestamp is set only when a fine is applied';
    END IF;
    IF NEW.break_reason IS DISTINCT FROM OLD.break_reason
       AND NOT (
         OLD.status = 'pending'
         AND NEW.status = 'broken'
         AND NEW.break_reason IS NOT NULL
         AND length(btrim(NEW.break_reason)) >= 5
       ) THEN
      RAISE EXCEPTION 'A break reason is recorded only with a valid broken transition';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS task_promises_prepare_write ON public.task_promises;
CREATE TRIGGER task_promises_prepare_write
  BEFORE INSERT OR UPDATE ON public.task_promises
  FOR EACH ROW
  EXECUTE FUNCTION public.task_promises_prepare_write();

CREATE OR REPLACE FUNCTION public.task_promises_audit_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
DECLARE
  audit_actor uuid := auth.uid();
  audit_action text;
BEGIN
  IF audit_actor IS NULL THEN
    RAISE EXCEPTION 'Task promise writes require an authenticated audit actor';
  END IF;

  IF TG_OP = 'INSERT' THEN
    audit_action := 'promise.created';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    audit_action := 'promise.status_changed';
  ELSIF NEW.fine_cents IS DISTINCT FROM OLD.fine_cents THEN
    audit_action := 'promise.fine_set';
  ELSE
    audit_action := 'promise.updated';
  END IF;

  INSERT INTO public.audit_logs (
    actor_id, actor, action, entity_type, entity_id, severity,
    before_state, after_state, metadata
  ) VALUES (
    audit_actor,
    audit_actor::text,
    audit_action,
    'task_promise',
    NEW.id::text,
    'info',
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    to_jsonb(NEW),
    jsonb_build_object(
      'task_id', NEW.task_id,
      'developer_id', NEW.developer_id,
      'break_reason', NEW.break_reason
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS task_promises_audit_change ON public.task_promises;
CREATE TRIGGER task_promises_audit_change
  AFTER INSERT OR UPDATE ON public.task_promises
  FOR EACH ROW
  EXECUTE FUNCTION public.task_promises_audit_change();

CREATE OR REPLACE FUNCTION public.task_promises_no_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'Task promise history cannot be deleted';
END;
$function$;

DROP TRIGGER IF EXISTS task_promises_append_only_history ON public.task_promises;
CREATE TRIGGER task_promises_append_only_history
  BEFORE DELETE ON public.task_promises
  FOR EACH ROW
  EXECUTE FUNCTION public.task_promises_no_delete();

CREATE OR REPLACE FUNCTION public.break_task_promise(
  p_promise_id uuid,
  p_reason text
)
RETURNS public.task_promises
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  promise_row public.task_promises;
  wallet_row public.developer_wallets;
  audit_actor uuid := auth.uid();
  is_authorized boolean;
BEGIN
  IF audit_actor IS NULL THEN
    RAISE EXCEPTION 'Breaking a task promise requires an authenticated audit actor';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A task promise break reason of at least 5 characters is required';
  END IF;

  SELECT public.pt_is_manager()
      OR EXISTS (
        SELECT 1
          FROM public.user_roles
         WHERE user_id = audit_actor
           AND role::text = 'finance_manager'
      )
    INTO is_authorized;
  IF NOT is_authorized THEN
    RAISE EXCEPTION 'Breaking a task promise requires a manager or finance role';
  END IF;

  SELECT * INTO promise_row
    FROM public.task_promises
   WHERE id = p_promise_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task promise not found';
  END IF;
  IF promise_row.status IN ('broken', 'fulfilled') THEN
    RETURN promise_row;
  END IF;
  IF promise_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending task promises can be broken';
  END IF;

  UPDATE public.task_promises
     SET status = 'broken',
         break_reason = btrim(p_reason),
         fine_applied_at = CASE
           WHEN promise_row.fine_cents > 0 THEN now()
           ELSE NULL
         END
   WHERE id = promise_row.id
  RETURNING * INTO promise_row;

  IF promise_row.fine_cents > 0 THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.user_roles
       WHERE user_id = promise_row.developer_id
         AND role::text = 'developer'
    ) THEN
      RAISE EXCEPTION 'Task promise owner does not have a developer role';
    END IF;

    INSERT INTO public.developer_wallets (developer_id)
    VALUES (promise_row.developer_id)
    ON CONFLICT (developer_id) DO NOTHING;

    SELECT * INTO wallet_row
      FROM public.developer_wallets
     WHERE developer_id = promise_row.developer_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Developer wallet could not be created';
    END IF;

    INSERT INTO public.developer_wallet_transactions (
      wallet_id, task_id, type, amount_cents, reference, note, created_by
    ) VALUES (
      wallet_row.id,
      promise_row.task_id,
      'fine',
      promise_row.fine_cents,
      'task-promise:' || promise_row.id::text,
      p_reason,
      audit_actor
    )
    ON CONFLICT (reference)
      WHERE type = 'fine' AND reference LIKE 'task-promise:%'
      DO NOTHING;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Task promise fine already has a wallet transaction';
    END IF;
  END IF;

  RETURN promise_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.break_task_promise(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.break_task_promise(uuid, text) TO service_role;

ALTER TABLE public.task_promises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_promises_read_scoped ON public.task_promises;
CREATE POLICY task_promises_read_scoped
  ON public.task_promises
  FOR SELECT
  TO authenticated
  USING (
    developer_id = auth.uid()
    OR public.pt_is_manager()
    OR EXISTS (
      SELECT 1
        FROM public.user_roles
       WHERE user_id = auth.uid()
         AND role::text = 'finance_manager'
    )
  );

REVOKE ALL PRIVILEGES ON public.task_promises FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.task_promises TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.task_promises TO service_role;
