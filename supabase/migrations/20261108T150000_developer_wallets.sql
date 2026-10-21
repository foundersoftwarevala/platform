-- Dedicated developer wallets. The existing public.wallets tables belong to
-- platform/operator finance and have active consumers; do not repurpose them.

DO $phase5_preflight$
BEGIN
  IF to_regclass('public.tasks') IS NULL THEN
    RAISE EXCEPTION 'Phase 5 requires public.tasks from the canonical task migration';
  END IF;
  IF to_regclass('public.audit_logs') IS NULL THEN
    RAISE EXCEPTION 'Phase 5 requires public.audit_logs';
  END IF;
  IF EXISTS (
    SELECT required.column_name, required.data_type
      FROM (VALUES
        ('actor_id', 'uuid'),
        ('actor', 'text'),
        ('action', 'text'),
        ('entity_type', 'text'),
        ('entity_id', 'text'),
        ('severity', 'text'),
        ('before_state', 'jsonb'),
        ('after_state', 'jsonb'),
        ('metadata', 'jsonb'),
        ('hash', 'text')
      ) AS required(column_name, data_type)
      LEFT JOIN information_schema.columns actual
        ON actual.table_schema = 'public'
       AND actual.table_name = 'audit_logs'
       AND actual.column_name = required.column_name
       AND actual.udt_name = required.data_type
     WHERE actual.column_name IS NULL
  ) THEN
    RAISE EXCEPTION 'Phase 5 requires the complete audit_logs state and hash-chain contract';
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
    RAISE EXCEPTION 'Phase 5 requires active append-only and hash-chain audit_logs triggers';
  END IF;
  IF to_regtype('public.app_role') IS NULL THEN
    RAISE EXCEPTION 'Phase 5 requires public.app_role';
  END IF;
END;
$phase5_preflight$;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance_manager';

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS amount_cents bigint;

DO $task_amount_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.tasks'::regclass
       AND conname = 'tasks_amount_cents_positive'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_amount_cents_positive
      CHECK (amount_cents IS NULL OR amount_cents > 0);
  END IF;
END;
$task_amount_constraint$;

CREATE TABLE IF NOT EXISTS public.developer_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL UNIQUE,
  balance_cents bigint NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  currency text NOT NULL DEFAULT 'INR',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.developer_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.developer_wallets(id),
  task_id uuid NULL REFERENCES public.tasks(id),
  type text NOT NULL CHECK (type IN ('credit', 'debit', 'fine', 'payout')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  reference text,
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS developer_wallet_transactions_task_idx
  ON public.developer_wallet_transactions (task_id);
CREATE INDEX IF NOT EXISTS developer_wallet_transactions_created_at_idx
  ON public.developer_wallet_transactions (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS developer_wallet_task_credit_unique_idx
  ON public.developer_wallet_transactions (task_id)
  WHERE task_id IS NOT NULL AND type = 'credit';

CREATE OR REPLACE FUNCTION public.developer_wallet_apply_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  wallet_row public.developer_wallets;
  balance_delta bigint;
  resulting_balance bigint;
  audit_actor uuid;
  task_developer_id uuid;
  task_status text;
BEGIN
  IF NEW.amount_cents <= 0 THEN
    RAISE EXCEPTION 'Wallet transaction amount must be positive';
  END IF;

  balance_delta := CASE
    WHEN NEW.type = 'credit' THEN NEW.amount_cents
    WHEN NEW.type IN ('debit', 'fine', 'payout') THEN -NEW.amount_cents
    ELSE NULL
  END;
  IF balance_delta IS NULL THEN
    RAISE EXCEPTION 'Unsupported wallet transaction type: %', NEW.type;
  END IF;

  SELECT * INTO wallet_row
    FROM public.developer_wallets
   WHERE id = NEW.wallet_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Developer wallet not found';
  END IF;

  IF NEW.type = 'credit' AND NEW.task_id IS NOT NULL THEN
    SELECT developer_id, status::text
      INTO task_developer_id, task_status
      FROM public.tasks
     WHERE id = NEW.task_id;
    IF NOT FOUND OR task_developer_id <> wallet_row.developer_id THEN
      RAISE EXCEPTION 'Task credit must use the task developer wallet';
    END IF;
    IF task_status <> 'paid' THEN
      RAISE EXCEPTION 'Task credit requires a paid task';
    END IF;
  END IF;

  resulting_balance := wallet_row.balance_cents + balance_delta;
  IF resulting_balance < 0 THEN
    RAISE EXCEPTION 'Wallet transaction would create a negative balance';
  END IF;

  UPDATE public.developer_wallets
     SET balance_cents = resulting_balance,
         updated_at = now()
   WHERE id = wallet_row.id;

  audit_actor := coalesce(auth.uid(), NEW.created_by);
  INSERT INTO public.audit_logs (
    actor_id, actor, action, entity_type, entity_id, severity,
    before_state, after_state, metadata
  ) VALUES (
    audit_actor,
    coalesce(audit_actor::text, 'system'),
    'wallet.tx',
    'developer_wallet',
    wallet_row.id::text,
    'info',
    jsonb_build_object('balance_cents', wallet_row.balance_cents),
    jsonb_build_object(
      'balance_cents', resulting_balance,
      'transaction_id', NEW.id,
      'type', NEW.type,
      'amount_cents', NEW.amount_cents
    ),
    jsonb_build_object(
      'task_id', NEW.task_id,
      'reference', NEW.reference,
      'note', NEW.note,
      'created_by', NEW.created_by
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS developer_wallet_apply_transaction
  ON public.developer_wallet_transactions;
CREATE TRIGGER developer_wallet_apply_transaction
  AFTER INSERT ON public.developer_wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.developer_wallet_apply_transaction();

CREATE OR REPLACE FUNCTION public.developer_wallet_transaction_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'developer_wallet_transactions is append-only';
END;
$function$;

DROP TRIGGER IF EXISTS developer_wallet_transactions_append_only
  ON public.developer_wallet_transactions;
CREATE TRIGGER developer_wallet_transactions_append_only
  BEFORE UPDATE OR DELETE ON public.developer_wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.developer_wallet_transaction_immutable();

CREATE OR REPLACE FUNCTION public.developer_wallet_audit_create()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
DECLARE
  audit_actor uuid := auth.uid();
BEGIN
  INSERT INTO public.audit_logs (
    actor_id, actor, action, entity_type, entity_id, severity,
    before_state, after_state, metadata
  ) VALUES (
    audit_actor,
    coalesce(audit_actor::text, 'system'),
    'wallet.create',
    'developer_wallet',
    NEW.id::text,
    'info',
    NULL,
    jsonb_build_object(
      'developer_id', NEW.developer_id,
      'balance_cents', NEW.balance_cents,
      'currency', NEW.currency
    ),
    '{}'::jsonb
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS developer_wallet_audit_create ON public.developer_wallets;
CREATE TRIGGER developer_wallet_audit_create
  AFTER INSERT ON public.developer_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.developer_wallet_audit_create();

ALTER TABLE public.developer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS developer_wallet_owner_read ON public.developer_wallets;
CREATE POLICY developer_wallet_owner_read
  ON public.developer_wallets
  FOR SELECT TO authenticated
  USING (developer_id = auth.uid());

DROP POLICY IF EXISTS developer_wallet_finance_read ON public.developer_wallets;
CREATE POLICY developer_wallet_finance_read
  ON public.developer_wallets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid() AND role::text = 'finance_manager'
    )
  );

DROP POLICY IF EXISTS developer_wallet_transaction_owner_read
  ON public.developer_wallet_transactions;
CREATE POLICY developer_wallet_transaction_owner_read
  ON public.developer_wallet_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.developer_wallets w
       WHERE w.id = wallet_id AND w.developer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS developer_wallet_transaction_finance_read
  ON public.developer_wallet_transactions;
CREATE POLICY developer_wallet_transaction_finance_read
  ON public.developer_wallet_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid() AND role::text = 'finance_manager'
    )
  );

DO $phase5_grants$
BEGIN
  REVOKE ALL ON public.developer_wallets,
    public.developer_wallet_transactions FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.developer_wallets,
      public.developer_wallet_transactions FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.developer_wallets,
      public.developer_wallet_transactions FROM authenticated;
    GRANT SELECT ON public.developer_wallets,
      public.developer_wallet_transactions TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON public.developer_wallets,
      public.developer_wallet_transactions FROM service_role;
    GRANT SELECT, INSERT ON public.developer_wallets TO service_role;
    GRANT SELECT, INSERT ON public.developer_wallet_transactions TO service_role;
  END IF;
END;
$phase5_grants$;
