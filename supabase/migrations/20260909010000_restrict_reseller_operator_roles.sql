-- Reseller finance/admin RPCs must not inherit the broad marketplace operator
-- set, because that set intentionally includes marketing and SEO roles.
create or replace function public.mm_reseller_operator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select current_user in ('service_role', 'postgres')
      or public.reseller_is_finance()
      or public.has_role(auth.uid(), 'boss_owner')
      or public.has_role(auth.uid(), 'founder')
      or public.has_role(auth.uid(), 'owner')
      or public.has_role(auth.uid(), 'support')
      or public.has_role(auth.uid(), 'sales_support_manager');
$$;
