-- Affiliate Manager console: let its operator roles read the real tables.
--
-- The console route (/affiliate-manager) admits finance, support and
-- sales_support_manager, and its walls read the real relations
-- (marketplace_affiliate_partners / referral_codes / referral_sessions /
-- order_attributions) directly through the browser Supabase client. But those
-- tables' SELECT policies only allowed marketplace_is_admin, so those operator
-- roles saw nothing. This adds a staff SELECT policy so the roles that can open
-- the console can also read it, and an own-read policy so an affiliate can read
-- their own partner record and codes.
--
-- Additive only: existing policies are untouched; no table, view or column is
-- created; writes stay exactly as they were. This changes read visibility, not
-- data or UI.

-- The operator roles that run the Affiliate console (route RequireRole) plus the
-- existing marketplace admins.
create or replace function public.is_affiliate_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select public.marketplace_is_admin()
      or public.has_role(auth.uid(), 'finance')
      or public.has_role(auth.uid(), 'support')
      or public.has_role(auth.uid(), 'sales_support_manager');
$$;

do $$
begin
  -- Partners: staff read + own read.
  if not exists (select 1 from pg_policies where schemaname='public'
     and tablename='marketplace_affiliate_partners' and policyname='affiliate_partners_staff_read') then
    create policy affiliate_partners_staff_read on public.marketplace_affiliate_partners
      for select to authenticated using (public.is_affiliate_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
     and tablename='marketplace_affiliate_partners' and policyname='affiliate_partners_own_read') then
    create policy affiliate_partners_own_read on public.marketplace_affiliate_partners
      for select to authenticated using (user_id = auth.uid());
  end if;

  -- Referral codes: staff read + own read (via the owning partner).
  if not exists (select 1 from pg_policies where schemaname='public'
     and tablename='marketplace_referral_codes' and policyname='referral_codes_staff_read') then
    create policy referral_codes_staff_read on public.marketplace_referral_codes
      for select to authenticated using (public.is_affiliate_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
     and tablename='marketplace_referral_codes' and policyname='referral_codes_own_read') then
    create policy referral_codes_own_read on public.marketplace_referral_codes
      for select to authenticated using (
        exists (select 1 from public.marketplace_affiliate_partners p
                 where p.id = marketplace_referral_codes.affiliate_partner_id
                   and p.user_id = auth.uid()));
  end if;

  -- Referral sessions: staff read.
  if not exists (select 1 from pg_policies where schemaname='public'
     and tablename='marketplace_referral_sessions' and policyname='referral_sessions_staff_read') then
    create policy referral_sessions_staff_read on public.marketplace_referral_sessions
      for select to authenticated using (public.is_affiliate_staff());
  end if;

  -- Order attributions (the affiliate commissions/sales walls read this): staff read.
  if exists (select 1 from information_schema.tables
              where table_schema='public' and table_name='marketplace_order_attributions')
     and not exists (select 1 from pg_policies where schemaname='public'
        and tablename='marketplace_order_attributions' and policyname='order_attributions_staff_read') then
    create policy order_attributions_staff_read on public.marketplace_order_attributions
      for select to authenticated using (public.is_affiliate_staff());
  end if;
end $$;
