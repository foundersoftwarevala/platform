-- Where genuine external reviews will live, and nothing else.
--
-- The brief is explicit: no fabricated reviews, no invented reviewer names, no
-- invented ratings or counts, and no AI-written quote presented as a customer's.
-- So this migration creates the place real reviews go and leaves it empty,
-- because at the time of writing there is nothing real to put in it:
--
--   * No Google Business Profile is configured anywhere in this project. The
--     share link the owner supplied resolves to a Google Search knowledge
--     panel, not a Maps place, and carries no Place ID; Google does not expose
--     one to a plain fetch. `api_services` holds "Google Business Profile APIs"
--     as inactive with no credential, needing OAuth and Google's approval.
--   * `marketplace_reviews` holds zero rows, so there are no on-site reviews
--     either.
--   * The five rows in `marketplace_stories` are leftovers from verification
--     runs - "Audit Trail Verification", "Bulk Engine Verification 1" - and all
--     five are unpublished, so nothing invented is on the public site today.
--
-- One thing worth recording, because it must not come back: the SEO Centre
-- screen already documents that it once displayed a Google Business Profile
-- with "1,284 reviews at 4.8 stars" and four verified offices, and that "none
-- of it is held anywhere on this platform; every line was written into the
-- file". That is the shape of failure these tables exist to prevent.
--
-- Why not reuse marketplace_reviews: that is a product review by a verified
-- purchaser - it requires product_id, buyer_id and order_item_id, and carries
-- a seller response and moderation trail. A Google review of the company is a
-- different thing about a different subject from a different system. Keeping
-- them apart is what makes source attribution possible; merging them into one
-- anonymous pool is what the brief forbids.

-- ---------------------------------------------------------------------------
-- Individual reviews, each one attributable to where it came from.
-- ---------------------------------------------------------------------------
create table if not exists public.external_reviews (
  id            uuid primary key default gen_random_uuid(),
  -- Which platform this came from. Never blank, never merged away: a review
  -- that cannot say where it is from does not belong on the site.
  source        text not null check (source in ('google', 'facebook')),
  -- The platform's own id for the review. Unique per source, which is what
  -- makes an import idempotent and a re-import a no-op.
  external_id   text not null,
  author_name   text,
  author_url    text,
  author_avatar text,
  -- Whatever scale the source uses, recorded as the source gives it rather
  -- than rescaled into a house rating nobody can check.
  rating        numeric(2,1),
  rating_scale  integer not null default 5,
  review_text   text,
  language      text,
  reviewed_at   timestamptz,
  -- The original, so a reader can go and check it.
  source_url    text,
  -- When the source last confirmed this review still exists and still says
  -- this. A review edited or deleted at the source must not be shown as
  -- current for ever, so a stale fetched_at is the signal to stop showing it.
  fetched_at    timestamptz not null default now(),
  -- An operator may hide a review from the site. It is never edited: changing
  -- what a customer wrote is the one thing that must be impossible here, which
  -- is why there is no moderation_note and no reply column.
  visible       boolean not null default true,
  hidden_reason text,
  hidden_by     uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint external_reviews_rating_range
    check (rating is null or (rating >= 0 and rating <= rating_scale))
);

create unique index if not exists external_reviews_source_external_key
  on public.external_reviews (source, external_id);

create index if not exists external_reviews_visible_idx
  on public.external_reviews (source, visible, reviewed_at desc nulls last);

-- ---------------------------------------------------------------------------
-- The aggregate, for the case where a platform gives a rating and a count but
-- not the individual reviews.
-- ---------------------------------------------------------------------------
-- Google's own APIs often return exactly that, and the honest response is to
-- show the rating and the count and link to the profile - not to invent five
-- review cards to fill the space.
create table if not exists public.external_review_summary (
  source         text primary key check (source in ('google', 'facebook')),
  profile_url    text,
  profile_name   text,
  rating_average numeric(3,2),
  rating_count   integer,
  -- What the platform will actually tell us, so the site knows whether to
  -- expect reviews or only a number.
  --   not_configured  no credential or profile reference exists yet
  --   aggregate_only  the source gives a rating and a count, no review text
  --   full            individual reviews are available
  capability     text not null default 'not_configured'
    check (capability in ('not_configured', 'aggregate_only', 'full')),
  -- Why it is not connected, in words an operator can act on. This is the
  -- field that replaces guessing.
  status_note    text,
  fetched_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint external_review_summary_count_sane
    check (rating_count is null or rating_count >= 0),
  constraint external_review_summary_average_sane
    check (rating_average is null or (rating_average >= 0 and rating_average <= 5)),
  -- A number without a source it came from is the failure this whole file is
  -- about, so it cannot be stored: an average or a count requires a fetch to
  -- have happened.
  constraint external_review_summary_numbers_need_a_fetch
    check ((rating_average is null and rating_count is null) or fetched_at is not null)
);

-- The two rows that record, in the database rather than in a report nobody
-- re-reads, exactly what is missing. No numbers, because there are none.
insert into public.external_review_summary (source, capability, status_note)
values
  ('google', 'not_configured',
   'No Google Business Profile reference exists for Software Vala in this project. '
   'What is needed: the Place ID or the Business Profile account and location id, '
   'and then either a Places API key (which returns the rating, the review count '
   'and up to five reviews) or Business Profile API OAuth access (which returns '
   'all reviews and allows replies). The Google Business Profile APIs row in '
   'api_services is inactive and holds no credential. The share link supplied by '
   'the owner resolves to a Google Search knowledge panel and carries no Place ID.'),
  ('facebook', 'not_configured',
   'The Facebook page is recorded in storefront_social_links as '
   'facebook.com/share/1HpGSvExis, but page recommendations are not public data. '
   'What is needed: a Facebook Page access token with pages_read_user_content, '
   'from an app with the page admin''s approval. Until then there is nothing to '
   'read, and nothing is shown.')
on conflict (source) do nothing;

-- ---------------------------------------------------------------------------
-- Who may see and change what.
-- ---------------------------------------------------------------------------
alter table public.external_reviews          enable row level security;
alter table public.external_review_summary   enable row level security;

drop policy if exists external_reviews_operator_all on public.external_reviews;
create policy external_reviews_operator_all on public.external_reviews
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'boss'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'boss'::app_role));

drop policy if exists external_review_summary_operator_all on public.external_review_summary;
create policy external_review_summary_operator_all on public.external_review_summary
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'boss'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'boss'::app_role));

-- ---------------------------------------------------------------------------
-- What the public site may read.
-- ---------------------------------------------------------------------------
-- One resolver, in the same shape as the other storefront resolvers, returning
-- only what is genuinely there. When nothing is connected it returns empty
-- arrays and nulls, and the page renders nothing - which is the correct
-- appearance of a business with no reviews yet.
--
-- `stale_after` is why the brief's "do not pretend an old review is still
-- current" is enforced here rather than remembered: a review whose source has
-- not confirmed it within the window is simply not returned.
create or replace function public.sf_reputation(p_stale_after interval default interval '14 days')
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
               'source', s.source,
               'profile_url', s.profile_url,
               'profile_name', s.profile_name,
               'rating_average', s.rating_average,
               'rating_count', s.rating_count,
               'capability', s.capability,
               'fetched_at', s.fetched_at)
             order by s.source)
        from public.external_review_summary s
       where s.capability <> 'not_configured'
         and s.fetched_at is not null), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id,
               'source', r.source,
               'author_name', r.author_name,
               'author_url', r.author_url,
               'author_avatar', r.author_avatar,
               'rating', r.rating,
               'rating_scale', r.rating_scale,
               'review_text', r.review_text,
               'reviewed_at', r.reviewed_at,
               'source_url', r.source_url)
             order by r.reviewed_at desc nulls last)
        from public.external_reviews r
       where r.visible
         and r.review_text is not null
         and btrim(r.review_text) <> ''
         and r.fetched_at >= now() - p_stale_after), '[]'::jsonb)
  );
$$;

revoke all on function public.sf_reputation(interval) from public;
grant execute on function public.sf_reputation(interval) to anon, authenticated, service_role;

comment on table public.external_reviews is
  'Genuine reviews imported from an external platform, one row per review, always attributable to its source. Never written by hand, never edited - an operator may hide a review but not change what it says.';
comment on table public.external_review_summary is
  'One row per external platform: the aggregate it gives us, what it is capable of giving, and - while it is not connected - exactly what is missing.';
