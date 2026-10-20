BEGIN;

CREATE POLICY marketplace_products_owner_update
  ON public.marketplace_products
  FOR UPDATE
  TO authenticated
  USING (marketplace_is_seller_member(seller_id) OR marketplace_is_admin())
  WITH CHECK (marketplace_is_seller_member(seller_id) OR marketplace_is_admin());

CREATE POLICY marketplace_products_owner_write
  ON public.marketplace_products
  FOR INSERT
  TO authenticated
  WITH CHECK (marketplace_is_seller_member(seller_id) OR marketplace_is_admin());

COMMIT;
