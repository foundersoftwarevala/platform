-- Which product a demo URL belongs to, decided without guessing.
--
-- Add Demo and Bulk Add have been writing into `demos`, a table with no product
-- relationship that the storefront never reads - so a demo added through either
-- screen could never appear anywhere. The canonical relationship is
-- product_demo_urls.product_id, and this is how a URL gets one.
--
-- The hard part is what NOT to do. A demo's address tells you nothing about the
-- product: pixel-till-pro.lovable.app is CounterPOS, temple-learn-sync is
-- AnnadanamKitchen. Anything inferred from the host would be a guess, and a
-- guess here is how admissionschool-desk came to carry an AnnadanamKitchen demo.
--
-- So this matches on a name the caller supplies - from the CSV column, or from
-- the AI investigation that reads the page - and only on an exact normalised
-- equality against a product that is actually on sale. No prefixes, no
-- similarity, no "closest". Four outcomes and nothing in between:
--
--   ALREADY_ASSIGNED  this URL already hangs on a product
--   MATCHED           exactly one product, by id, slug or name
--   AMBIGUOUS         more than one product could be meant
--   UNMATCHED         nothing matched, or nothing was given to match on
--
-- Everything that is not MATCHED stays unassigned and reviewable. Uncertainty is
-- never converted into an assignment.

/**
 * Normalised for comparison: lowercase, letters and digits only.
 *
 * "AuditLegal Console" and the slug "auditlegal-console" are the same product
 * written two ways, and this is what makes them equal without making anything
 * else equal by accident.
 */
create or replace function public.demo_match_key(p_value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]', '', 'g'), '');
$$;

create index if not exists marketplace_products_match_key_idx
  on public.marketplace_products (public.demo_match_key(name))
  where visible;

create or replace function public.demo_match_product(
  p_url text,
  p_hint text default null,
  p_product text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_url text := btrim(coalesce(p_url, ''));
  v_existing record;
  v_product record;
  v_key text;
  v_candidates jsonb;
  v_count integer;
begin
  if v_url = '' then
    return jsonb_build_object('state', 'UNMATCHED', 'reason', 'no address was given');
  end if;

  -- 1. Already on a product. Never overwritten; the caller is told which.
  select d.id, d.product_id, p.name, p.slug
    into v_existing
    from public.product_demo_urls d
    left join public.marketplace_products p on p.id = d.product_id
   where d.url = v_url and d.product_id is not null
   limit 1;
  if found then
    return jsonb_build_object(
      'state', 'ALREADY_ASSIGNED',
      'demo_url_id', v_existing.id,
      'product_id', v_existing.product_id,
      'reason', format('already on %s', coalesce(v_existing.name, 'a product')),
      'evidence', jsonb_build_object('product_slug', v_existing.slug));
  end if;

  -- 2. The caller named a product outright: an id or a slug. Deterministic.
  if nullif(btrim(coalesce(p_product, '')), '') is not null then
    select p.id, p.name, p.slug into v_product
      from public.marketplace_products p
     where (
             (p_product ~ '^[0-9a-f-]{36}$' and p.id = p_product::uuid)
             or p.slug = btrim(p_product)
           )
       and p.visible and p.moderation_status = 'approved'
     limit 1;
    if found then
      return jsonb_build_object(
        'state', 'MATCHED', 'product_id', v_product.id,
        'reason', 'the product was named in the request',
        'evidence', jsonb_build_object('matched_on', 'explicit', 'product_slug', v_product.slug));
    end if;
    -- Named and not found is a refusal, not a licence to look elsewhere.
    return jsonb_build_object(
      'state', 'UNMATCHED',
      'reason', format('no product on sale has the id or slug "%s"', btrim(p_product)));
  end if;

  -- 3. A name to match on. Exact normalised equality against name or slug.
  v_key := public.demo_match_key(p_hint);
  if v_key is null then
    return jsonb_build_object(
      'state', 'UNMATCHED',
      'reason', 'nothing was given to match on - supply a product, or investigate the demo first');
  end if;

  select count(*), jsonb_agg(jsonb_build_object('id', id, 'name', name, 'slug', slug))
    into v_count, v_candidates
    from (
      select p.id, p.name, p.slug
        from public.marketplace_products p
       where p.visible and p.moderation_status = 'approved'
         and (public.demo_match_key(p.name) = v_key or public.demo_match_key(p.slug) = v_key)
       limit 25
    ) c;

  if coalesce(v_count, 0) = 0 then
    return jsonb_build_object(
      'state', 'UNMATCHED',
      'reason', format('no product on sale is called "%s"', btrim(p_hint)));
  end if;

  if v_count > 1 then
    -- More than one product could be meant, so none of them is chosen.
    return jsonb_build_object(
      'state', 'AMBIGUOUS',
      'reason', format('%s products are called "%s"', v_count, btrim(p_hint)),
      'candidates', v_candidates);
  end if;

  return jsonb_build_object(
    'state', 'MATCHED',
    'product_id', (v_candidates->0->>'id')::uuid,
    'reason', format('exactly one product is called "%s"', btrim(p_hint)),
    'evidence', jsonb_build_object('matched_on', 'name', 'product_slug', v_candidates->0->>'slug'));
end;
$$;

revoke all on function public.demo_match_product(text, text, text) from public;
grant execute on function public.demo_match_product(text, text, text) to authenticated, service_role;

-- --------------------------------------------------------- one intake per URL
--
-- product_demo_urls_product_url_once covers (product_id, url), and in SQL two
-- nulls are not equal - so without this an unassigned URL could be taken in
-- again and again, and an operator reviewing them would see the same address
-- five times.
create unique index if not exists product_demo_urls_unassigned_url_once
  on public.product_demo_urls (url)
  where product_id is null;

comment on function public.demo_match_product(text, text, text) is
  'Which product a demo URL belongs to: ALREADY_ASSIGNED, MATCHED, AMBIGUOUS or UNMATCHED, with the reason and the evidence. Matches only on exact normalised equality, because a demo address says nothing about its product.';
