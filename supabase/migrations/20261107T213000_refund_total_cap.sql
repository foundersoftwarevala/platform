-- Refunds on an order can never add up to more than the order.
--
-- mm_refund_request checked each request against the order total on its own,
-- and the Refunds wall lets an operator move a refund to 'processed'. Two
-- requests of 60 on an order of 100 were both accepted, and once both were
-- processed the order showed 120 returned on a sale of 100 (reproduced inside
-- a rolled-back transaction by scripts/ops/reseller-money-flow-verify.sql).
--
-- The rule now lives on the table, so it holds for every writer: the request
-- function, the wall, a webhook or a hand-written statement. A refund that is
-- pending, approved or processed counts toward the cap; a failed or cancelled
-- one does not, so it can be requested again. The order row is locked first,
-- so two refunds arriving together are added up one after the other.
--
-- mm_refund_request also says how much is still refundable instead of letting
-- the table raise, so the operator sees a plain answer.

begin;

create or replace function public.marketplace_refund_cap()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare v_total numeric; v_other numeric;
begin
  if new.status not in ('pending', 'approved', 'processed') then
    return new;
  end if;
  select o.total into v_total from public.marketplace_orders o where o.id = new.order_id for update;
  select coalesce(sum(r.amount), 0) into v_other
    from public.marketplace_order_refunds r
   where r.order_id = new.order_id
     and r.id is distinct from new.id
     and r.status in ('pending', 'approved', 'processed');
  if v_other + new.amount > v_total then
    raise exception 'Refunds on order % would total %, more than the order total of %. Still refundable: %.',
      new.order_id, v_other + new.amount, v_total, greatest(v_total - v_other, 0)
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists marketplace_refund_cap on public.marketplace_order_refunds;
create trigger marketplace_refund_cap
  before insert or update of amount, status, order_id on public.marketplace_order_refunds
  for each row execute function public.marketplace_refund_cap();

-- The request function answers with what is left before the table would refuse.
do $$
declare def text; changed text;
begin
  def := pg_get_functiondef('public.mm_refund_request(uuid,numeric,text)'::regprocedure);
  if position('refund_exceeds_remaining' in def) > 0 then
    return;
  end if;
  changed := replace(def,
    E'  v_provider := coalesce(o.payment_gateway, ''unconfigured'');',
    E'  if p_amount + (select coalesce(sum(r.amount), 0) from public.marketplace_order_refunds r\n'
    || E'                  where r.order_id = p_order_id and r.status in (''pending'', ''approved'', ''processed'')) > o.total then\n'
    || E'    return jsonb_build_object(''ok'', false, ''reason'', ''refund_exceeds_remaining'',\n'
    || E'      ''message'', ''Refunds already requested on this order leave '' || greatest(o.total - (select coalesce(sum(r.amount), 0)\n'
    || E'        from public.marketplace_order_refunds r where r.order_id = p_order_id\n'
    || E'        and r.status in (''pending'', ''approved'', ''processed'')), 0)::text || '' refundable.'');\n'
    || E'  end if;\n\n'
    || E'  v_provider := coalesce(o.payment_gateway, ''unconfigured'');');
  if changed = def then
    raise exception 'mm_refund_request did not match the expected body; nothing changed';
  end if;
  execute changed;
end $$;

commit;
