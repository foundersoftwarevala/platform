-- Reseller notifications link to the reseller's own dashboard.
--
-- The payout and commission notifications a reseller receives linked to
-- /reseller-manager, the operator console, which a reseller is refused. Their
-- own page is /dashboard/reseller. Only the link changes; nothing else in the
-- three functions does.

begin;

do $$
declare
  f text;
  def text;
  changed text;
begin
  foreach f in array array[
    'public.mm_reseller_payout_status(uuid,text,text,text)',
    'public.mm_reseller_payout_create(uuid,text)',
    'public.reseller_commissions_for_order(uuid)']
  loop
    def := pg_get_functiondef(f::regprocedure);
    if position('''/reseller-manager''' in def) = 0 then
      continue;
    end if;
    changed := replace(def, '''/reseller-manager''', '''/dashboard/reseller''');
    execute changed;
  end loop;
end $$;

commit;
