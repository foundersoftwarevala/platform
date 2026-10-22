-- Link catalogue products to a franchise tenant and resolve directory owners
-- from an existing account email during manager-side franchise creation.

CREATE TABLE IF NOT EXISTS public.franchise_product_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id uuid NOT NULL REFERENCES public.franchises(id),
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT franchise_product_assignments_franchise_product_key
    UNIQUE (franchise_id, product_id)
);

ALTER TABLE public.franchise_product_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS franchise_product_assignments_tenant_read
  ON public.franchise_product_assignments;
CREATE POLICY franchise_product_assignments_tenant_read
  ON public.franchise_product_assignments
  FOR SELECT TO authenticated
  USING (public.franchise_has_access(franchise_id));

GRANT SELECT ON public.franchise_product_assignments TO authenticated;

DROP POLICY IF EXISTS franchise_assigned_products_read
  ON public.marketplace_products;
CREATE POLICY franchise_assigned_products_read
  ON public.marketplace_products
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.franchise_product_assignments assignment
      WHERE assignment.product_id = marketplace_products.id
        AND assignment.active
        AND public.franchise_has_access(assignment.franchise_id)
    )
  );

CREATE OR REPLACE FUNCTION public.franchise_owner_id_for_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id
  FROM auth.users AS u
  WHERE lower(btrim(u.email)) = lower(btrim(p_email))
  ORDER BY u.created_at DESC, u.id
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.franchise_owner_id_for_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.franchise_owner_id_for_email(text) TO service_role;
