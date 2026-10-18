-- The card is the permanent slot; the product is only its current tenant.
--
-- Until now a home page card and the product inside it were the same thing:
-- the card's country came from a "country:<name>" marker on the product row and
-- its position came from that product's sort_order. When the product changed,
-- the card's identity changed with it - a new URL, a new title, and every
-- ranking signal the old URL had earned went with it.
--
-- This table separates the two. A slot is one (category, country) address with
-- its own permanent URL and its own SEO and GEO blueprint. A product occupies a
-- slot and can be replaced by another product without the slot moving,
-- renaming, or losing what it has earned.
--
-- Nothing is dropped and nothing existing is altered. marketplace_products and
-- marketplace_categories keep every column and every row they have; this sits
-- beside them and points at them.

create table if not exists public.marketplace_card_slots (
  id uuid primary key default gen_random_uuid(),

  -- ---------------------------------------------------------------- address
  -- A slot's address is its category and its place in the country rail. Both
  -- are unique per category, so a category can never hold two slots at the
  -- same position or two slots for the same country.
  category_id uuid not null references public.marketplace_categories (id) on delete restrict,
  slot_no integer not null,
  country_marker text not null,
  country_code text,
  region text,

  -- ---------------------------------------------------------------- identity
  -- The URL belongs to the slot, not to whichever product is in it today.
  slot_url text not null,
  slot_title text,
  business_type text,
  software_type text,

  -- --------------------------------------------------------- SEO blueprint
  -- Templates, not finished copy: {category}, {country}, {product} and
  -- {currency} are filled when the page renders, so a slot reads correctly
  -- whoever is in it.
  h1_template text,
  h2_templates text[] not null default '{}',
  meta_title_template text,
  meta_description_template text,
  primary_keyword text,
  keyword_set jsonb not null default '[]'::jsonb,
  schema_types text[] not null default '{}',
  faq_set jsonb not null default '[]'::jsonb,

  -- --------------------------------------------------------- GEO blueprint
  -- Which engines this country actually uses and which registered services
  -- cover it. free_tool_ids holds api_services ids; it is deliberately not a
  -- foreign-key array because a service may be retired from the registry
  -- without the slot losing its history of what was mapped.
  search_engines text[] not null default '{}',
  free_tool_ids uuid[] not null default '{}',
  indexnow_enabled boolean not null default true,
  hreflang_group text,

  -- ----------------------------------------------------------- the tenant
  -- The only part of a slot that is meant to change. A product removed from
  -- the catalogue vacates its slot rather than deleting it.
  current_product_id uuid references public.marketplace_products (id) on delete set null,
  occupied_since timestamptz,
  rotation_policy text not null default 'manual',
  status text not null default 'vacant',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketplace_card_slots_slot_no_positive check (slot_no > 0),
  constraint marketplace_card_slots_status_known
    check (status in ('occupied', 'vacant', 'reserved')),
  constraint marketplace_card_slots_rotation_known
    check (rotation_policy in ('manual', 'top-selling', 'round-robin', 'queue')),
  constraint marketplace_card_slots_unique_position unique (category_id, slot_no),
  constraint marketplace_card_slots_unique_country unique (category_id, country_marker),
  constraint marketplace_card_slots_unique_url unique (slot_url)
);

create index if not exists marketplace_card_slots_category_idx
  on public.marketplace_card_slots (category_id);
create index if not exists marketplace_card_slots_slot_no_idx
  on public.marketplace_card_slots (slot_no);
create index if not exists marketplace_card_slots_country_idx
  on public.marketplace_card_slots (country_marker);
create index if not exists marketplace_card_slots_product_idx
  on public.marketplace_card_slots (current_product_id);
-- The slot page is looked up by its two URL segments, so the pair is indexed
-- together as well as apart.
create index if not exists marketplace_card_slots_category_country_idx
  on public.marketplace_card_slots (category_id, country_marker);
create index if not exists marketplace_card_slots_status_idx
  on public.marketplace_card_slots (status);

drop trigger if exists trg_marketplace_card_slots_updated on public.marketplace_card_slots;
create trigger trg_marketplace_card_slots_updated
  before update on public.marketplace_card_slots
  for each row execute function public.update_updated_at_column();

alter table public.marketplace_card_slots enable row level security;

-- Read and written through the service role only, like the rest of the
-- catalogue's operational tables. The slot page renders on the server, so the
-- browser never needs a policy here; an author or vendor therefore cannot
-- reach a slot definition at all, let alone change one.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'marketplace_card_slots'
       and policyname = 'marketplace_card_slots_service_role'
  ) then
    create policy marketplace_card_slots_service_role
      on public.marketplace_card_slots
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

comment on table public.marketplace_card_slots is
  'One permanent card per category and country: its URL, SEO and GEO blueprint, and whichever product currently occupies it.';
comment on column public.marketplace_card_slots.slot_no is
  'Position in the country rail published by src/lib/marketplace/rail-countries.ts.';
comment on column public.marketplace_card_slots.current_product_id is
  'The tenant. Null means the slot is vacant, which is a reported gap and never a removed card.';
