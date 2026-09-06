-- Marketplace Health, Score and the Attention Center.
--
-- Sections 30, 31 and 12 all ask for the same discipline in three places: a
-- number on this console must be counted from the catalogue, and clicking it
-- must lead to the exact records it counted. A score that is decoration is
-- worse than no score, because somebody will report it upward.
--
-- Everything here counts. Nothing is weighted by guesswork that is not written
-- down, and every check returns the identifiers of what it found so the screen
-- can link straight to them.

-- A note on the catalogue's vocabulary, because it is not obvious. A product is
-- live when content_status is 'published' AND visible is true AND it is inside
-- its publish window; moderation_status is a separate approval queue. The
-- checks below use all three rather than a single status column, because that
-- is how this catalogue actually works.

-- ------------------------------------------------------------ the checks ----
-- One row per problem class, with a count and the records behind it.
create or replace function public.mm_health_checks()
returns table (
  check_key text,
  label text,
  severity text,
  affected bigint,
  destination text,
  sample_ids uuid[]
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with
  live as (
    select id, category_id, demo_url, description, thumbnail_url
    from public.marketplace_products
    where content_status = 'published'
      and visible
      and (publish_at is null or publish_at <= now())
      and (unpublish_at is null or unpublish_at > now())
  ),
  -- The full sets, uncapped: the count has to be the real count. Only the
  -- sample handed back to the screen is limited, because a console does not
  -- need five thousand identifiers to link to the first few.
  no_category    as (select id from live where category_id is null),
  no_price       as (select l.id from live l
                     where not exists (select 1 from public.marketplace_product_pricing pr
                                       where pr.product_id = l.id)),
  no_demo        as (select id from live where coalesce(demo_url, '') = ''),
  no_description as (select id from live where coalesce(length(description), 0) < 40),
  pending        as (select id from public.marketplace_products
                     where moderation_status not in ('approved','archived')),
  no_media       as (select id from live where coalesce(thumbnail_url, '') = '')
  select 'products_without_category', 'Published products with no category', 'high',
         (select count(*) from no_category), '/marketplace-manager?section=catalog&filter=no_category',
         (select coalesce(array_agg(id), '{}') from (select id from no_category limit 50) t)
  union all
  select 'products_without_price', 'Published products with no price', 'critical',
         (select count(*) from no_price), '/marketplace-manager?section=catalog&filter=no_price',
         (select coalesce(array_agg(id), '{}') from (select id from no_price limit 50) t)
  union all
  select 'products_without_demo', 'Published products with no demo link', 'medium',
         (select count(*) from no_demo), '/marketplace-manager?section=demo-urls',
         (select coalesce(array_agg(id), '{}') from (select id from no_demo limit 50) t)
  union all
  select 'products_thin_description', 'Published products with a thin description', 'medium',
         (select count(*) from no_description), '/marketplace-manager?section=catalog&filter=thin',
         (select coalesce(array_agg(id), '{}') from (select id from no_description limit 50) t)
  union all
  select 'products_without_media', 'Published products with no image', 'high',
         (select count(*) from no_media), '/marketplace-manager?section=catalog&filter=no_media',
         (select coalesce(array_agg(id), '{}') from (select id from no_media limit 50) t)
  union all
  select 'products_pending_approval', 'Products waiting for approval', 'medium',
         (select count(*) from pending), '/marketplace-manager?section=catalog&filter=pending',
         (select coalesce(array_agg(id), '{}') from (select id from pending limit 50) t)
  union all
  -- Section 12 names a scheduling gap explicitly: rows that are scheduled but
  -- whose window has already closed leave a hole on the page.
  select 'homepage_rows_expired', 'Homepage rows whose schedule has run out', 'high',
         (select count(*) from public.marketplace_homepage_sections
          where status = 'published' and ends_at is not null and ends_at <= now()),
         '/marketplace-manager?section=homepage-rows', '{}'::uuid[]
  union all
  select 'homepage_no_rows', 'No published homepage rows configured', 'low',
         (select case when count(*) = 0 then 1 else 0 end
          from public.marketplace_homepage_sections where status = 'published'),
         '/marketplace-manager?section=homepage-rows', '{}'::uuid[];
$$;

grant execute on function public.mm_health_checks() to authenticated;
revoke all on function public.mm_health_checks() from public, anon;

-- -------------------------------------------------------------- the score ---
-- Section 31: the score is not a number on its own. It is a set of factors,
-- each with its own weight and its own count, returned together so the screen
-- can show the working.
create or replace function public.mm_marketplace_score()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_published bigint;
  v_total     bigint;
  v_factors   jsonb := '[]'::jsonb;
  v_score     numeric := 0;
  v_weighted  numeric := 0;
  r           record;
  v_ratio     numeric;
  v_weight    numeric;
begin
  select count(*) filter (
           where content_status = 'published' and visible
             and (publish_at is null or publish_at <= now())
             and (unpublish_at is null or unpublish_at > now())),
         count(*)
    into v_published, v_total
  from public.marketplace_products;

  if v_published = 0 then
    -- No catalogue, no score. Reporting 100% for an empty marketplace would be
    -- the exact decoration section 31 forbids.
    return jsonb_build_object(
      'score', null,
      'reason', 'no published products to assess',
      'published_products', 0,
      'factors', '[]'::jsonb);
  end if;

  -- Each health check becomes a factor: the share of the catalogue that is
  -- clean on that dimension, weighted by how much it matters.
  for r in
    select * from public.mm_health_checks()
    where check_key like 'products_%'
  loop
    v_weight := case r.severity
      when 'critical' then 3.0
      when 'high'     then 2.0
      when 'medium'   then 1.0
      else 0.5 end;
    v_ratio := greatest(0, 1 - (r.affected::numeric / nullif(v_published, 0)));
    v_weighted := v_weighted + v_weight;
    v_score := v_score + (v_ratio * v_weight);

    v_factors := v_factors || jsonb_build_object(
      'key', r.check_key,
      'label', r.label,
      'severity', r.severity,
      'weight', v_weight,
      'affected', r.affected,
      'clean_ratio', round(v_ratio * 100, 1),
      'destination', r.destination);
  end loop;

  return jsonb_build_object(
    'score', case when v_weighted = 0 then null
                  else round((v_score / v_weighted) * 100, 1) end,
    'published_products', v_published,
    'total_products', v_total,
    'computed_at', now(),
    'method', 'weighted share of published products passing each catalogue check',
    'factors', v_factors);
end;
$$;

grant execute on function public.mm_marketplace_score() to authenticated;
revoke all on function public.mm_marketplace_score() from public, anon;

-- ---------------------------------------------------- the attention center --
-- Section 12: what needs attention right now, drawn from real signals across
-- the platform - not only the catalogue. Each item carries where to go.
create or replace function public.mm_attention_center()
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'items', coalesce((
      select jsonb_agg(item order by weight desc)
      from (
        -- Catalogue problems, from the health checks so the two can never
        -- disagree with one another.
        select jsonb_build_object(
                 'key', check_key, 'label', label, 'count', affected,
                 'severity', severity, 'destination', destination) as item,
               case severity when 'critical' then 4 when 'high' then 3
                             when 'medium' then 2 else 1 end as weight
        from public.mm_health_checks()
        where affected > 0

        union all
        -- Legal Manager is the source of truth for compliance; this only asks.
        select jsonb_build_object(
                 'key', 'legal_pending_review', 'label', 'AI legal output awaiting review',
                 'count', count(*), 'severity', 'medium',
                 'destination', '/legal-manager'), 2
        from public.legal_ai_requests where review_status = 'unreviewed'
        having count(*) > 0

        union all
        -- Task Manager owns the work; this counts what marketing and
        -- marketplace raised and nobody has picked up.
        select jsonb_build_object(
                 'key', 'tasks_unclaimed', 'label', 'Marketplace tasks nobody has taken',
                 'count', count(*), 'severity', 'high',
                 'destination', '/task-manager'), 3
        from public.tm_tasks
        where module in ('marketplace_manager','marketing_manager')
          and assigned_to is null
          and status in ('new','routed','available_for_claim','assigned')
        having count(*) > 0

        union all
        -- Promise Tracker owns commitments; this counts the ones already late.
        select jsonb_build_object(
                 'key', 'promises_overdue', 'label', 'Marketplace commitments past their deadline',
                 'count', count(*), 'severity', 'critical',
                 'destination', '/promise-tracker/delayed'), 4
        from public.promises
        where linked_module in ('marketplace_manager','marketing_manager')
          and status in ('delayed','broken')
        having count(*) > 0

        union all
        -- Server Manager owns infrastructure; this surfaces an unhealthy host.
        select jsonb_build_object(
                 'key', 'infrastructure_degraded', 'label', 'A server is not healthy',
                 'count', count(*), 'severity', 'critical',
                 'destination', '/server-manager'), 4
        from public.server_instances
        where health_status <> 'healthy'
        having count(*) > 0

        union all
        select jsonb_build_object(
                 'key', 'orders_refunded', 'label', 'Refunds recorded against orders',
                 'count', count(*), 'severity', 'medium',
                 'destination', '/marketplace-manager?section=orders&filter=refunded'), 2
        from public.marketplace_order_refunds
        having count(*) > 0
      ) signals), '[]'::jsonb));
$$;

grant execute on function public.mm_attention_center() to authenticated;
revoke all on function public.mm_attention_center() from public, anon;
