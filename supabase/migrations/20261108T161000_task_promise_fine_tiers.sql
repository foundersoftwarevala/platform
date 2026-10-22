DO $promise_fine_preflight$
BEGIN
  IF to_regclass('public.task_promises') IS NULL
     OR to_regclass('public.tasks') IS NULL
     OR to_regclass('public.developer_wallets') IS NULL
     OR to_regclass('public.developer_wallet_transactions') IS NULL
     OR to_regclass('public.audit_logs') IS NULL THEN
    RAISE EXCEPTION 'Promise fine tiers require the canonical task, promise, wallet, and audit tables';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'tasks'
       AND column_name = 'amount_cents'
       AND data_type = 'bigint'
  ) THEN
    RAISE EXCEPTION 'Promise fine tiers require public.tasks.amount_cents';
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
    RAISE EXCEPTION 'Promise fine tiers require active append-only and hash-chain audit triggers';
  END IF;
END;
$promise_fine_preflight$;

ALTER TABLE public.task_promises
  ADD COLUMN IF NOT EXISTS fine_percentage numeric(5,2),
  ADD COLUMN IF NOT EXISTS fine_amount numeric(19,2);
ALTER TABLE public.task_promises
  ALTER COLUMN fine_percentage SET DEFAULT 5;

COMMENT ON COLUMN public.task_promises.fine_percentage IS
  'Applied promise-break tier (5, 7, or 10 percent); NULL for legacy rows with no recorded tier.';
COMMENT ON COLUMN public.task_promises.fine_amount IS
  'Applied promise fine in wallet currency units, rounded to the wallet cent amount.';

DO $promise_fine_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.task_promises'::regclass
       AND conname = 'task_promises_fine_percentage_tier'
  ) THEN
    ALTER TABLE public.task_promises
      ADD CONSTRAINT task_promises_fine_percentage_tier
      CHECK (fine_percentage IS NULL OR fine_percentage IN (5, 7, 10));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.task_promises'::regclass
       AND conname = 'task_promises_fine_amount_nonnegative'
  ) THEN
    ALTER TABLE public.task_promises
      ADD CONSTRAINT task_promises_fine_amount_nonnegative
      CHECK (fine_amount IS NULL OR fine_amount >= 0);
  END IF;
END;
$promise_fine_constraints$;

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
    IF (NEW.fine_cents IS DISTINCT FROM OLD.fine_cents
        OR NEW.fine_percentage IS DISTINCT FROM OLD.fine_percentage
        OR NEW.fine_amount IS DISTINCT FROM OLD.fine_amount)
       AND OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'Fine details can change only while a task promise is pending';
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

CREATE OR REPLACE FUNCTION public.task_promise_fine_percentage(
  p_previous_breaks bigint
)
RETURNS numeric(5,2)
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public, pg_catalog
AS $function$
BEGIN
  IF p_previous_breaks < 0 THEN
    RAISE EXCEPTION 'Previous promise breaks cannot be negative';
  END IF;

  RETURN CASE
    WHEN p_previous_breaks = 0 THEN 5
    WHEN p_previous_breaks = 1 THEN 7
    ELSE 10
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.task_promise_fine_cents(
  p_task_amount_cents bigint,
  p_previous_breaks bigint
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public, pg_catalog
AS $function$
BEGIN
  IF p_task_amount_cents <= 0 THEN
    RAISE EXCEPTION 'A positive task amount is required to calculate a promise fine';
  END IF;

  RETURN round(
    p_task_amount_cents::numeric
      * public.task_promise_fine_percentage(p_previous_breaks) / 100
  )::bigint;
END;
$function$;

REVOKE ALL ON FUNCTION public.task_promise_fine_percentage(bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.task_promise_fine_cents(bigint, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.task_promise_fine_percentage(bigint)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.task_promise_fine_cents(bigint, bigint)
  TO service_role;

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
  task_amount_cents bigint;
  previous_breaks bigint;
  applied_percentage numeric(5,2);
  applied_fine_cents bigint;
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

  -- Serialize breaches across different promises for the same developer so
  -- simultaneous deadlines cannot receive the same tier.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('task-promise-fine:' || promise_row.developer_id::text, 0)
  );

  SELECT amount_cents
    INTO task_amount_cents
    FROM public.tasks
   WHERE id = promise_row.task_id;
  IF NOT FOUND OR task_amount_cents IS NULL OR task_amount_cents <= 0 THEN
    RAISE EXCEPTION 'A positive task amount is required to calculate a promise fine';
  END IF;

  SELECT count(*)
    INTO previous_breaks
    FROM public.task_promises
   WHERE developer_id = promise_row.developer_id
     AND status = 'broken';
  applied_percentage := public.task_promise_fine_percentage(previous_breaks);
  applied_fine_cents := public.task_promise_fine_cents(
    task_amount_cents,
    previous_breaks
  );

  UPDATE public.task_promises
     SET status = 'broken',
         break_reason = btrim(p_reason),
         fine_percentage = applied_percentage,
         fine_cents = applied_fine_cents,
         fine_amount = applied_fine_cents::numeric / 100,
         fine_applied_at = CASE
           WHEN applied_fine_cents > 0 THEN now()
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
