-- Closing the gaps left open in the first pass of prompt 26.

/* ------------------------------------------- 1. approved system facts (§26/§27) */

-- The facts an FAQ is allowed to state, counted from the live system.
--
-- Section 26 says the generator must use real Software Vala facts and never
-- invent them, and section 27 puts fact retrieval before generation. The
-- generator's prompt previously carried those figures hardcoded in a string,
-- which meant it would keep asserting them after they stopped being true.
--
-- Each fact carries the table it came from, so a draft can record its sources
-- and a person can check them. Anything that cannot be counted is absent rather
-- than guessed — an FAQ about it must be written by a human who knows.
create or replace function public.mm_faq_facts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_plans jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select jsonb_agg(jsonb_build_object(
           'name', name, 'price_usd', price_usd,
           'margin_percent', profit_percent, 'validity_days', validity_days)
         order by sort_order)
    into v_plans from public.reseller_membership_plans where enabled;

  return jsonb_build_object(
    'ok', true,
    'facts', jsonb_build_array(
      jsonb_build_object(
        'key','catalogue_size',
        'statement', format('%s software products are published on the marketplace.',
                            (select count(*) from public.marketplace_products where visible)),
        'source','marketplace_products'),
      jsonb_build_object(
        'key','categories',
        'statement', format('The catalogue is organised into %s categories.',
                            (select count(*) from public.marketplace_categories)),
        'source','marketplace_categories'),
      jsonb_build_object(
        'key','reseller_plans',
        'statement', format('Reseller plans: %s.',
          (select string_agg(format('%s at $%s for %s days, %s%% margin',
                                    p->>'name', p->>'price_usd', p->>'validity_days',
                                    p->>'margin_percent'), '; ')
             from jsonb_array_elements(coalesce(v_plans,'[]'::jsonb)) p)),
        'source','reseller_membership_plans'),
      jsonb_build_object(
        'key','demos',
        'statement', format('%s products have a live demo URL a buyer can open before paying.',
                            (select count(*) from public.marketplace_products
                              where visible and coalesce(btrim(demo_url),'') <> '')),
        'source','marketplace_products.demo_url'),
      jsonb_build_object(
        'key','payment_rails',
        'statement', format('Payment is taken through: %s.',
          coalesce((select string_agg(name, ', ' order by position)
                      from public.storefront_trust_items where kind='payment'), 'no rail configured')),
        'source','storefront_trust_items'),
      jsonb_build_object(
        'key','reviews',
        'statement', format('%s published customer review(s), every one tied to a real order line.',
                            (select count(*) from public.marketplace_reviews where status='published')),
        'source','marketplace_reviews')),

    -- Named so a draft cannot quietly assert them. Section 28's list, checked
    -- against what this database can actually evidence.
    'unverifiable', jsonb_build_array(
      jsonb_build_object('key','pricing',
        'note','Product prices are stored as free-text labels on marketplace_products, not as a single figure this function can assert. Source information required before an FAQ states a price.'),
      jsonb_build_object('key','delivery_time',
        'note','No delivery-time configuration exists in the database. Any delivery promise must come from a person, not from a count.'),
      jsonb_build_object('key','refunds_and_guarantees',
        'note','Refund terms live in the Legal Manager, not here. An FAQ must quote the published policy rather than paraphrase it.'),
      jsonb_build_object('key','certifications',
        'note','No compliance certification is recorded anywhere in this system.')));
end;
$$;

/* ---------------------------------------- 2. review analytics over a window (§9) */

-- Review analytics for a date range.
--
-- The first pass reported lifetime figures only, so the 7D/30D/90D/1Y filters
-- in the specification had nothing behind them. Everything here is counted
-- inside the window; a rate whose denominator is zero comes back null rather
-- than as a misleading 0%.
create or replace function public.mm_review_analytics(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_from timestamptz; v_published integer; v_decided integer; v_total integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  v_from := now() - (greatest(least(coalesce(p_days,30), 3650), 1) || ' days')::interval;

  select count(*) filter (where status='published'),
         count(*) filter (where status in ('published','rejected')),
         count(*)
    into v_published, v_decided, v_total
    from public.marketplace_reviews where created_at >= v_from;

  return jsonb_build_object(
    'ok', true, 'days', p_days, 'from', v_from,
    'volume', v_total,
    'published', v_published,
    'average_rating', (select round(avg(rating)::numeric,2) from public.marketplace_reviews
                        where status='published' and created_at >= v_from),
    'distribution', coalesce((
      select jsonb_object_agg(rating::text, n)
        from (select rating, count(*) n from public.marketplace_reviews
               where status='published' and created_at >= v_from group by rating) t), '{}'::jsonb),

    -- Every review is bound to an order line, so this is always 100 when there
    -- are any. It is computed rather than asserted so it stays true if that
    -- constraint ever changes.
    'verified_percent', case when v_total = 0 then null
      else round(100.0 * (select count(*) from public.marketplace_reviews
                           where created_at >= v_from and order_item_id is not null) / v_total, 1) end,

    'approval_rate', case when v_decided = 0 then null
      else round(100.0 * v_published / v_decided, 1) end,
    'rejection_rate', case when v_decided = 0 then null
      else round(100.0 * (v_decided - v_published) / v_decided, 1) end,
    'report_rate', case when v_total = 0 then null
      else round(100.0 * (select count(distinct review_id) from public.review_reports
                           where created_at >= v_from) / v_total, 1) end,
    'response_rate', case when v_published = 0 then null
      else round(100.0 * (select count(distinct rp.review_id)
                            from public.review_replies rp
                            join public.marketplace_reviews r on r.id = rp.review_id
                           where rp.status='published' and r.created_at >= v_from) / v_published, 1) end,

    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'reviews', n, 'average', avg_r) order by d)
        from (select date_trunc('day', created_at)::date d, count(*) n,
                     round(avg(rating)::numeric,2) avg_r
                from public.marketplace_reviews
               where created_at >= v_from group by 1) t), '[]'::jsonb),

    'by_product', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product_id', t.product_id,
               'product', (select name from public.marketplace_products p where p.id = t.product_id),
               'reviews', t.n, 'average', t.avg_r) order by t.n desc)
        from (select product_id, count(*) n, round(avg(rating)::numeric,2) avg_r
                from public.marketplace_reviews
               where status='published' and created_at >= v_from
               group by product_id limit 20) t), '[]'::jsonb),

    -- Seller-side ratings, joined through the product's owner. Empty while the
    -- catalogue is first-party, which is the honest answer rather than a zero.
    'by_seller', coalesce((
      select jsonb_agg(jsonb_build_object(
               'seller_id', t.seller_id, 'seller', t.display_name, 'kind', t.seller_kind,
               'reviews', t.n, 'average', t.avg_r) order by t.n desc)
        from (select s.id seller_id, s.display_name, s.seller_kind,
                     count(*) n, round(avg(r.rating)::numeric,2) avg_r
                from public.marketplace_reviews r
                join public.marketplace_products p on p.id = r.product_id
                join public.marketplace_sellers s on s.id = p.seller_id
               where r.status='published' and r.created_at >= v_from
               group by s.id, s.display_name, s.seller_kind) t), '[]'::jsonb));
end;
$$;

/* --------------------------------------------- 3. FAQ structured data (§31) */

-- The published FAQs as schema.org FAQPage JSON-LD.
--
-- Built from the same rows the storefront renders, so the structured data can
-- never describe questions the page does not show — which is what gets a site
-- penalised for it.
create or replace function public.sf_faq_schema()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    '@context', 'https://schema.org',
    '@type', 'FAQPage',
    'mainEntity', coalesce((
      select jsonb_agg(jsonb_build_object(
               '@type','Question',
               'name', f.question,
               'acceptedAnswer', jsonb_build_object('@type','Answer','text', f.answer))
             order by c.position, f.position)
        from public.faqs f
        left join public.faq_categories c on c.id = f.category_id
       where f.status='published' and f.language='en'), '[]'::jsonb));
$$;

grant execute on function public.sf_faq_schema() to anon, authenticated;
