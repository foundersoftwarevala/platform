-- product_demo_urls: no public read of a demo's source address.
--
-- The live database carried a policy "product demos public active read"
-- (SELECT, anon + authenticated, status = 'active') that no migration
-- created. With the public anon key - shipped in the site's JavaScript - anyone
-- could read every active demo's source address (and the demo login, where one
-- is set) straight from the REST API, which the demo gateway and proxy exist to
-- keep on the server.
--
-- Visitors never need the table: the catalogue, the product page, the ticket
-- and the proxy all read it on the server with the service role. The staff
-- screens that read it with their own session (Product Demo Manager) are
-- opened by the roles the route gate admits (src/components/auth/
-- RouteAccessGate.tsx, RequireRole.tsx); those keep reading every row, as
-- admin and boss also write them.

drop policy if exists "product demos public active read" on public.product_demo_urls;

drop policy if exists "demo urls staff read" on public.product_demo_urls;
create policy "demo urls staff read" on public.product_demo_urls
  for select to authenticated
  using (
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'boss'::app_role)
    or has_role(auth.uid(), 'boss_owner'::app_role)
    or has_role(auth.uid(), 'super_admin'::app_role)
    or has_role(auth.uid(), 'founder'::app_role)
    or has_role(auth.uid(), 'developer'::app_role)
    or has_role(auth.uid(), 'support'::app_role)
  );
