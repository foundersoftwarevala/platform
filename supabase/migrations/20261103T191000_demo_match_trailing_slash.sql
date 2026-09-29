-- The same address written two ways is the same address.
--
-- Stored rows carry a trailing slash (https://pixel-till-pro.lovable.app/) and
-- the intake normalises it away before matching, so raw equality did not
-- recognise an address that was already on a product - and took it in a second
-- time, under whichever product its name matched. That is the one thing this
-- function exists to prevent.
--
-- Both sides are compared without the trailing slash now. Nothing else changes.
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
  v_url text := rtrim(btrim(coalesce(p_url, '')), '/');
  v_existing record;
  v_product record;
  v_key text;
  v_candidates jsonb;
  v_count integer;
begin
  if v_url = '' then
    return jsonb_build_object('state', 'UNMATCHED', 'reason', 'no address was given');
  end if;

  select d.id, d.product_id, p.name, p.slug
    into v_existing
    from public.product_demo_urls d
    left join public.marketplace_products p on p.id = d.product_id
   where rtrim(d.url, '/') = v_url and d.product_id is not null
   limit 1;
  if found then
    return jsonb_build_object(
      'state', 'ALREADY_ASSIGNED',
      'demo_url_id', v_existing.id,
      'product_id', v_existing.product_id,
      'reason', format('already on %s', coalesce(v_existing.name, 'a product')),
      'evidence', jsonb_build_object('product_slug', v_existing.slug));
  end if;

  -- Taken in already but not yet assigned: also not a new row.
  select d.id into v_existing
    from public.product_demo_urls d
   where rtrim(d.url, '/') = v_url and d.product_id is null
   limit 1;
  if found then
    return jsonb_build_object(
      'state', 'ALREADY_ASSIGNED',
      'demo_url_id', v_existing.id,
      'product_id', null,
      'reason', 'already taken in and waiting for a product');
  end if;

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
    return jsonb_build_object(
      'state', 'UNMATCHED',
      'reason', format('no product on sale has the id or slug "%s"', btrim(p_product)));
  end if;

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
