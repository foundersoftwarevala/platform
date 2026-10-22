DO $bidding_preflight$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'public.tasks',
    'public.tm_tasks',
    'public.tm_members',
    'public.tm_activity',
    'public.leads',
    'public.lead_activities',
    'public.chat_messages',
    'public.task_promises',
    'public.developer_wallets',
    'public.sales_leads',
    'public.sales_deals',
    'public.sales_quotes',
    'public.support_tickets',
    'public.support_replies',
    'public.audit_logs'
  ] LOOP
    IF to_regclass(relation_name) IS NULL THEN
      RAISE EXCEPTION 'Final stabilization requires existing relation %', relation_name;
    END IF;
  END LOOP;
END;
$bidding_preflight$;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS before_state jsonb,
  ADD COLUMN IF NOT EXISTS after_state jsonb;

DO $audit_actor_fk$
DECLARE
  actor_attnum smallint;
  existing_fk record;
BEGIN
  SELECT attnum
    INTO actor_attnum
    FROM pg_attribute
   WHERE attrelid = 'public.audit_logs'::regclass
     AND attname = 'actor_id'
     AND NOT attisdropped;

  SELECT confrelid
    INTO existing_fk
    FROM pg_constraint
   WHERE conrelid = 'public.audit_logs'::regclass
     AND contype = 'f'
     AND actor_attnum = ANY (conkey)
   LIMIT 1;

  IF FOUND AND existing_fk.confrelid <> 'auth.users'::regclass THEN
    RAISE EXCEPTION 'public.audit_logs.actor_id references %, expected auth.users',
      existing_fk.confrelid::regclass;
  ELSIF NOT FOUND THEN
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_actor_id_fkey
      FOREIGN KEY (actor_id) REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END;
$audit_actor_fk$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.audit_logs_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$function$;

DROP TRIGGER IF EXISTS audit_logs_append_only ON public.audit_logs;
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_guard();

CREATE OR REPLACE FUNCTION public.audit_logs_hash_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $function$
DECLARE
  previous_hash text;
BEGIN
  PERFORM pg_advisory_xact_lock(725202611081453::bigint);

  SELECT al.hash
    INTO previous_hash
    FROM public.audit_logs al
   WHERE al.hash IS NOT NULL
   ORDER BY al.occurred_at DESC, al.id DESC
   LIMIT 1;

  NEW.hash := encode(
    digest(
      coalesce(previous_hash, '')
      || NEW.id::text
      || NEW.action
      || coalesce(NEW.entity_id, '')
      || NEW.occurred_at::text,
      'sha256'
    ),
    'hex'
  );
  RETURN NEW;
END;
$function$;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS hash text;

DROP TRIGGER IF EXISTS audit_logs_hash_chain ON public.audit_logs;
CREATE TRIGGER audit_logs_hash_chain
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_hash_chain();
REVOKE ALL ON FUNCTION public.audit_logs_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_logs_hash_chain() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.audit_logs TO service_role;
DROP POLICY IF EXISTS audit_logs_phase3_read ON public.audit_logs;
CREATE POLICY audit_logs_phase3_read
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.tm_is_operator() OR actor_id = auth.uid());
DROP POLICY IF EXISTS audit_logs_phase3_insert_deny ON public.audit_logs;
CREATE POLICY audit_logs_phase3_insert_deny
  ON public.audit_logs
  AS RESTRICTIVE
  FOR INSERT
  TO PUBLIC
  WITH CHECK (false);
DROP POLICY IF EXISTS audit_logs_phase3_update_deny ON public.audit_logs;
CREATE POLICY audit_logs_phase3_update_deny
  ON public.audit_logs
  AS RESTRICTIVE
  FOR UPDATE
  TO PUBLIC
  USING (false)
  WITH CHECK (false);
DROP POLICY IF EXISTS audit_logs_phase3_delete_deny ON public.audit_logs;
CREATE POLICY audit_logs_phase3_delete_deny
  ON public.audit_logs
  AS RESTRICTIVE
  FOR DELETE
  TO PUBLIC
  USING (false);

CREATE TABLE IF NOT EXISTS public.tm_task_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tm_tasks(id) ON DELETE RESTRICT,
  bidder_id uuid NOT NULL REFERENCES public.tm_members(id) ON DELETE RESTRICT,
  bidder_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  proposal text NOT NULL CHECK (length(btrim(proposal)) BETWEEN 1 AND 5000),
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS tm_task_bids_one_open_per_developer_idx
  ON public.tm_task_bids (task_id, bidder_id)
  WHERE status = 'submitted';
CREATE INDEX IF NOT EXISTS tm_task_bids_task_created_idx
  ON public.tm_task_bids (task_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS tm_task_bids_bidder_created_idx
  ON public.tm_task_bids (bidder_user_id, created_at DESC, id);

CREATE OR REPLACE FUNCTION public.tm_task_bids_guard_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
DECLARE
  task_row public.tm_tasks;
  member_row public.tm_members;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Task bids cannot be deleted; withdraw or reject a bid instead';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT * INTO task_row
      FROM public.tm_tasks
     WHERE id = NEW.task_id
     FOR UPDATE;
    IF NOT FOUND
       OR task_row.status <> 'available_for_claim'
       OR task_row.assigned_to IS NOT NULL THEN
      RAISE EXCEPTION 'Only unassigned tasks available for claim can receive bids';
    END IF;

    SELECT * INTO member_row
      FROM public.tm_members
     WHERE id = NEW.bidder_id
       AND user_id = NEW.bidder_user_id
       AND active
       AND lower(role) = 'developer';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A bid must belong to the active developer account on the task roster';
    END IF;
    IF task_row.assigned_role IS NOT NULL
       AND lower(task_row.assigned_role) <> lower(member_row.role) THEN
      RAISE EXCEPTION 'This task is routed to a different role';
    END IF;
    IF NEW.currency <> task_row.currency THEN
      RAISE EXCEPTION 'A bid must use the task currency';
    END IF;

    NEW.status := 'submitted';
    NEW.accepted_at := NULL;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF NEW.task_id IS DISTINCT FROM OLD.task_id
     OR NEW.bidder_id IS DISTINCT FROM OLD.bidder_id
     OR NEW.bidder_user_id IS DISTINCT FROM OLD.bidder_user_id
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Task bid identity fields are immutable';
  END IF;
  IF OLD.status <> 'submitted'
     AND (NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.proposal IS DISTINCT FROM OLD.proposal) THEN
    RAISE EXCEPTION 'Only submitted bids can be edited';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (
       OLD.status = 'submitted'
       AND NEW.status IN ('accepted', 'rejected', 'withdrawn')
     ) THEN
    RAISE EXCEPTION 'Illegal task bid status transition: % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    NEW.accepted_at := now();
  ELSIF NEW.status IS DISTINCT FROM 'accepted' THEN
    NEW.accepted_at := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tm_task_bids_audit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  actor_member_id uuid;
  actor_name text;
  actor_role text;
  before_state jsonb;
  after_state jsonb;
  action_name text;
BEGIN
  SELECT id, full_name
    INTO actor_member_id, actor_name
    FROM public.tm_members
   WHERE user_id = actor_id;
  SELECT ur.role::text
    INTO actor_role
    FROM public.user_roles ur
   WHERE ur.user_id = actor_id
   ORDER BY CASE ur.role::text
     WHEN 'boss_owner' THEN 1
     WHEN 'super_admin' THEN 2
     WHEN 'admin' THEN 3
     WHEN 'founder' THEN 4
     WHEN 'boss' THEN 5
     WHEN 'developer' THEN 6
     ELSE 7
   END
   LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    before_state := NULL;
    after_state := jsonb_build_object(
      'task_id', NEW.task_id,
      'bidder_id', NEW.bidder_id,
      'bidder_user_id', NEW.bidder_user_id,
      'amount', NEW.amount,
      'currency', NEW.currency,
      'proposal', NEW.proposal,
      'status', NEW.status
    );
    action_name := 'Task bid submitted';
  ELSE
    before_state := jsonb_build_object(
      'amount', OLD.amount,
      'proposal', OLD.proposal,
      'status', OLD.status
    );
    after_state := jsonb_build_object(
      'amount', NEW.amount,
      'currency', NEW.currency,
      'proposal', NEW.proposal,
      'status', NEW.status
    );
    action_name := CASE
      WHEN OLD.status IS DISTINCT FROM NEW.status
        THEN 'Task bid ' || NEW.status
      ELSE 'Task bid edited'
    END;
  END IF;

  INSERT INTO public.tm_activity (
    task_id, actor_id, actor_name, actor_role, action, action_type,
    from_value, to_value, details
  ) VALUES (
    NEW.task_id,
    actor_member_id,
    coalesce(actor_name, actor_id::text, 'system'),
    coalesce(actor_role, CASE WHEN actor_id IS NULL THEN 'system' ELSE 'manager' END),
    action_name,
    'bidding',
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
    NEW.status,
    jsonb_build_object(
      'bid_id', NEW.id,
      'before', before_state,
      'after', after_state
    )::text
  );

  INSERT INTO public.audit_logs (
    actor_id, actor, action, entity_type, entity_id, severity,
    before_state, after_state, metadata
  ) VALUES (
    actor_id,
    coalesce(actor_name, actor_id::text, current_user),
    'tm_task_bid.' || lower(TG_OP),
    'tm_task_bid',
    NEW.id::text,
    'info',
    before_state,
    after_state,
    jsonb_build_object('task_id', NEW.task_id, 'bidder_id', NEW.bidder_id)
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tm_task_bids_guard_write ON public.tm_task_bids;
CREATE TRIGGER tm_task_bids_guard_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.tm_task_bids
  FOR EACH ROW EXECUTE FUNCTION public.tm_task_bids_guard_write();

DROP TRIGGER IF EXISTS tm_task_bids_audit_change ON public.tm_task_bids;
CREATE TRIGGER tm_task_bids_audit_change
  AFTER INSERT OR UPDATE ON public.tm_task_bids
  FOR EACH ROW EXECUTE FUNCTION public.tm_task_bids_audit_change();

DO $enable_core_rls$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'tasks',
    'tm_tasks',
    'tm_members',
    'tm_activity',
    'leads',
    'lead_activities',
    'chat_messages',
    'task_promises',
    'developer_wallets',
    'sales_leads',
    'sales_deals',
    'sales_quotes',
    'support_tickets',
    'support_replies',
    'audit_logs',
    'tm_task_bids'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_name);
  END LOOP;
END;
$enable_core_rls$;

ALTER TABLE public.tm_task_bids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tm_task_bids_read_owner_or_operator ON public.tm_task_bids;
CREATE POLICY tm_task_bids_read_owner_or_operator
  ON public.tm_task_bids
  FOR SELECT
  TO authenticated
  USING (public.tm_is_operator() OR bidder_user_id = auth.uid());

REVOKE ALL ON public.tm_task_bids FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tm_task_bids TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tm_task_bids TO service_role;

REVOKE ALL ON FUNCTION public.tm_task_bids_guard_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tm_task_bids_audit_change() FROM PUBLIC, anon, authenticated;

DO $final_stabilization_assertions$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'tasks',
    'tm_tasks',
    'tm_members',
    'tm_activity',
    'leads',
    'lead_activities',
    'chat_messages',
    'task_promises',
    'developer_wallets',
    'sales_leads',
    'sales_deals',
    'sales_quotes',
    'support_tickets',
    'support_replies',
    'audit_logs',
    'tm_task_bids'
  ] LOOP
    IF NOT (
      SELECT relrowsecurity
        FROM pg_class
       WHERE oid = format('public.%I', relation_name)::regclass
    ) THEN
      RAISE EXCEPTION 'RLS is not enabled on public.%', relation_name;
    END IF;
  END LOOP;

  IF has_table_privilege('authenticated', 'public.tm_task_bids', 'INSERT')
     OR has_table_privilege('authenticated', 'public.tm_task_bids', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.tm_task_bids', 'DELETE')
     OR has_table_privilege('anon', 'public.tm_task_bids', 'SELECT') THEN
    RAISE EXCEPTION 'Task bids must deny direct client writes and anonymous reads';
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
    RAISE EXCEPTION 'Audit append-only and hash-chain triggers must be enabled';
  END IF;
END;
$final_stabilization_assertions$;
