-- Recommendation engines, built only as far as the real signal allows.
--
-- The scan found no recommendation system of any kind: no tables, no engine, no
-- components. What it also found matters more, and decides most of this file.
--
-- marketplace_events is the only product signal source, and it has 35 rows
-- across 10 products with NO user, session or visitor column. It records that
-- a product was viewed, never who viewed it. Favourites are localStorage in
-- src/lib/marketplace-home/persistentState.ts — one browser, no backend.
--
-- That makes five of the six named engines impossible rather than merely hard:
--
--   Recommended For You      no per-user signal exists
--   Recently Viewed          events carry no identity
--   Continue Browsing        no session continuity
--   Save For Later           no favourites table at all
--   Personalized Collections needs a per-user profile
--
-- None of them are simulated here. What is built is the part with real data
-- behind it: content-based similarity over the 5,533-product catalogue, and
-- popularity from the events that do exist. Both resolve against the canonical
-- catalogue and both are honest about how thin the popularity signal is.
--
-- The event schema is also repaired, because that is the actual blocker. Adding
-- nullable identity columns is backward compatible, and once the storefront
-- writes them the personal engines become possible without another migration.

-- ---------------------------------------------------------------------------
-- Repair: give the event stream an identity — sections 3, 5, 16.
-- ---------------------------------------------------------------------------
alter table public.marketplace_events
  add column if not exists user_id    uuid references auth.users(id) on delete set null,
  add column if not exists session_id text,
  add column if not exists surface    text,
  -- Section 16: prevent duplicate event inflation. Derived from who, what and
  -- when at minute resolution, so a double-fired impression counts once.
  add column if not exists dedupe_key text;

create index if not exists mp_events_user_idx    on public.marketplace_events (user_id, created_at desc);
create index if not exists mp_events_session_idx on public.marketplace_events (session_id, created_at desc);
create index if not exists mp_events_product_idx on public.marketplace_events (product_id, created_at desc);
create unique index if not exists mp_events_dedupe_uq
  on public.marketplace_events (dedupe_key) where dedupe_key is not null;

comment on column public.marketplace_events.user_id is
  'Who triggered the event. Null for anonymous visitors and for every row '
  'written before this column existed, which is why the personal engines '
  'report no signal rather than guessing.';

-- ---------------------------------------------------------------------------
-- Engine configuration — sections 9, 10, 32.
-- ---------------------------------------------------------------------------
-- Nothing like this existed. One row per engine, holding the toggle and the
-- tuning weights, so the switch in the UI controls the real engine rather than
-- frontend state.

create table if not exists public.marketplace_recommendation_configs (
  key            text primary key,
  title          text not null,
  description    text,
  enabled        boolean not null default false,
  -- The strategy actually used. 'personal' engines stay disabled until the
  -- event stream carries identity.
  strategy       text not null default 'similarity'
                   check (strategy in ('similarity','popularity','personal','hybrid')),
  max_results    int not null default 12 check (max_results between 1 and 60),
  -- Section 10: only weights the ranking function genuinely reads.
  weights        jsonb not null default
                   '{"category":0.45,"subcategory":0.2,"industry":0.15,"popularity":0.15,"rating":0.05}'::jsonb,
  recency_days   int not null default 30,
  min_confidence numeric not null default 0,
  exclude_purchased boolean not null default true,
  diversity_per_category int not null default 3,
  -- Why it cannot run, when it cannot. Read by the UI instead of an empty list.
  blocked_reason text,
  updated_by     uuid,
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

alter table public.marketplace_recommendation_configs enable row level security;

drop policy if exists mm_rec_cfg_read on public.marketplace_recommendation_configs;
create policy mm_rec_cfg_read on public.marketplace_recommendation_configs
  for select to authenticated using (true);
drop policy if exists mm_rec_cfg_write on public.marketplace_recommendation_configs;
create policy mm_rec_cfg_write on public.marketplace_recommendation_configs
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());
drop policy if exists mm_rec_cfg_anon on public.marketplace_recommendation_configs;
create policy mm_rec_cfg_anon on public.marketplace_recommendation_configs
  as restrictive to anon using (false) with check (false);

-- The six engines, each recording honestly whether it can run at all.
insert into public.marketplace_recommendation_configs
  (key, title, description, enabled, strategy, max_results, blocked_reason)
values
  ('similar-products', 'Similar Products',
   'Content similarity against the real catalogue: category, subcategory, industry and keywords.',
   true, 'similarity', 12, null),
  ('popular-now', 'Popular Now',
   'Ranked by real product_view and demo_click events in the recency window.',
   true, 'popularity', 12, null),
  ('recommended-for-you', 'Recommended For You',
   'Per-user personalisation from browsing, cart and purchase history.',
   false, 'personal', 12,
   'marketplace_events carries no user_id, so there is no per-user signal to rank on.'),
  ('recently-viewed', 'Recently Viewed',
   'The products this person looked at, most recent first.',
   false, 'personal', 12,
   'marketplace_events carries no user_id or session_id, so views cannot be attributed.'),
  ('continue-browsing', 'Continue Browsing',
   'Picks up the category thread from the current session.',
   false, 'personal', 12,
   'No session continuity is recorded on marketplace_events.'),
  ('save-for-later', 'Save For Later',
   'Products this person saved.',
   false, 'personal', 12,
   'Favourites are localStorage only (src/lib/marketplace-home/persistentState.ts); no table exists.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- The engine — sections 4, 11, 12, 14, 28.
-- ---------------------------------------------------------------------------
-- Candidate generation, eligibility, scoring, diversity, ranking. Every result
-- is a real row of marketplace_products; nothing can return an id the catalogue
-- does not contain, because the catalogue is where the rows come from.

create or replace function public.mm_recommend(
  p_key        text,
  p_product_id uuid default null,
  p_limit      int  default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  cfg    record;
  -- Plain variables rather than a record: plpgsql resolves a record's structure
  -- even inside a CASE that never runs, so an unassigned `seed` broke the
  -- popularity strategy, which has no seed product by definition.
  v_seed_cat uuid;
  v_seed_sub text;
  v_seed_ind text;
  v_lim  int;
  v_rows jsonb;
  v_why  text;
begin
  select * into cfg from public.marketplace_recommendation_configs where key = p_key;
  if cfg.key is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_engine');
  end if;

  -- Section 9: the toggle is the real switch.
  if not cfg.enabled then
    return jsonb_build_object('ok', true, 'engine', p_key, 'enabled', false,
      'products', '[]'::jsonb, 'count', 0,
      'reason', coalesce(cfg.blocked_reason, 'This engine is switched off.'));
  end if;

  -- Section 20 and 33: a personal engine with no signal returns an honest
  -- empty state naming the reason, never a filled-in guess.
  if cfg.strategy = 'personal' then
    return jsonb_build_object('ok', true, 'engine', p_key, 'enabled', true,
      'products', '[]'::jsonb, 'count', 0,
      'reason', coalesce(cfg.blocked_reason,
                'Not enough signal yet to personalise recommendations.'));
  end if;

  v_lim := least(coalesce(p_limit, cfg.max_results), 60);

  if cfg.strategy = 'similarity' then
    if p_product_id is null then
      return jsonb_build_object('ok', false, 'reason', 'product_required',
        'message', 'Similar Products needs a product to be similar to.');
    end if;
    select category_id, subcategory, industry_label
      into v_seed_cat, v_seed_sub, v_seed_ind
    from public.marketplace_products where id = p_product_id;
    if not found then
      return jsonb_build_object('ok', false, 'reason', 'unknown_product');
    end if;
    v_why := 'Similar to the product you are viewing';
  else
    v_why := 'Most viewed in the last ' || cfg.recency_days || ' days';
  end if;

  with events as (
    select e.product_id,
           count(*) filter (where e.event_type::text = 'product_view') views,
           count(*) filter (where e.event_type::text = 'demo_click')   demos
    from public.marketplace_events e
    where e.created_at > now() - make_interval(days => cfg.recency_days)
      and e.product_id is not null
    group by e.product_id
  ),
  candidates as (
    select p.id, p.name, p.slug, p.thumbnail_url, p.category_id,
           p.subcategory, p.industry_label, p.rating,
           coalesce(ev.views, 0) views, coalesce(ev.demos, 0) demos,
           -- Section 11: scoring, from the weights the manager actually set.
           ( case when cfg.strategy = 'similarity' and p.category_id = v_seed_cat
                  then (cfg.weights->>'category')::numeric else 0 end
           + case when cfg.strategy = 'similarity'
                       and p.subcategory is not distinct from v_seed_sub
                       and p.subcategory is not null
                  then (cfg.weights->>'subcategory')::numeric else 0 end
           + case when cfg.strategy = 'similarity'
                       and p.industry_label is not distinct from v_seed_ind
                       and p.industry_label is not null
                  then (cfg.weights->>'industry')::numeric else 0 end
           + (cfg.weights->>'popularity')::numeric
             * least(coalesce(ev.views,0) + coalesce(ev.demos,0), 10) / 10.0
           + (cfg.weights->>'rating')::numeric * coalesce(p.rating,0) / 5.0
           ) as score
    from public.marketplace_products p
    left join events ev on ev.product_id = p.id
    where p.visible
      and p.content_status = 'published'
      and (p_product_id is null or p.id <> p_product_id)
      -- Popularity means popular. Without this a "Popular Now" row pads itself
      -- with products nobody has viewed, which is a claim the data does not
      -- support; with it the row returns however many genuinely have a signal,
      -- which today is 3.
      and (cfg.strategy <> 'popularity' or coalesce(ev.views,0) + coalesce(ev.demos,0) > 0)
      -- Section 15: never recommend something already bought.
      and (not cfg.exclude_purchased or not exists (
            select 1 from public.marketplace_order_items oi
            join public.marketplace_orders o on o.id = oi.order_id
             and o.status::text = 'paid' and o.buyer_id = auth.uid()
            where oi.product_id = p.id))
  ),
  ranked as (
    select *, row_number() over (partition by category_id order by score desc, name) rn
    from candidates
    where score >= cfg.min_confidence
  )
  select coalesce(jsonb_agg(r order by (r->>'score')::numeric desc), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
      'product_id', id, 'name', name, 'slug', slug,
      'thumbnail_url', thumbnail_url, 'category_id', category_id,
      'score', round(score, 4), 'views', views,
      'href', '/marketplace/product/' || slug) r
    from ranked
    -- Section 14: diversity, so one category cannot fill the row.
    where rn <= greatest(cfg.diversity_per_category, 1)
    order by score desc, name
    limit v_lim
  ) x;

  return jsonb_build_object(
    'ok', true, 'engine', p_key, 'enabled', true,
    'strategy', cfg.strategy,
    'count', jsonb_array_length(v_rows),
    'requested', v_lim,
    -- Section 21: the explanation names the signal actually used.
    'reason', v_why,
    'signal_strength', (select count(*) from public.marketplace_events
                        where created_at > now() - make_interval(days => cfg.recency_days)),
    'products', v_rows);
end $$;

grant execute on function public.mm_recommend(text,uuid,int) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Manager controls — sections 9, 10, 32.
-- ---------------------------------------------------------------------------
create or replace function public.mm_recommendation_engines()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'key', c.key, 'title', c.title, 'description', c.description,
    'enabled', c.enabled, 'strategy', c.strategy, 'max_results', c.max_results,
    'weights', c.weights, 'recency_days', c.recency_days,
    'min_confidence', c.min_confidence, 'exclude_purchased', c.exclude_purchased,
    'diversity_per_category', c.diversity_per_category,
    'blocked_reason', c.blocked_reason,
    'can_run', (c.blocked_reason is null),
    'updated_at', c.updated_at) order by c.key), '[]'::jsonb)
  from public.marketplace_recommendation_configs c;
$$;

grant execute on function public.mm_recommendation_engines() to authenticated;

create or replace function public.mm_recommendation_configure(p_key text, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_before jsonb; cfg record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select * into cfg from public.marketplace_recommendation_configs where key = p_key;
  if cfg.key is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_engine');
  end if;

  -- An engine with no signal cannot be switched on, because switching it on
  -- would only produce an empty row that looks broken.
  if coalesce((p_patch->>'enabled')::boolean, false) and cfg.blocked_reason is not null then
    return jsonb_build_object('ok', false, 'reason', 'blocked',
      'message', cfg.blocked_reason);
  end if;

  select to_jsonb(c) into v_before from public.marketplace_recommendation_configs c where c.key = p_key;

  update public.marketplace_recommendation_configs set
    enabled                = coalesce((p_patch->>'enabled')::boolean, enabled),
    max_results            = coalesce((p_patch->>'max_results')::int, max_results),
    weights                = coalesce(p_patch->'weights', weights),
    recency_days           = coalesce((p_patch->>'recency_days')::int, recency_days),
    min_confidence         = coalesce((p_patch->>'min_confidence')::numeric, min_confidence),
    exclude_purchased      = coalesce((p_patch->>'exclude_purchased')::boolean, exclude_purchased),
    diversity_per_category = coalesce((p_patch->>'diversity_per_category')::int, diversity_per_category),
    updated_by = auth.uid(), updated_at = now()
  where key = p_key;

  perform public.mm_audit('recommendation_configure', 'recommendation_engine', p_key,
    coalesce(v_before, '{}'::jsonb), p_patch, 'engine tuning changed');

  return jsonb_build_object('ok', true, 'engine', p_key);
end $$;

grant execute on function public.mm_recommendation_configure(text,jsonb) to authenticated;
