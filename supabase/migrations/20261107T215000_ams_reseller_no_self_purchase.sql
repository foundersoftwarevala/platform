-- A reseller is not recognised for buying through their own link.
--
-- reseller_commissions_for_order refuses commission when the buyer owns the
-- referring reseller account, records 'reseller.self_referral_blocked', and
-- calls it the commonest abuse. ams_on_order_paid still sent the same order to
-- AMS as a reseller sale, so a reseller buying from themselves earned XP,
-- stages, badges, trophies, awards and a certificate for it (reproduced inside
-- a rolled-back transaction: the self-purchase order produced an order.paid
-- event with "as": "reseller" and its awards).
--
-- The reseller loop now applies the rule the commission engine already
-- applies. Sellers, affiliates and influencers are unchanged.

begin;

do $$
declare def text; changed text;
begin
  def := pg_get_functiondef('public.ams_on_order_paid()'::regprocedure);
  if position('rs.user_id is distinct from new.buyer_id' in def) > 0 then
    return;
  end if;
  changed := regexp_replace(def,
    E'(\n(\\s*)where a\\.order_id = new\\.id and rs\\.user_id is not null)\n',
    E'\\1\n\\2  -- Buying through one''s own link is not a sale to recognise.\n\\2  and rs.user_id is distinct from new.buyer_id\n');
  if changed = def then
    raise exception 'ams_on_order_paid did not match the expected reseller loop; nothing changed';
  end if;
  execute changed;
end $$;

commit;
