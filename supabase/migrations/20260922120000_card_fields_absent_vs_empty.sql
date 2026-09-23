-- The product card: tell "this group is switched off" apart from "this group
-- does not exist", and switch on the three fields that were reaching the card
-- and being thrown away.
--
-- Found by reading what the live marketplace actually renders. Across the 110
-- product cards the home page sends in its HTML:
--
--   Deployment   0 of 110   two products in three carry the value
--   Licence      0 of 110   two products in three carry the value
--   Buy Now    110 of 110   drawn whatever this registry says
--
-- Three separate causes, one per field, none of them to do with the catalogue.

/* ------------------------------------------------ 1. absent is not empty -- */

-- mm_card_fields() only ever returned the kinds that had something enabled, so
-- a kind with every key switched off was indistinguishable from a kind the
-- registry has never heard of. The storefront read both as an empty list and
-- hid the whole group, which is the wrong answer for one of them.
--
-- Every kind the registry holds is returned now, with an empty array when none
-- of its keys is on. An empty array is then an operator's decision and a
-- missing key is a group this registry does not manage - and the card draws
-- everything of that kind, which is what it does with no configuration at all.
create or replace function public.mm_card_fields()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_object_agg(kind, keys), '{}'::jsonb)
    from (
      select kind,
             coalesce(
               jsonb_agg(key order by position) filter (where enabled),
               '[]'::jsonb
             ) as keys
        from public.marketplace_card_fields
       group by kind
    ) t;
$$;

revoke all on function public.mm_card_fields() from public;
grant execute on function public.mm_card_fields() to anon, authenticated, service_role;

/* ------------------------------------------- 2. the fields with data in -- */

-- Licence and Platform were seeded off because the rule for this registry is
-- that a field stays off until there is something behind it. There is: the
-- coverage pass recorded licence at 67%, and Platform reads the same
-- `deployment` column, which the catalogue endpoint returns filled ("Cloud or
-- on-premise") for the products the home page shows. Both are switched on, and
-- an operator can switch either back off in Product Card Manager.
update public.marketplace_card_fields
   set enabled = true
 where key in ('license', 'platform')
   and kind = 'metadata'
   and not enabled;

-- Buy Now was seeded off with the note "no checkout is configured yet". A
-- checkout is configured: the button on the card opens the product page ready
-- to buy, and the add-to-cart mutation and the sign-in redirect both live
-- there. The card drew the button regardless of this row, so the switch in
-- Product Card Manager governed nothing. The card honours the switch now, which
-- means the row has to say what is actually true or the button would vanish
-- from the marketplace.
update public.marketplace_card_fields
   set enabled = true,
       hint = 'opens the product page ready to buy'
 where key = 'buy-now'
   and kind = 'action';

/* ----------------------------------------------- 3. the platform badges -- */

-- The six platform badges stay off. They are badges for per-platform support
-- and this database has no per-platform column, which is what their own hints
-- record. The card used to gate its Deployment field on platform/platform-web;
-- that is corrected in the card itself, not here, because the field it wants is
-- metadata/platform above.
