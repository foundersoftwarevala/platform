-- Every commission and payout a reseller has is announced to them.
--
-- mm_notify skips a notification when the same person already has one of the
-- same event type inside a window. The reseller money functions passed 5
-- minutes for commission and payout status, and 60 for a prepared payout, so a
-- second sale within five minutes, or a second payout within the hour, was
-- never announced (reproduced inside a rolled-back transaction by
-- scripts/ops/reseller-money-flow-verify.sql: two commissions, one notice).
-- These are distinct money events, each already guaranteed to happen once by
-- the functions themselves, so the window only hid real ones. It becomes 0.
-- Only the window argument changes; nothing else in the three functions does.

begin;

do $$
declare
  pair text[]; f text; pat text; def text; changed text;
begin
  foreach pair slice 1 in array array[
    ['public.reseller_commissions_for_order(uuid)', $p$'/dashboard/reseller', 'View', 5, 'success')$p$],
    ['public.mm_reseller_payout_create(uuid,text)', $p$'/dashboard/reseller', 'View', 60, 'info')$p$],
    ['public.mm_reseller_payout_status(uuid,text,text,text)', E'''/dashboard/reseller'', ''View'', 5,\n']]
  loop
    f := pair[1]; pat := pair[2];
    def := pg_get_functiondef(f::regprocedure);
    if position(pat in def) = 0 then
      raise exception '% did not match the expected notification call; nothing changed', f;
    end if;
    changed := replace(def, pat, regexp_replace(pat, ', (5|60)(,|\))', ', 0\2'));
    execute changed;
  end loop;
end $$;

commit;
