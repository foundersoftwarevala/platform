-- Trusted server contexts are operators too.
--
-- mm_is_operator() asked only "does auth.uid() hold an operator role", which is
-- exactly right for a request arriving from a browser. But it made the answer
-- "no" for the service role and for postgres, which are the contexts server
-- code and scheduled work run in — so the platform's own backend could not
-- drive its own row functions, and any test of the validation branches stopped
-- at the permission gate before reaching them.
--
-- This grants nothing new. The service role already bypasses row-level security
-- entirely and postgres is the superuser; a SECURITY DEFINER function refusing
-- them was a false boundary, not a real one. A signed-in person is still judged
-- exactly as before, by the role they actually hold.

create or replace function public.mm_is_operator()
returns boolean
language sql stable security definer set search_path = public as $$
  select
    -- Server-side: the request is not coming from a browser session at all.
    current_user in ('service_role', 'postgres')
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','boss','founder','super_admin','boss_owner','marketing','seo')
    );
$$;
