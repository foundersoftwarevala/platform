-- Author product writes must pass through the server lifecycle/ownership checks.
-- The author product API uses the service role only after checking seller identity,
-- product ownership, editable state, and the requested transition. Operators keep
-- their separate admin policies; sellers retain their own-row read policy.
drop policy if exists marketplace_products_owner_write on public.marketplace_products;
drop policy if exists marketplace_products_owner_update on public.marketplace_products;
