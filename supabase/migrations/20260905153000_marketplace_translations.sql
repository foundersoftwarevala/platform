-- Translations of catalogue text, kept so the same sentence is never paid for twice.
--
-- The marketplace is read in many languages but every product name, category
-- name and description is written once, in English. Translating them goes
-- through AI API Manager like every other model call, which is where the
-- provider, the model and the credential live and where the usage is metered.
-- The answer is stored here so a page that has been translated once is served
-- from the database afterwards rather than sent to a provider again.
--
-- The source text is keyed by its own digest, so the same sentence appearing on
-- twenty products is one row.

create table if not exists public.marketplace_translations (
  id uuid primary key default gen_random_uuid(),
  source_hash text not null,
  locale text not null,
  source_text text not null,
  translated_text text not null,
  provider text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_hash, locale)
);

create index if not exists marketplace_translations_lookup_idx
  on public.marketplace_translations (locale, source_hash);

alter table public.marketplace_translations enable row level security;

-- Anyone reading the shop may read a translation of what is already public.
drop policy if exists "translations public read" on public.marketplace_translations;
create policy "translations public read"
  on public.marketplace_translations for select
  to anon, authenticated
  using (true);

-- Only an operator writes one by hand; the server writes with its own key.
drop policy if exists "translations operator write" on public.marketplace_translations;
create policy "translations operator write"
  on public.marketplace_translations for all
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'boss'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'boss'::app_role));

drop policy if exists anon_write_denied on public.marketplace_translations;
create policy anon_write_denied
  on public.marketplace_translations as restrictive for all
  to anon
  using (true)
  with check (false);
