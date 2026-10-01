-- A processed refund now reaches the order.
--
-- mm_refund_request records a refund as 'pending' and says "the order stays
-- paid until the provider confirms it". Nothing ever acted on that
-- confirmation: a refund marked 'processed' left the order 'paid', the
-- buyer's licence active and every commission on the sale standing.
--
-- When the processed refunds on an order cover its total, this trigger does
-- what the platform's existing pieces already define for a refund, in one
-- transaction:
--   * the order moves to 'refunded' (a value its CHECK already allows)
--   * access is withdrawn as revokeOrderAccess does - licences and
--     entitlements in both the purchase tables and the marketplace tables
--   * reseller commission is reversed by reseller_commissions_reverse
--   * author/vendor commission is reversed as reverseCommissionsForOrder
--     does: a reversal row citing the refund, and the original marked reversed
--   * partner (affiliate/influencer) commission is reversed as
--     reverse_partner_commission does: a cancelling row and the original
--     marked, never one already paid out - that is reported for a person
-- A partial refund changes none of this; it is recorded in the audit log.
-- processed_at is stamped when a refund reaches 'processed'.

begin;

create or replace function public.marketplace_refund_stamp()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'processed' and new.processed_at is null then
    new.processed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists marketplace_refund_stamp on public.marketplace_order_refunds;
create trigger marketplace_refund_stamp
  before insert or update of status on public.marketplace_order_refunds
  for each row execute function public.marketplace_refund_stamp();

create or replace function public.marketplace_refund_settle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o public.marketplace_orders%rowtype;
  v_refunded numeric;
  v_licences integer := 0;
  v_entitlements integer := 0;
  v_mp_licences integer := 0;
  v_mp_entitlements integer := 0;
  v_reseller jsonb;
  v_author integer := 0;
  v_partner integer := 0;
  v_partner_paid integer := 0;
  c record;
  v_cancelling uuid;
begin
  if new.status <> 'processed' or (tg_op = 'UPDATE' and old.status = 'processed') then
    return new;
  end if;

  select * into o from public.marketplace_orders where id = new.order_id for update;
  if o.id is null then
    return new;
  end if;

  select coalesce(sum(amount), 0) into v_refunded
    from public.marketplace_order_refunds
   where order_id = o.id and status = 'processed';

  if v_refunded < o.total then
    perform public.mm_audit('order_refund_partial', 'marketplace_order', o.id::text, null,
      jsonb_build_object('refund_id', new.id, 'refunded', v_refunded, 'total', o.total),
      'Partial refund processed; the order keeps its status and access.');
    return new;
  end if;

  if o.status not in ('paid', 'processing', 'fulfilled', 'completed', 'disputed') then
    return new;
  end if;

  update public.marketplace_orders set status = 'refunded', updated_at = now() where id = o.id;

  update public.licenses
     set status = 'revoked', revoked_at = now(), revoked_reason = 'refund', updated_at = now()
   where order_id = o.id and status = 'active';
  get diagnostics v_licences = row_count;

  update public.entitlements set status = 'revoked', revoked_at = now()
   where order_id = o.id and status = 'active';
  get diagnostics v_entitlements = row_count;

  update public.marketplace_licenses set status = 'revoked'
   where order_item_id in (select id from public.marketplace_order_items where order_id = o.id)
     and status in ('issued', 'active');
  get diagnostics v_mp_licences = row_count;

  update public.marketplace_entitlements set status = 'revoked'
   where order_item_id in (select id from public.marketplace_order_items where order_id = o.id)
     and status = 'active';
  get diagnostics v_mp_entitlements = row_count;

  v_reseller := public.reseller_commissions_reverse(o.id, 'refund');

  for c in
    select mc.id, mc.seller_amount
      from public.marketplace_commissions mc
      join public.marketplace_order_items i on i.id = mc.order_item_id
     where i.order_id = o.id and mc.status <> 'reversed'
  loop
    if coalesce(c.seller_amount, 0) > 0 then
      insert into public.marketplace_commission_reversals (commission_id, refund_id, amount, reason)
      values (c.id, new.id, c.seller_amount, 'refund')
      on conflict (commission_id, refund_id) do nothing;
    end if;
    update public.marketplace_commissions set status = 'reversed' where id = c.id;
    v_author := v_author + 1;
  end loop;

  select count(*) into v_partner_paid
    from public.partner_commissions where order_id = o.id and status = 'paid';
  for c in
    select * from public.partner_commissions
     where order_id = o.id and status in ('pending', 'approved') and reversed_by is null
       and commission_amount > 0
  loop
    insert into public.partner_commissions (
      partner_kind, partner_id, order_id, order_item_id, attribution_id, click_id,
      gross_amount, commission_amount, currency, rule_snapshot, status, reversal_reason
    ) values (
      c.partner_kind, c.partner_id, c.order_id, c.order_item_id, c.attribution_id, c.click_id,
      -c.gross_amount, -c.commission_amount, c.currency, c.rule_snapshot, 'reversed', 'refund'
    ) returning id into v_cancelling;
    update public.partner_commissions
       set status = 'reversed', reversed_by = v_cancelling, reversal_reason = 'refund', updated_at = now()
     where id = c.id;
    v_partner := v_partner + 1;
  end loop;

  perform public.mm_audit('order_refunded', 'marketplace_order', o.id::text,
    jsonb_build_object('status', o.status),
    jsonb_build_object('status', 'refunded', 'refund_id', new.id, 'refunded', v_refunded,
      'licences_revoked', v_licences, 'entitlements_revoked', v_entitlements,
      'marketplace_licences_revoked', v_mp_licences,
      'marketplace_entitlements_revoked', v_mp_entitlements,
      'reseller', v_reseller, 'author_commissions_reversed', v_author,
      'partner_commissions_reversed', v_partner,
      'partner_commissions_already_paid', v_partner_paid),
    case when v_partner_paid > 0 or coalesce((v_reseller->>'already_paid')::int, 0) > 0
      then 'Full refund processed. Some partner commission was already paid out and needs a manual adjustment.'
      else 'Full refund processed.' end);

  return new;
end $$;

revoke all on function public.marketplace_refund_settle() from public, anon, authenticated;
revoke all on function public.marketplace_refund_stamp() from public, anon, authenticated;

drop trigger if exists marketplace_refund_settle on public.marketplace_order_refunds;
create trigger marketplace_refund_settle
  after insert or update of status on public.marketplace_order_refunds
  for each row execute function public.marketplace_refund_settle();

commit;
