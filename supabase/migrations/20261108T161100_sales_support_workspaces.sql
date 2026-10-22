DO $sales_support_preflight$
BEGIN
  IF to_regclass('public.sales_leads') IS NULL
     OR to_regclass('public.sales_deals') IS NULL
     OR to_regclass('public.support_tickets') IS NULL
     OR to_regclass('public.team_members') IS NULL
     OR to_regclass('public.audit_logs') IS NULL
     OR to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Sales & Support requires the existing CRM, team, Auth, and audit tables';
  END IF;
  IF to_regprocedure('public.is_crm_staff(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Sales & Support requires public.is_crm_staff(uuid)';
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
    RAISE EXCEPTION 'Sales & Support requires active append-only and hash-chain audit triggers';
  END IF;
END;
$sales_support_preflight$;

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS auth_user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS team_members_auth_user_id_unique_idx
  ON public.team_members (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.sales_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  deal_id uuid NOT NULL REFERENCES public.sales_deals(id) ON DELETE RESTRICT,
  owner_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_quotes_owner_created_idx
  ON public.sales_quotes (owner_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS sales_quotes_deal_idx
  ON public.sales_quotes (deal_id, created_at DESC, id);

CREATE TABLE IF NOT EXISTS public.support_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_replies_ticket_created_idx
  ON public.support_replies (ticket_id, created_at, id);
CREATE INDEX IF NOT EXISTS sales_leads_assigned_created_idx
  ON public.sales_leads (assigned_to, created_at DESC, id);
CREATE INDEX IF NOT EXISTS sales_deals_owner_created_idx
  ON public.sales_deals (owner_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS support_tickets_assigned_created_idx
  ON public.support_tickets (assigned_to, created_at DESC, id);

CREATE OR REPLACE FUNCTION public.sales_support_is_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles
     WHERE user_id = auth.uid()
       AND role::text IN (
         'admin', 'boss', 'boss_owner', 'founder', 'super_admin',
         'sales_support_manager', 'finance_manager'
       )
  );
$function$;

CREATE OR REPLACE FUNCTION public.sales_support_is_sales()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = auth.uid() AND role::text = 'sales'
  );
$function$;

CREATE OR REPLACE FUNCTION public.sales_support_is_support()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = auth.uid() AND role::text = 'support'
  );
$function$;

-- RLS can check ownership without granting authenticated users team directory access.
CREATE OR REPLACE FUNCTION public.sales_support_owns_team_member(
  p_team_member_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.team_members
     WHERE id = p_team_member_id
       AND auth_user_id = auth.uid()
  );
$function$;

REVOKE ALL ON FUNCTION public.sales_support_is_manager() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sales_support_is_sales() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sales_support_is_support() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sales_support_owns_team_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_support_is_manager() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sales_support_is_sales() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sales_support_is_support() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sales_support_owns_team_member(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sales_support_audit_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
DECLARE
  audit_actor uuid := auth.uid();
  row_id text;
BEGIN
  IF audit_actor IS NULL THEN
    RAISE EXCEPTION 'Sales and Support changes require an authenticated audit actor';
  END IF;
  row_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END;
  INSERT INTO public.audit_logs (
    actor_id, actor, action, entity_type, entity_id, severity,
    before_state, after_state, metadata
  ) VALUES (
    audit_actor,
    coalesce(audit_actor::text, 'system'),
    lower(TG_TABLE_NAME) || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    row_id,
    'info',
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    jsonb_build_object('source', 'sales_support_workspace')
  );
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sales_support_audit_member_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
DECLARE
  audit_actor uuid := auth.uid();
BEGIN
  IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
    IF audit_actor IS NULL THEN
      RAISE EXCEPTION 'Team account linking requires an authenticated audit actor';
    END IF;
    INSERT INTO public.audit_logs (
      actor_id, actor, action, entity_type, entity_id, severity,
      before_state, after_state, metadata
    ) VALUES (
      audit_actor,
      coalesce(audit_actor::text, 'system'),
      'team_member.account_link_changed',
      'team_member',
      NEW.id::text,
      'info',
      jsonb_build_object('auth_user_id', OLD.auth_user_id),
      jsonb_build_object('auth_user_id', NEW.auth_user_id),
      jsonb_build_object('source', 'sales_support_workspace')
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.support_replies_reject_rewrite()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'Support replies are append-only';
END;
$function$;

DROP TRIGGER IF EXISTS sales_support_audit_member_link ON public.team_members;
CREATE TRIGGER sales_support_audit_member_link
  AFTER UPDATE OF auth_user_id ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sales_support_audit_member_link();

DROP TRIGGER IF EXISTS sales_quotes_audit_change ON public.sales_quotes;
CREATE TRIGGER sales_quotes_audit_change
  AFTER INSERT OR UPDATE OR DELETE ON public.sales_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.sales_support_audit_change();
DROP TRIGGER IF EXISTS support_replies_audit_change ON public.support_replies;
CREATE TRIGGER support_replies_audit_change
  AFTER INSERT ON public.support_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.sales_support_audit_change();
DROP TRIGGER IF EXISTS support_replies_append_only ON public.support_replies;
CREATE TRIGGER support_replies_append_only
  BEFORE UPDATE OR DELETE ON public.support_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.support_replies_reject_rewrite();
DROP TRIGGER IF EXISTS sales_leads_audit_change ON public.sales_leads;
CREATE TRIGGER sales_leads_audit_change
  AFTER INSERT OR UPDATE OR DELETE ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.sales_support_audit_change();
DROP TRIGGER IF EXISTS sales_deals_audit_change ON public.sales_deals;
CREATE TRIGGER sales_deals_audit_change
  AFTER INSERT OR UPDATE OR DELETE ON public.sales_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.sales_support_audit_change();
DROP TRIGGER IF EXISTS support_tickets_audit_change ON public.support_tickets;
CREATE TRIGGER support_tickets_audit_change
  AFTER INSERT OR UPDATE OR DELETE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.sales_support_audit_change();

DO $sales_support_policies$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN (
         'sales_leads', 'sales_deals',
         'sales_quotes', 'support_tickets', 'support_replies'
       )
       AND permissive = 'PERMISSIVE'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END;
$sales_support_policies$;

ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_leads_read_owner_or_manager
  ON public.sales_leads FOR SELECT TO authenticated
  USING (
    public.sales_support_is_manager()
    OR (
      public.sales_support_is_sales()
      AND public.sales_support_owns_team_member(sales_leads.assigned_to)
    )
  );
CREATE POLICY sales_deals_read_owner_or_manager
  ON public.sales_deals FOR SELECT TO authenticated
  USING (
    public.sales_support_is_manager()
    OR (
      public.sales_support_is_sales()
      AND public.sales_support_owns_team_member(sales_deals.owner_id)
    )
  );
CREATE POLICY sales_quotes_read_owner_or_manager
  ON public.sales_quotes FOR SELECT TO authenticated
  USING (
    public.sales_support_is_manager()
    OR (
      public.sales_support_is_sales()
      AND public.sales_support_owns_team_member(sales_quotes.owner_id)
    )
  );
CREATE POLICY support_tickets_read_assigned_or_manager
  ON public.support_tickets FOR SELECT TO authenticated
  USING (
    public.sales_support_is_manager()
    OR (
      public.sales_support_is_support()
      AND public.sales_support_owns_team_member(support_tickets.assigned_to)
    )
  );
CREATE POLICY support_replies_read_assigned_or_manager
  ON public.support_replies FOR SELECT TO authenticated
  USING (
    public.sales_support_is_manager()
    OR (
      public.sales_support_is_support()
      AND EXISTS (
        SELECT 1 FROM public.support_tickets t
         WHERE t.id = support_replies.ticket_id
           AND public.sales_support_owns_team_member(t.assigned_to)
      )
    )
  );

-- Mutations go through authenticated server functions, never client DML grants.
REVOKE ALL ON public.sales_leads, public.sales_deals, public.sales_quotes,
  public.support_tickets, public.support_replies, public.team_members
  FROM PUBLIC, anon, authenticated;
DO $sales_support_revoke_column_writes$
DECLARE
  grant_row record;
BEGIN
  FOR grant_row IN
    SELECT table_name, column_name, privilege_type, grantee
      FROM information_schema.column_privileges
     WHERE table_schema = 'public'
       AND table_name IN (
         'sales_leads', 'sales_deals', 'sales_quotes',
         'support_tickets', 'support_replies', 'team_members'
       )
       AND grantee IN ('PUBLIC', 'anon', 'authenticated')
       AND privilege_type IN ('INSERT', 'UPDATE')
  LOOP
    IF grant_row.grantee = 'PUBLIC' THEN
      EXECUTE format(
        'REVOKE %s (%I) ON TABLE public.%I FROM PUBLIC',
        grant_row.privilege_type,
        grant_row.column_name,
        grant_row.table_name
      );
    ELSE
      EXECUTE format(
        'REVOKE %s (%I) ON TABLE public.%I FROM %I',
        grant_row.privilege_type,
        grant_row.column_name,
        grant_row.table_name,
        grant_row.grantee
      );
    END IF;
  END LOOP;
END;
$sales_support_revoke_column_writes$;
GRANT SELECT ON public.sales_leads, public.sales_deals, public.sales_quotes,
  public.support_tickets, public.support_replies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sales_leads, public.sales_deals,
  public.sales_quotes, public.support_tickets, public.team_members TO service_role;
GRANT SELECT, INSERT ON public.support_replies TO service_role;

DO $sales_support_privilege_assertions$
BEGIN
  IF NOT (
    SELECT bool_and(
      NOT has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
      AND NOT has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
      AND NOT has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE')
      AND NOT has_table_privilege('anon', format('public.%I', table_name), 'INSERT')
      AND NOT has_table_privilege('anon', format('public.%I', table_name), 'UPDATE')
      AND NOT has_table_privilege('anon', format('public.%I', table_name), 'DELETE')
    )
      FROM unnest(ARRAY[
        'sales_leads', 'sales_deals', 'sales_quotes',
        'support_tickets', 'support_replies', 'team_members'
    ]) AS tables(table_name)
  ) THEN
    RAISE EXCEPTION 'Sales & Support tables must deny direct client writes';
  END IF;
  IF NOT (
    SELECT bool_and(relrowsecurity)
      FROM pg_class
     WHERE relnamespace = 'public'::regnamespace
       AND relname IN (
         'sales_leads', 'sales_deals', 'sales_quotes',
         'support_tickets', 'support_replies'
       )
  ) THEN
    RAISE EXCEPTION 'Sales & Support business tables must have RLS enabled';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM information_schema.column_privileges
     WHERE table_schema = 'public'
       AND table_name IN (
         'sales_leads', 'sales_deals', 'sales_quotes',
         'support_tickets', 'support_replies', 'team_members'
       )
       AND grantee IN ('PUBLIC', 'anon', 'authenticated')
       AND privilege_type IN ('INSERT', 'UPDATE')
  ) THEN
    RAISE EXCEPTION 'Sales & Support tables must not retain client column-write grants';
  END IF;
END;
$sales_support_privilege_assertions$;
