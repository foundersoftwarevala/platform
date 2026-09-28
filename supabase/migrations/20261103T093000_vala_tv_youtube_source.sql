-- Vala TV, connected to the channel it is named after.
--
-- vala_tv_videos was empty, so /vala-tv and the homepage's Vala TV section had
-- nothing to show. The films exist - they are on the business's own YouTube
-- channel, youtube.com/@softwarevala - and there was no way for them to reach
-- the site.
--
-- These columns are what a video needs to remember where it came from, so the
-- same film is never imported twice and so a film added by hand in the
-- Marketplace Manager is never confused with one that arrived from the channel.
--
--   source        'manual' for anything an operator creates, 'youtube' for a
--                 film that arrived from the channel feed.
--   external_id   the YouTube video id. Unique per source, which is what makes
--                 the sync idempotent: running it twice changes nothing.
--   channel_id    which channel it came from, so a second channel could be
--                 added later without the two being mixed up.
--   source_url    the canonical watch URL, kept separately from `url` so an
--                 operator may point `url` at an embed, a mirror or a
--                 self-hosted copy without losing where it originated.
--   synced_at     when the feed last confirmed this film still exists.
--
-- Nothing existing is altered: every row already in the table is 'manual' by
-- default, which is what it is.

alter table public.vala_tv_videos
  add column if not exists source      text not null default 'manual',
  add column if not exists external_id text,
  add column if not exists channel_id  text,
  add column if not exists source_url  text,
  add column if not exists synced_at   timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.vala_tv_videos'::regclass
       and conname = 'vala_tv_videos_source_check'
  ) then
    alter table public.vala_tv_videos
      add constraint vala_tv_videos_source_check
      check (source in ('manual', 'youtube'));
  end if;
end $$;

-- The sync's whole safety rests on this: one film per (source, external_id),
-- so an import can be re-run as often as you like and can only ever add what
-- is genuinely new. Partial, because a manual film has no external_id.
create unique index if not exists vala_tv_videos_source_external_key
  on public.vala_tv_videos (source, external_id)
  where external_id is not null;

-- Reading the newest first is what both the page and the sync do.
create index if not exists vala_tv_videos_published_at_idx
  on public.vala_tv_videos (published_at desc nulls last);

comment on column public.vala_tv_videos.source is
  'Where this film came from: manual (created in the Manager) or youtube (arrived from the channel feed).';
comment on column public.vala_tv_videos.external_id is
  'The provider''s own id for this film. Unique per source, which makes the sync idempotent.';
