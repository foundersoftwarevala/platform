-- A franchise may read its royalties, not rewrite them.
--
-- franchise_royalties had one policy for every command: franchise staff, or
-- anyone with access to the franchise - which includes the franchise's own
-- owner and users. So a franchise owner could mark their own royalty paid,
-- lower what they owed, or delete the row. Reading stays exactly as it was;
-- changing a royalty is for the franchise administrators and finance. The
-- Franchise Manager's own screens write through the server and are unaffected.

drop policy if exists franchise_tenant_access on public.franchise_royalties;

create policy franchise_royalties_read on public.franchise_royalties
  for select to authenticated
  using (public.is_franchise_staff() or public.franchise_has_access(franchise_id));

create policy franchise_royalties_write on public.franchise_royalties
  for all to authenticated
  using (
    public.franchise_is_admin()
    or exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role::text = 'finance')
  )
  with check (
    public.franchise_is_admin()
    or exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role::text = 'finance')
  );
