-- Recovered from the Supabase migration history (supabase_migrations.schema_migrations).
-- Already applied in production; committed so the repository carries the full history.

ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_resellers_user_id_unique
  ON public.resellers(user_id)
  WHERE user_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.reseller_owned_by_user(_user_id uuid, _reseller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resellers r
    WHERE r.id = _reseller_id
      AND r.user_id = _user_id
  );
$$;
REVOKE ALL ON FUNCTION public.reseller_owned_by_user(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseller_owned_by_user(uuid, uuid) TO authenticated;
UPDATE public.resellers r
SET user_id = u.id
FROM auth.users u
WHERE r.user_id IS NULL
  AND u.email = r.email;
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resellers_admin" ON public.resellers;
CREATE POLICY "resellers_admin" ON public.resellers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss') OR auth.uid() = user_id)
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss') OR auth.uid() = user_id);
DROP POLICY IF EXISTS "resellers_select_own" ON public.resellers;
CREATE POLICY "resellers_select_own" ON public.resellers FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'));
DROP POLICY IF EXISTS "resellers_update_own" ON public.resellers;
CREATE POLICY "resellers_update_own" ON public.resellers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'));
DROP POLICY IF EXISTS "resellers_insert_own" ON public.resellers;
CREATE POLICY "resellers_insert_own" ON public.resellers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'));
DROP POLICY IF EXISTS "resellers_delete_own" ON public.resellers;
CREATE POLICY "resellers_delete_own" ON public.resellers FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'));
-- Shared reseller data rows must be visible only to their owning reseller or an admin.
DO $$
BEGIN
  -- reseller_customers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reseller_customers') THEN
    ALTER TABLE public.reseller_customers ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reseller_customers_admin" ON public.reseller_customers;
    CREATE POLICY "reseller_customers_admin" ON public.reseller_customers FOR ALL TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'boss')
        OR public.reseller_owned_by_user(auth.uid(), reseller_id)
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'boss')
        OR public.reseller_owned_by_user(auth.uid(), reseller_id)
      );
  END IF;

  -- reseller_orders
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reseller_orders') THEN
    ALTER TABLE public.reseller_orders ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reseller_orders_admin" ON public.reseller_orders;
    CREATE POLICY "reseller_orders_admin" ON public.reseller_orders FOR ALL TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'boss')
        OR public.reseller_owned_by_user(auth.uid(), reseller_id)
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'boss')
        OR public.reseller_owned_by_user(auth.uid(), reseller_id)
      );
  END IF;

  -- reseller_products
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reseller_products') THEN
    ALTER TABLE public.reseller_products ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reseller_products_admin" ON public.reseller_products;
    CREATE POLICY "reseller_products_admin" ON public.reseller_products FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'))
      WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'));
  END IF;

  -- reseller_applications
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reseller_applications') THEN
    ALTER TABLE public.reseller_applications ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reseller_apps_admin" ON public.reseller_applications;
    CREATE POLICY "reseller_apps_admin" ON public.reseller_applications FOR ALL TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'boss')
        OR public.reseller_owned_by_user(auth.uid(), reseller_id)
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'boss')
        OR public.reseller_owned_by_user(auth.uid(), reseller_id)
      );
  END IF;

  -- reseller_kyc
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reseller_kyc') THEN
    ALTER TABLE public.reseller_kyc ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reseller_kyc_admin" ON public.reseller_kyc;
    CREATE POLICY "reseller_kyc_admin" ON public.reseller_kyc FOR ALL TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'boss')
        OR public.reseller_owned_by_user(auth.uid(), reseller_id)
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'boss')
        OR public.reseller_owned_by_user(auth.uid(), reseller_id)
      );
  END IF;

  -- reseller_licenses
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reseller_licenses') THEN
    ALTER TABLE public.reseller_licenses ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reseller_licenses_admin" ON public.reseller_licenses;
    CREATE POLICY "reseller_licenses_admin" ON public.reseller_licenses FOR ALL TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'boss')
        OR public.reseller_owned_by_user(auth.uid(), reseller_id)
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'boss')
        OR public.reseller_owned_by_user(auth.uid(), reseller_id)
      );
  END IF;

  -- reseller_wallet_transactions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reseller_wallet_transactions') THEN
    ALTER TABLE public.reseller_wallet_transactions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reseller_wallet_admin" ON public.reseller_wallet_transactions;
    CREATE POLICY "reseller_wallet_admin" ON public.reseller_wallet_transactions FOR ALL TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'boss')
        OR public.reseller_owned_by_user(auth.uid(), reseller_id)
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'boss')
        OR public.reseller_owned_by_user(auth.uid(), reseller_id)
      );
  END IF;

  -- reseller_subscriptions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reseller_subscriptions') THEN
    ALTER TABLE public.reseller_subscriptions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reseller_subs_admin" ON public.reseller_subscriptions;
    CREATE POLICY "reseller_subs_admin" ON public.reseller_subscriptions FOR ALL TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'boss')
        OR public.reseller_owned_by_user(auth.uid(), reseller_id)
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'boss')
        OR public.reseller_owned_by_user(auth.uid(), reseller_id)
      );
  END IF;

  -- reseller_notifications
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reseller_notifications') THEN
    ALTER TABLE public.reseller_notifications ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reseller_notif_admin" ON public.reseller_notifications;
    CREATE POLICY "reseller_notif_admin" ON public.reseller_notifications FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'))
      WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'));
  END IF;

  -- reseller_support_tickets
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reseller_support_tickets') THEN
    ALTER TABLE public.reseller_support_tickets ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reseller_support_admin" ON public.reseller_support_tickets;
    CREATE POLICY "reseller_support_admin" ON public.reseller_support_tickets FOR ALL TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'boss')
        OR public.reseller_owned_by_user(auth.uid(), reseller_id)
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'boss')
        OR public.reseller_owned_by_user(auth.uid(), reseller_id)
      );
  END IF;

  -- reseller_reports
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reseller_reports') THEN
    ALTER TABLE public.reseller_reports ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reseller_reports_admin" ON public.reseller_reports;
    CREATE POLICY "reseller_reports_admin" ON public.reseller_reports FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'))
      WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'));
  END IF;

  -- reseller_audit_logs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reseller_audit_logs') THEN
    ALTER TABLE public.reseller_audit_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reseller_audit_admin" ON public.reseller_audit_logs;
    CREATE POLICY "reseller_audit_admin" ON public.reseller_audit_logs FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'))
      WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'));
  END IF;
END $$;
