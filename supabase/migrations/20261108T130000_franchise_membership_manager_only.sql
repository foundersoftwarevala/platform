BEGIN;

CREATE OR REPLACE FUNCTION public.franchise_can_manage_members(p_franchise_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND lower(ur.role::text) = 'super_admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.franchises f
      WHERE f.id = p_franchise_id
        AND f.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.franchise_users fu
      WHERE fu.franchise_id = p_franchise_id
        AND fu.user_id = auth.uid()
        AND fu.active
        AND fu.role = 'franchise_admin'
    );
$$;

REVOKE ALL ON FUNCTION public.franchise_can_manage_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.franchise_can_manage_members(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS franchise_users_tenant_access ON public.franchise_users;
DROP POLICY IF EXISTS franchise_users_read_access ON public.franchise_users;
DROP POLICY IF EXISTS franchise_users_manager_access ON public.franchise_users;

CREATE POLICY franchise_users_read_access
  ON public.franchise_users
  FOR SELECT
  TO authenticated
  USING (
    public.franchise_is_admin()
    OR user_id = auth.uid()
    OR public.franchise_has_access(franchise_id)
  );

CREATE POLICY franchise_users_manager_access
  ON public.franchise_users
  FOR ALL
  TO authenticated
  USING (public.franchise_can_manage_members(franchise_id))
  WITH CHECK (public.franchise_can_manage_members(franchise_id));

COMMIT;
