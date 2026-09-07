-- A hostname must be reserved the moment it is claimed, in every state.
--
-- The first version reserved a hostname only while the demo was not disabled,
-- expired or failed, and recorded an unprovisionable demo as 'failed'. Both
-- together meant the name was not reserved at all — the end-to-end run proved a
-- second product could take it, while the console said "the hostname is
-- reserved and nobody else can take it". That claim was false.
--
-- Two corrections. A hostname is now unique outright: two products can never
-- hold the same one, whatever state either demo is in, and a disabled demo
-- keeps its address so re-enabling it returns the same URL. And a demo that
-- could not be provisioned because no provider exists is recorded as 'draft'
-- with the reason, not as 'failed' — nothing was attempted, so nothing failed.
alter table public.demo_domains
  drop constraint if exists demo_hostname_unique_when_active;
alter table public.demo_domains
  drop constraint if exists demo_hostname_unique;
alter table public.demo_domains
  add constraint demo_hostname_unique unique (hostname);

comment on constraint demo_hostname_unique on public.demo_domains is
  'Section 1: two products may never claim the same demo hostname. Enforced '
  'outright rather than only while active, so a disabled or failed demo keeps '
  'its address and a retry cannot lose it to somebody else.';

-- The slug generator has to see every demo, not only the active ones, or it
-- would hand out a name the constraint above will then refuse.
create or replace function public.mm_demo_slug(p_product uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_name text; v_base text; v_try text; i integer := 1;
begin
  select name into v_name from public.marketplace_products where id = p_product;
  if v_name is null then
    return jsonb_build_object('ok', false, 'reason','unknown_product');
  end if;

  v_base := lower(btrim(v_name));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := regexp_replace(v_base, '(^-+|-+$)', '', 'g');
  v_base := regexp_replace(v_base, '-{2,}', '-', 'g');
  v_base := left(v_base, 48);
  v_base := regexp_replace(v_base, '-+$', '', 'g');

  if coalesce(v_base,'') = '' then
    v_base := 'product-' || left(replace(p_product::text,'-',''), 10);
  end if;
  if v_base ~ '^[0-9-]' then v_base := 'p-' || v_base; end if;

  v_try := v_base;
  loop
    exit when not exists (select 1 from public.demo_reserved_slugs where slug = v_try)
          -- Every demo, in every state. A name held by a disabled or failed
          -- demo is still that demo's name.
          and not exists (select 1 from public.demo_domains
                           where slug = v_try and product_id <> p_product);
    i := i + 1;
    if i > 50 then
      return jsonb_build_object('ok', false, 'reason','could_not_generate');
    end if;
    v_try := left(v_base, 45) || '-' || i::text;
  end loop;

  return jsonb_build_object('ok', true, 'slug', v_try, 'base', v_base,
    'collisions', i - 1);
end;
$$;
