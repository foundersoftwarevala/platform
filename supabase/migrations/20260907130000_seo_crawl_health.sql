-- The crawler upserts a page by its address, so the address has to be unique.
-- Duplicates are collapsed first, keeping the most recently crawled row.
delete from public.seo_pages a
 using public.seo_pages b
 where a.url = b.url
   and coalesce(a.last_crawled_at, a.created_at) < coalesce(b.last_crawled_at, b.created_at);

create unique index if not exists seo_pages_url_uq on public.seo_pages (url);
create index if not exists seo_issues_page_status_idx on public.seo_issues (page_url, status);

select count(*)::text as pages, count(distinct url)::text as distinct_urls from public.seo_pages;
-- SEO health, computed from the crawl and nothing else.
--
-- The SEO Center holds 3,689 keywords and 2,160 rankings. None of it can be
-- refreshed: Google Search Console, GA4, Semrush and Google Ads are all
-- disconnected with last_sync_at of never, and no credential for any of them
-- exists here. The 2,160 ranking rows were inserted inside a single minute, so
-- they are a bulk import rather than tracked positions.
--
-- So this function does not read them. It reports only what the crawler
-- actually measured on our own pages, and names the rest as unavailable. A
-- score built partly on imported rankings would be the hardcoded 87 the brief
-- forbids, wearing a different hat.
create or replace function public.mm_seo_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_last timestamptz; v_pages integer; v_open integer; v_score integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select max(last_crawled_at) into v_last from public.seo_pages;
  select count(*) into v_pages from public.seo_pages
   where last_crawled_at is not null;
  select count(*) into v_open from public.seo_issues where status = 'open';

  -- The average of the per-page scores the crawler recorded. No constant.
  select round(avg(seo_score))::int into v_score from public.seo_pages
   where last_crawled_at is not null and seo_score is not null;

  return jsonb_build_object(
    'ok', true,
    'crawled_pages',   v_pages,
    'last_crawl_at',   v_last,
    'seo_score',       coalesce(v_score, 0),
    'score_basis',     'mean of per-page scores from the last crawl',
    'open_issues',     v_open,
    -- Split, because the two are not the same kind of thing. The crawl's
    -- findings are each verifiable by opening the page; the rest predate this
    -- crawler and their source is not recorded, so they are counted apart
    -- rather than folded into one confident total.
    'issues_from_last_crawl', (
      select count(*) from public.seo_issues i
       where i.status = 'open'
         and i.detected_at >= (select max(last_crawled_at) - interval '10 minutes'
                                 from public.seo_pages)),
    'issues_predating_crawler', (
      select count(*) from public.seo_issues i
       where i.status = 'open'
         and i.detected_at < (select max(last_crawled_at) - interval '10 minutes'
                                from public.seo_pages)),
    'by_severity', coalesce((
      select jsonb_object_agg(severity, n) from (
        select severity, count(*) n from public.seo_issues
         where status='open' group by severity) t), '{}'::jsonb),
    'by_type', coalesce((
      select jsonb_agg(jsonb_build_object('type', issue_type, 'count', n) order by n desc)
        from (select issue_type, count(*) n from public.seo_issues
               where status='open' group by issue_type) t), '[]'::jsonb),
    'pages_without_h1',   (select count(*) from public.seo_pages
                            where h1 is null and last_crawled_at is not null),
    'pages_without_meta', (select count(*) from public.seo_pages
                            where coalesce(btrim(meta_description),'') = ''
                              and last_crawled_at is not null),
    'pages_without_canonical', (select count(*) from public.seo_pages
                                 where canonical_url is null and last_crawled_at is not null),
    'thin_pages',         (select count(*) from public.seo_pages
                            where coalesce(word_count,0) < 250 and last_crawled_at is not null),
    'resolved_issues',    (select count(*) from public.seo_issues where status='resolved'),

    -- Named, not hidden. Every one of these needs a provider that is not
    -- connected, and the figures already in those tables cannot be refreshed.
    'unavailable', jsonb_build_object(
      'rankings',    'Search Console and Semrush are disconnected. The 2,160 ranking rows were bulk-imported in a single minute and cannot be refreshed.',
      'keywords',    'The 3,689 keyword rows came with the module; no provider is connected to update volume, CPC or position.',
      'traffic',     'Google Analytics is disconnected — there are no clicks, impressions or CTR to report.',
      'backlinks',   'No backlink provider is connected.',
      'competitors', 'No competitor data source is connected.',
      'core_web_vitals', 'No field-data source is connected; the crawl measures server response time only.'),
    'providers', coalesce((
      select jsonb_agg(jsonb_build_object('provider', provider, 'status', status,
                                          'last_sync', last_sync_at) order by provider)
        from public.seo_integrations), '[]'::jsonb));
end;
$$;
