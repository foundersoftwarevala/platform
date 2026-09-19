-- Demo processing: a submitted demo address is investigated before it is shown.
--
-- product_demo_urls stays the one demo record the marketplace reads (the card's
-- LIVE DEMO badge, the /demo/<slug> gateway and the proxy). A row now also
-- records what the Demo Manager found when it investigated the address, and
-- the presentation rules the proxy applies: Software Vala favicon and logo,
-- and the developer contact and branding details removed from the page.
--
-- Additive only. Existing rows keep status and url unchanged and read as
-- 'unprocessed', which the proxy serves exactly as before.

alter table public.product_demo_urls
  add column if not exists processing_status text not null default 'unprocessed',
  add column if not exists processing jsonb,
  add column if not exists processed_at timestamptz,
  add column if not exists detected_category_id uuid
    references public.marketplace_categories(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_demo_urls_processing_status_check'
  ) then
    alter table public.product_demo_urls
      add constraint product_demo_urls_processing_status_check
      check (processing_status in ('unprocessed', 'investigating', 'review', 'live', 'failed'));
  end if;
end $$;

comment on column public.product_demo_urls.processing_status is
  'unprocessed | investigating | review (investigated, awaiting approval) | live (verified and activated) | failed';
comment on column public.product_demo_urls.processing is
  'Demo Manager investigation: AI findings, evidence and the presentation rules the demo proxy applies.';
