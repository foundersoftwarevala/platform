-- mm_is_operator() returned true for every signed-in account.
--
-- The function is SECURITY DEFINER, owned by postgres, and its first branch
-- read:
--
--     current_user in ('service_role', 'postgres')
--
-- Inside a SECURITY DEFINER function current_user is the function's *owner*,
-- not the caller. The owner is postgres. So that branch was true for every
-- caller, the user_roles check after it was never reached, and the gate passed
-- unconditionally.
--
-- Twenty functions are gated on it, all SECURITY DEFINER, and they are not all
-- merchandising:
--
--   orders and money  mm_orders_list, mm_order_detail, mm_order_docs,
--                     mm_refund_request, mm_dispute_open, mm_dispute_resolve
--   homepage          mm_slot_assign/move/pin/remove, mm_row_create,
--                     mm_row_configure, mm_row_set_status, mm_row_duplicate,
--                     mm_row_reorder, mm_rows_reorder
--   other surfaces    mm_dashboard, mm_topbar_configure, mm_topbar_reorder,
--                     mm_recommendation_configure
--
-- Any authenticated account - an ordinary customer - could therefore list every
-- order in the marketplace, open a refund, and rearrange the public homepage.
--
-- The intent of that first branch was sound: recognise a call that is not a
-- browser session, so migrations and server-side code are not blocked. It is
-- kept, using signals SECURITY DEFINER does not rewrite:
--
--   * the JWT's own role claim, which says 'service_role' for a server key;
--   * session_user, which stays the real connection role - 'authenticator' for
--     anything arriving through PostgREST, 'postgres' for a direct session.
--
-- Everything else is unchanged. The same seven roles authorise a person, so no
-- operator who could use the manager yesterday loses access today.

create or replace function public.mm_is_operator()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_role   text;
begin
  -- A malformed or absent claim must not raise; it simply means "no JWT".
  begin
    v_role := (nullif(v_claims, '')::jsonb) ->> 'role';
  exception when others then
    v_role := null;
  end;

  -- A server-side call with the service key.
  if v_role = 'service_role' then
    return true;
  end if;

  -- A direct database session with no request context: a migration, psql, the
  -- Management API. Anything arriving through PostgREST connects as
  -- 'authenticator' and is excluded here, so a browser can never take this
  -- branch no matter what it sends.
  if nullif(v_claims, '') is null
     and session_user not in ('authenticator', 'anon', 'authenticated') then
    return true;
  end if;

  -- Otherwise this is a person, and the role they actually hold decides.
  return exists (
    select 1
      from public.user_roles ur
     where ur.user_id = auth.uid()
       and ur.role in ('admin','boss','founder','super_admin','boss_owner','marketing','seo')
  );
end;
$$;
