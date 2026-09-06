-- Orders Center, on the commerce data that already exists.
--
-- The screen currently renders a hardcoded array at EnterpriseCommerce.tsx:1408
-- — SV-8842 "Aurora Systems Pvt Ltd", SV-8841 "ByteForge Studios" and so on.
-- None of those orders exist. The real ones are MPO-3DA53CE7F5B7 and its
-- siblings, and they have been sitting in marketplace_orders the whole time.
--
-- Searching first paid off, because almost nothing here needed building:
--
--   All Orders   marketplace_orders + marketplace_order_items      exists
--   Invoices     finance_invoices, doc_type='invoice', with the order carried
--                in line_items.meta — the convention src/lib/commerce/invoices.ts
--                already established                               exists
--   Proforma     finance_invoices, doc_type='proforma'             column exists
--   Credit Notes finance_invoices, doc_type='credit_note'          9 already there
--   Refunds      marketplace_order_refunds                         exists
--   Disputes     nothing, under any name                           the one new table
--
-- So this creates a single table and otherwise reads what is already there.

create table if not exists public.marketplace_disputes (
  id             uuid primary key default gen_random_uuid(),
  dispute_no     text not null unique
                   default 'DSP-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 10)),
  order_id       uuid not null references public.marketplace_orders(id) on delete restrict,
  buyer_id       uuid references auth.users(id) on delete set null,
  payment_reference text,
  amount         numeric not null default 0,
  currency       text not null default 'USD',
  reason         text not null,
  -- Evidence is a list of notes and document references rather than a blob, so
  -- the timeline can show who added what and when.
  evidence       jsonb not null default '[]'::jsonb,
  status         text not null default 'open'
                   check (status in ('open','under_review','evidence_required',
                                     'won','lost','withdrawn','resolved')),
  assigned_to    uuid references auth.users(id) on delete set null,
  resolution     text,
  opened_at      timestamptz not null default now(),
  resolved_at    timestamptz,
  created_by     uuid,
  updated_at     timestamptz not null default now()
);

create index if not exists mm_disputes_order_idx on public.marketplace_disputes (order_id);
create index if not exists mm_disputes_status_idx on public.marketplace_disputes (status, opened_at desc);

comment on table public.marketplace_disputes is
  'Payment disputes against marketplace orders. The only Orders Center table that '
  'did not already exist; invoices, proforma and credit notes reuse finance_invoices.doc_type.';

-- ---------------------------------------------------------------------------
-- Indexes the Orders Center actually queries on — section 31.
-- ---------------------------------------------------------------------------
create index if not exists mm_orders_created_idx on public.marketplace_orders (created_at desc);
create index if not exists mm_orders_status_idx  on public.marketplace_orders (status, created_at desc);
create index if not exists mm_orders_buyer_idx   on public.marketplace_orders (buyer_id);
create index if not exists mm_orders_number_idx  on public.marketplace_orders (order_number);
create index if not exists mm_order_items_order_idx on public.marketplace_order_items (order_id);

-- ---------------------------------------------------------------------------
-- Authorization — section 29.
-- ---------------------------------------------------------------------------
alter table public.marketplace_disputes enable row level security;

drop policy if exists mm_disputes_read on public.marketplace_disputes;
create policy mm_disputes_read on public.marketplace_disputes
  for select to authenticated
  using (buyer_id = auth.uid() or public.mm_is_operator());

drop policy if exists mm_disputes_write on public.marketplace_disputes;
create policy mm_disputes_write on public.marketplace_disputes
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

drop policy if exists mm_disputes_anon_denied on public.marketplace_disputes;
create policy mm_disputes_anon_denied on public.marketplace_disputes
  as restrictive to anon using (false) with check (false);

-- ---------------------------------------------------------------------------
-- The order list — server-side search, filter, sort and pagination.
-- ---------------------------------------------------------------------------
-- Sections 3, 4, 5 and 31 together: the whole query happens in the database, so
-- the screen never loads thousands of orders to filter them in the browser.

create or replace function public.mm_orders_list(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_search  text := nullif(trim(coalesce(p_query->>'search','')), '');
  v_status  text := nullif(p_query->>'status','');
  v_pay     text := nullif(p_query->>'payment_status','');
  v_gateway text := nullif(p_query->>'gateway','');
  v_currency text := nullif(p_query->>'currency','');
  v_from    timestamptz := nullif(p_query->>'from','')::timestamptz;
  v_to      timestamptz := nullif(p_query->>'to','')::timestamptz;
  v_min     numeric := nullif(p_query->>'min_amount','')::numeric;
  v_max     numeric := nullif(p_query->>'max_amount','')::numeric;
  v_product uuid := nullif(p_query->>'product_id','')::uuid;
  v_sort    text := coalesce(p_query->>'sort','newest');
  v_limit   int  := least(coalesce((p_query->>'limit')::int, 25), 100);
  v_offset  int  := greatest(coalesce((p_query->>'offset')::int, 0), 0);
  v_total   bigint;
  v_rows    jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  with scoped as (
    select o.id
    from public.marketplace_orders o
    where (v_status is null or o.status::text = v_status)
      and (v_currency is null or o.currency::text = v_currency)
      and (v_gateway is null or coalesce(o.payment_gateway,'') = v_gateway)
      and (v_from is null or o.created_at >= v_from)
      and (v_to   is null or o.created_at <  v_to)
      and (v_min  is null or o.total >= v_min)
      and (v_max  is null or o.total <= v_max)
      and (v_pay  is null or coalesce(o.payu_status, o.status::text) = v_pay)
      and (v_product is null or exists (
             select 1 from public.marketplace_order_items i
             where i.order_id = o.id and i.product_id = v_product))
      -- Section 3: order number, customer email, product name and the payment
      -- reference are all searchable, in the database rather than the browser.
      and (v_search is null
           or o.order_number ilike '%' || v_search || '%'
           or coalesce(o.txnid,'') ilike '%' || v_search || '%'
           or coalesce(o.payu_txn_id,'') ilike '%' || v_search || '%'
           or exists (select 1 from auth.users u
                      where u.id = o.buyer_id and u.email ilike '%' || v_search || '%')
           or exists (select 1 from public.marketplace_order_items i
                      where i.order_id = o.id
                        and coalesce(i.product_name,'') ilike '%' || v_search || '%'))
  )
  select count(*) into v_total from scoped;

  select coalesce(jsonb_agg(r), '[]'::jsonb) into v_rows from (
    select jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'status', o.status::text,
      'payment_status', coalesce(o.payu_status, o.status::text),
      'payment_gateway', o.payment_gateway,
      'payment_reference', coalesce(o.payu_txn_id, o.txnid),
      'currency', o.currency::text,
      'subtotal', o.subtotal, 'tax_total', o.tax_total,
      'total', o.total,
      'amount_usd', o.amount_usd, 'amount_inr', o.amount_inr, 'fx_rate', o.fx_rate,
      'created_at', o.created_at, 'updated_at', o.updated_at,
      'customer', jsonb_build_object(
        'id', o.buyer_id,
        'email', (select u.email from auth.users u where u.id = o.buyer_id)),
      'items', (select coalesce(jsonb_agg(jsonb_build_object(
                   'product_id', i.product_id, 'name', i.product_name,
                   'seller_id', i.seller_id, 'quantity', i.quantity,
                   'unit_amount', i.unit_amount, 'line_total', i.line_total)), '[]'::jsonb)
                from public.marketplace_order_items i where i.order_id = o.id),
      -- Section 19: an order keeps its own snapshot of what was bought, so an
      -- unpublished product cannot rewrite history.
      'item_count', (select count(*) from public.marketplace_order_items i where i.order_id = o.id),
      'refund_status', (select r2.status from public.marketplace_order_refunds r2
                        where r2.order_id = o.id order by r2.created_at desc limit 1),
      'dispute_status', (select d.status from public.marketplace_disputes d
                         where d.order_id = o.id order by d.opened_at desc limit 1),
      'invoice_no', (select fi.invoice_no from public.finance_invoices fi
                     where fi.line_items::text like '%' || o.id::text || '%' limit 1)
    ) r
    from public.marketplace_orders o
    where (v_status is null or o.status::text = v_status)
      and (v_currency is null or o.currency::text = v_currency)
      and (v_gateway is null or coalesce(o.payment_gateway,'') = v_gateway)
      and (v_from is null or o.created_at >= v_from)
      and (v_to   is null or o.created_at <  v_to)
      and (v_min  is null or o.total >= v_min)
      and (v_max  is null or o.total <= v_max)
      and (v_pay  is null or coalesce(o.payu_status, o.status::text) = v_pay)
      and (v_product is null or exists (
             select 1 from public.marketplace_order_items i
             where i.order_id = o.id and i.product_id = v_product))
      and (v_search is null
           or o.order_number ilike '%' || v_search || '%'
           or coalesce(o.txnid,'') ilike '%' || v_search || '%'
           or coalesce(o.payu_txn_id,'') ilike '%' || v_search || '%'
           or exists (select 1 from auth.users u
                      where u.id = o.buyer_id and u.email ilike '%' || v_search || '%')
           or exists (select 1 from public.marketplace_order_items i
                      where i.order_id = o.id
                        and coalesce(i.product_name,'') ilike '%' || v_search || '%'))
    order by
      case when v_sort = 'newest'      then o.created_at end desc nulls last,
      case when v_sort = 'oldest'      then o.created_at end asc  nulls last,
      case when v_sort = 'amount_high' then o.total end desc nulls last,
      case when v_sort = 'amount_low'  then o.total end asc  nulls last,
      case when v_sort = 'status'      then o.status::text end asc nulls last,
      o.created_at desc
    limit v_limit offset v_offset
  ) x;

  return jsonb_build_object(
    'ok', true, 'total', v_total, 'limit', v_limit, 'offset', v_offset,
    'orders', v_rows);
end $$;

grant execute on function public.mm_orders_list(jsonb) to authenticated;
-- Order detail, the document tabs, and the two actions that change money.

-- ---------------------------------------------------------------------------
-- Order detail and its timeline — section 12.
-- ---------------------------------------------------------------------------
-- The timeline is assembled from records that already exist rather than from a
-- new events table: the order's own timestamps, marketplace_order_status_history,
-- the invoice, the refund and the dispute. Nothing is inferred — if a stage
-- never happened, it simply is not in the list.

create or replace function public.mm_order_detail(p_order_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o record; v_timeline jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select * into o from public.marketplace_orders where id = p_order_id;
  if o.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_order');
  end if;

  select coalesce(jsonb_agg(t order by t->>'at'), '[]'::jsonb) into v_timeline from (
    select jsonb_build_object('at', o.created_at, 'stage', 'Order created',
      'detail', o.order_number, 'source', 'marketplace_orders') t
    union all
    select jsonb_build_object('at', h.created_at, 'stage', 'Status changed',
      'detail', coalesce(h.from_status::text,'—') || ' to ' || coalesce(h.to_status::text,'—'),
      'source', 'marketplace_order_status_history')
    from public.marketplace_order_status_history h where h.order_id = o.id
    union all
    select jsonb_build_object('at', fi.issue_date::timestamptz, 'stage', 'Invoice issued',
      'detail', fi.invoice_no, 'source', 'finance_invoices')
    from public.finance_invoices fi
    where fi.line_items::text like '%' || o.id::text || '%'
    union all
    select jsonb_build_object('at', r.created_at, 'stage', 'Refund ' || r.status,
      'detail', r.amount::text || ' ' || coalesce(r.currency,''), 'source', 'marketplace_order_refunds')
    from public.marketplace_order_refunds r where r.order_id = o.id
    union all
    select jsonb_build_object('at', d.opened_at, 'stage', 'Dispute ' || d.status,
      'detail', d.dispute_no || ' — ' || d.reason, 'source', 'marketplace_disputes')
    from public.marketplace_disputes d where d.order_id = o.id
  ) x;

  return jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'id', o.id, 'order_number', o.order_number, 'status', o.status::text,
      'payment_status', coalesce(o.payu_status, o.status::text),
      'payment_gateway', o.payment_gateway,
      'payment_reference', coalesce(o.payu_txn_id, o.txnid),
      'currency', o.currency::text, 'subtotal', o.subtotal, 'tax_total', o.tax_total,
      'total', o.total, 'amount_usd', o.amount_usd, 'amount_inr', o.amount_inr,
      'fx_rate', o.fx_rate, 'created_at', o.created_at, 'updated_at', o.updated_at),
    'customer', jsonb_build_object('id', o.buyer_id,
      'email', (select u.email from auth.users u where u.id = o.buyer_id)),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
                'product_id', i.product_id, 'name', i.product_name,
                'seller_id', i.seller_id, 'quantity', i.quantity,
                'unit_amount', i.unit_amount, 'line_total', i.line_total,
                -- Section 19: the product may since have been unpublished. The
                -- line keeps the name it was bought under either way.
                'still_published', exists (select 1 from public.marketplace_products p
                                           where p.id = i.product_id and p.visible
                                             and p.content_status='published'))), '[]'::jsonb)
              from public.marketplace_order_items i where i.order_id = o.id),
    'invoice', (select jsonb_build_object('invoice_no', fi.invoice_no, 'status', fi.status,
                  'total', fi.total, 'issue_date', fi.issue_date, 'doc_type', fi.doc_type)
                from public.finance_invoices fi
                where fi.line_items::text like '%' || o.id::text || '%' limit 1),
    'refunds', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', r.id, 'amount', r.amount, 'status', r.status, 'reason', r.reason,
                  'provider', r.provider, 'created_at', r.created_at,
                  'processed_at', r.processed_at)), '[]'::jsonb)
                from public.marketplace_order_refunds r where r.order_id = o.id),
    'disputes', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', d.id, 'dispute_no', d.dispute_no, 'status', d.status,
                   'reason', d.reason, 'amount', d.amount, 'opened_at', d.opened_at,
                   'resolution', d.resolution)), '[]'::jsonb)
                 from public.marketplace_disputes d where d.order_id = o.id),
    'timeline', v_timeline);
end $$;

grant execute on function public.mm_order_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The document tabs — sections 14, 15, 16, 17, 18.
-- ---------------------------------------------------------------------------
create or replace function public.mm_order_docs(p_tab text, p_limit int default 50)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb; v_total bigint;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  if p_tab in ('invoices','proforma','credit_notes') then
    -- All three are finance_invoices rows distinguished by doc_type. That
    -- column already existed and already carried credit_note rows, so this
    -- reuses it rather than adding tables that would only differ by a label.
    select count(*) into v_total from public.finance_invoices fi
     where fi.doc_type = case p_tab when 'invoices' then 'invoice'
                                    when 'proforma' then 'proforma'
                                    else 'credit_note' end;
    select coalesce(jsonb_agg(r order by r->>'issue_date' desc), '[]'::jsonb) into v
    from (
      select jsonb_build_object(
        'id', fi.id, 'number', fi.invoice_no, 'doc_type', fi.doc_type,
        'client', fi.client_name, 'subtotal', fi.subtotal, 'tax', fi.tax_amount,
        'total', fi.total, 'status', fi.status, 'issue_date', fi.issue_date,
        'due_date', fi.due_date, 'paid_at', fi.paid_at,
        -- Section 16: a credit note must be traceable to its transaction.
        'order_id', fi.line_items #>> '{meta,order_id}',
        'linked_order', (select o.order_number from public.marketplace_orders o
                         where o.id::text = fi.line_items #>> '{meta,order_id}')) r
      from public.finance_invoices fi
      where fi.doc_type = case p_tab when 'invoices' then 'invoice'
                                     when 'proforma' then 'proforma'
                                     else 'credit_note' end
      order by fi.issue_date desc nulls last
      limit p_limit
    ) x;

  elsif p_tab = 'refunds' then
    select count(*) into v_total from public.marketplace_order_refunds;
    select coalesce(jsonb_agg(r order by r->>'created_at' desc), '[]'::jsonb) into v
    from (
      select jsonb_build_object(
        'id', rf.id, 'order_id', rf.order_id,
        'order_number', (select o.order_number from public.marketplace_orders o where o.id = rf.order_id),
        'amount', rf.amount, 'currency', rf.currency, 'status', rf.status,
        'reason', rf.reason, 'provider', rf.provider,
        'provider_refund_id', rf.provider_refund_id,
        'created_at', rf.created_at, 'processed_at', rf.processed_at) r
      from public.marketplace_order_refunds rf
      order by rf.created_at desc limit p_limit
    ) x;

  elsif p_tab = 'disputes' then
    select count(*) into v_total from public.marketplace_disputes;
    select coalesce(jsonb_agg(r order by r->>'opened_at' desc), '[]'::jsonb) into v
    from (
      select jsonb_build_object(
        'id', d.id, 'dispute_no', d.dispute_no, 'order_id', d.order_id,
        'order_number', (select o.order_number from public.marketplace_orders o where o.id = d.order_id),
        'amount', d.amount, 'currency', d.currency, 'status', d.status,
        'reason', d.reason, 'evidence_count', jsonb_array_length(d.evidence),
        'assigned_to', d.assigned_to, 'resolution', d.resolution,
        'opened_at', d.opened_at, 'resolved_at', d.resolved_at) r
      from public.marketplace_disputes d
      order by d.opened_at desc limit p_limit
    ) x;
  else
    return jsonb_build_object('ok', false, 'reason', 'unknown_tab');
  end if;

  return jsonb_build_object('ok', true, 'tab', p_tab, 'total', v_total,
                            'rows', coalesce(v, '[]'::jsonb));
end $$;

grant execute on function public.mm_order_docs(text,int) to authenticated;

-- ---------------------------------------------------------------------------
-- Refund — section 17.
-- ---------------------------------------------------------------------------
-- This records a refund *request*. It deliberately does not mark the order
-- refunded, because no payment provider is configured on this platform: PayU
-- has no credentials, so there is nothing to ask for the money back. Claiming
-- REFUNDED here would be exactly the fake payment status the rules forbid.

create or replace function public.mm_refund_request(
  p_order_id uuid, p_amount numeric, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare o record; v_id uuid; v_provider text; v_configured boolean;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select * into o from public.marketplace_orders where id = p_order_id;
  if o.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_order');
  end if;
  if o.status::text <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'not_paid',
      'message', 'Only a paid order can be refunded. This one is ' || o.status::text || '.');
  end if;
  if coalesce(p_amount, 0) <= 0 or p_amount > o.total then
    return jsonb_build_object('ok', false, 'reason', 'bad_amount',
      'message', 'A refund must be more than zero and no more than the order total.');
  end if;

  v_provider := coalesce(o.payment_gateway, 'unconfigured');
  -- A real provider reference is the only evidence money actually moved.
  v_configured := coalesce(o.payu_txn_id, o.txnid) is not null;

  -- The table's own vocabulary is pending / approved / processed / failed /
  -- cancelled, so a refund nobody has confirmed is 'pending' and processed_at
  -- stays null. Inventing a 'blocked' status would have meant widening a
  -- constraint to describe something 'pending' already says correctly; the
  -- reason it is stuck is recorded in payload instead.
  insert into public.marketplace_order_refunds
    (order_id, provider, amount, currency, status, reason, payload)
  values (p_order_id, v_provider, p_amount, o.currency::text, 'pending', p_reason,
          jsonb_build_object('provider_configured', v_configured,
                             'blocked_reason', case when v_configured then null
                               else 'no payment provider is configured for this order' end))
  returning id into v_id;

  perform public.mm_audit('order_refund_requested', 'marketplace_order', p_order_id::text,
    jsonb_build_object('status', o.status::text, 'total', o.total),
    jsonb_build_object('refund_id', v_id, 'amount', p_amount, 'provider', v_provider),
    coalesce(p_reason, 'refund requested'));

  if not v_configured then
    return jsonb_build_object('ok', true, 'refund_id', v_id,
      'status', 'pending', 'provider_configured', false,
      'message', 'Refund recorded, but no payment provider is configured for this order, '
                 'so no money has moved. The order status is unchanged.');
  end if;

  return jsonb_build_object('ok', true, 'refund_id', v_id, 'status', 'pending',
    'provider_configured', true,
    'message', 'Refund requested. The order stays paid until the provider confirms it.');
end $$;

grant execute on function public.mm_refund_request(uuid,numeric,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Dispute — section 18.
-- ---------------------------------------------------------------------------
create or replace function public.mm_dispute_open(
  p_order_id uuid, p_reason text, p_amount numeric default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare o record; v_id uuid; v_no text;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select * into o from public.marketplace_orders where id = p_order_id;
  if o.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_order');
  end if;
  if coalesce(trim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'reason_required');
  end if;

  insert into public.marketplace_disputes
    (order_id, buyer_id, payment_reference, amount, currency, reason, created_by)
  values (p_order_id, o.buyer_id, coalesce(o.payu_txn_id, o.txnid),
          coalesce(p_amount, o.total), o.currency::text, p_reason, auth.uid())
  returning id, dispute_no into v_id, v_no;

  perform public.mm_audit('order_dispute_opened', 'marketplace_order', p_order_id::text,
    '{}'::jsonb, jsonb_build_object('dispute_no', v_no, 'amount', coalesce(p_amount, o.total)),
    p_reason);

  return jsonb_build_object('ok', true, 'dispute_id', v_id, 'dispute_no', v_no,
    'message', 'Dispute ' || v_no || ' opened.');
end $$;

grant execute on function public.mm_dispute_open(uuid,text,numeric) to authenticated;

create or replace function public.mm_dispute_resolve(
  p_dispute_id uuid, p_status text, p_resolution text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare d record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select * into d from public.marketplace_disputes where id = p_dispute_id;
  if d.id is null then return jsonb_build_object('ok', false, 'reason', 'unknown_dispute'); end if;

  update public.marketplace_disputes
     set status = p_status, resolution = p_resolution,
         resolved_at = case when p_status in ('won','lost','withdrawn','resolved')
                            then now() else null end,
         updated_at = now()
   where id = p_dispute_id;

  perform public.mm_audit('order_dispute_resolved', 'marketplace_order', d.order_id::text,
    jsonb_build_object('status', d.status),
    jsonb_build_object('status', p_status), p_resolution);

  return jsonb_build_object('ok', true, 'dispute_no', d.dispute_no, 'status', p_status);
end $$;

grant execute on function public.mm_dispute_resolve(uuid,text,text) to authenticated;
-- A refund exists before the provider answers.
--
-- marketplace_order_refunds.provider_refund_id was NOT NULL, which means the
-- table could only ever hold refunds a provider had already confirmed. But the
-- flow in section 17 starts earlier than that — request, validate, authorize,
-- then call the provider — and a requested refund genuinely has no provider
-- reference yet.
--
-- The only ways to satisfy the old constraint were to invent a reference or to
-- refuse to record the request at all. Making the column nullable is backward
-- compatible: every existing row keeps its value, and a null now means exactly
-- what it should — the provider has not confirmed this one.
alter table public.marketplace_order_refunds
  alter column provider_refund_id drop not null;

comment on column public.marketplace_order_refunds.provider_refund_id is
  'The payment provider''s own refund id. Null until the provider confirms; a '
  'null here means no money has been moved yet.';
