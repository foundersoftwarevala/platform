begin;

-- Only published public copy is available to the native language backend.
create or replace function public.i18n_public_catalogue_texts()
returns table(source_text text)
language sql stable security definer set search_path = pg_catalog, public as $$
  with published as (
    select p.* from public.marketplace_products p
    where p.visible and p.content_status='published' and p.deleted_at is null
      and (p.publish_at is null or p.publish_at<=now())
      and (p.unpublish_at is null or p.unpublish_at>now())
  ), text_values as (
    select v.text from published p cross join lateral (
      values (p.name), (p.industry_label), (p.description),
        (left(btrim(p.description),240)), (p.subcategory),
        (p.badge), (p.price_period), (p.license), (p.deployment)
    ) v(text)
    union all
    select jsonb_array_elements_text(
      case when jsonb_typeof(p.features)='array' then p.features else '[]'::jsonb end
    ) from published p
    union all
    select c.name from public.marketplace_categories c where not coalesce(c.is_hidden,false)
    union all
    select v.text from public.marketplace_row_config r cross join lateral
      (values(r.title),(r.cta_label)) v(text)
    where r.status='published'
      and (r.starts_at is null or r.starts_at<=now())
      and (r.ends_at is null or r.ends_at>now())
  )
  select distinct btrim(v.text) from text_values v
  where v.text is not null and length(btrim(v.text)) between 2 and 2000
$$;
revoke all on function public.i18n_public_catalogue_texts() from public,anon,authenticated;
grant execute on function public.i18n_public_catalogue_texts() to sv_app,service_role;

commit;
