-- One registry for every homepage section, and the removal of a duplicate I made.
--
-- Scanning the real homepage rather than the manager's list changed the picture.
-- HomeIndex.tsx renders nineteen sections, only one of which — CatalogRows, the
-- per-category product walls — is what "Homepage Rows" has been managing.
--
-- It also showed that marketplace_homepage_sections was never a parallel product
-- system. Its fifteen rows are the homepage's own sections: shop-by-industry,
-- ai-zone, success-stories, awards-champions, live-activity, vala-tv,
-- vala-academy, faq, enterprise-cta, footer, shop-by-category, and the four
-- curated product rows. I marked that table "superseded, retained, not read",
-- which was too broad, and then created featured-software, trending-now,
-- top-selling and new-releases in marketplace_row_config — four keys that
-- already existed there. That is a duplicate source of truth, and it is mine.
--
-- The table is also simply better for the job: 35 columns against my 24,
-- including row_type, source, manual_product_ids, item_limit, per-surface
-- visibility, schedule, status, CTA, impressions/clicks/conversions, publishing,
-- archiving and duplicated_from.
--
-- So the division of labour becomes:
--
--   marketplace_homepage_sections   every homepage section that is not a
--                                   category wall: hero, banners, curated
--                                   product rows, content sections, footer
--   marketplace_categories          the category product rows themselves,
--                                   which is what the homepage iterates
--   marketplace_row_config/_slots   per-category settings and the 60-slot
--                                   placement, which existed nowhere else
--
-- Nothing is dropped. The four duplicated rows are removed from the table that
-- should not have held them, and they were drafts that never reached the page.

delete from public.marketplace_row_config
where row_kind = 'curated'
  and key in ('featured-software','trending-now','top-selling','new-releases')
  and exists (select 1 from public.marketplace_homepage_sections s
              where s.key = public.marketplace_row_config.key);

comment on table public.marketplace_homepage_sections is
  'Every homepage section that is not a category product wall — hero, banners, '
  'curated product rows, content blocks and the footer. The category walls are '
  'marketplace_categories, configured by marketplace_row_config.';

-- ---------------------------------------------------------------------------
-- Register the sections the homepage renders that nothing had a record of.
-- ---------------------------------------------------------------------------
-- Discovered by reading HomeIndex.tsx top to bottom rather than by assuming.
-- Each is inserted as a draft so registering a section cannot change the page,
-- and each carries the component that actually renders it so a manager can see
-- where it lives.

insert into public.marketplace_homepage_sections
  (key, title, row_type, source, sort_order, status, enabled,
   visible_desktop, visible_mobile, config)
values
  ('utility-bar', 'Utility Bar', 'content', 'manual', 1, 'draft', false, true, true,
   '{"component":"UtilityStrip","file":"src/components/marketplace-home/UtilityStrip.tsx","owner":"marketplace-manager"}'::jsonb),
  ('offer-banner', 'Offer Banner', 'banner', 'manual', 2, 'draft', false, true, true,
   '{"component":"FestiveBanner","file":"src/components/marketplace-home/FestiveBanner.tsx","owner":"marketing-manager"}'::jsonb),
  ('feature-strip', 'Feature Strip', 'content', 'manual', 3, 'draft', false, true, true,
   '{"component":"FeatureStrip","file":"src/components/marketplace-home/FeatureStrip.tsx","owner":"marketplace-manager"}'::jsonb),
  ('hero-carousel', 'Hero Carousel', 'hero', 'collection', 4, 'draft', false, true, true,
   '{"component":"HeroCarousel","file":"src/components/marketplace-home/HeroCarousel.tsx","data_source":"home_hero_slides","owner":"hero-slides-manager"}'::jsonb),
  ('category-slider', 'Category Slider', 'categories', 'category', 6, 'draft', false, true, true,
   '{"component":"CategorySlider","file":"src/components/marketplace-home/CategorySlider.tsx","owner":"marketplace-manager"}'::jsonb),
  ('catalog-rows', 'Category Product Walls', 'products', 'category', 7, 'published', true, true, true,
   '{"component":"CatalogRows","file":"src/lib/marketplace/home-catalog.functions.ts","data_source":"marketplace_categories","note":"one row per visible category; managed per row in Homepage Rows"}'::jsonb),
  ('search-bar', 'Search & Stats Bar', 'content', 'manual', 8, 'draft', false, true, true,
   '{"component":"HomeIndex inline","file":"src/components/marketplace-home/HomeIndex.tsx","note":"SITE_STATS is hardcoded in the component"}'::jsonb)
on conflict (key) do nothing;

-- Record where the already-registered sections actually live, so the manager
-- can route "Manage" to the right place instead of a generic screen.
update public.marketplace_homepage_sections set config = coalesce(config,'{}'::jsonb) || v.cfg
from (values
  ('shop-by-industry', '{"component":"IndustryGrid","file":"src/components/marketplace-home/RefSections.tsx","owner":"marketplace-manager"}'::jsonb),
  ('ai-zone',          '{"component":"AIZone","file":"src/components/marketplace-home/RefSections.tsx","owner":"ai-manager"}'::jsonb),
  ('success-stories',  '{"component":"SuccessStories","file":"src/components/marketplace-home/RefSections.tsx","owner":"marketing-manager"}'::jsonb),
  ('awards-champions', '{"component":"AwardsRow","file":"src/components/marketplace-home/RefSections.tsx","owner":"ams-manager"}'::jsonb),
  ('live-activity',    '{"component":"LiveActivity","file":"src/components/marketplace-home/RefSections.tsx","owner":"marketplace-manager"}'::jsonb),
  ('vala-tv',          '{"component":"ValaTV","file":"src/components/marketplace-home/RefSections.tsx","owner":"content-studio"}'::jsonb),
  ('vala-academy',     '{"component":"ValaAcademy","file":"src/components/marketplace-home/RefSections.tsx","owner":"content-studio"}'::jsonb),
  ('faq',              '{"component":"FaqSection","file":"src/components/marketplace-home/RefSections.tsx","owner":"content-studio"}'::jsonb),
  ('enterprise-cta',   '{"component":"EnterpriseCTA","file":"src/components/marketplace-home/RefSections.tsx","owner":"marketplace-manager"}'::jsonb),
  ('footer',           '{"component":"SiteFooter","file":"src/components/marketplace-home/SiteFooter.tsx","owner":"marketplace-manager"}'::jsonb),
  ('featured-software','{"component":"CatalogRows curated","owner":"marketplace-manager"}'::jsonb),
  ('trending-now',     '{"component":"CatalogRows curated","owner":"marketplace-manager"}'::jsonb),
  ('top-selling',      '{"component":"CatalogRows curated","owner":"marketplace-manager"}'::jsonb),
  ('new-releases',     '{"component":"CatalogRows curated","owner":"marketplace-manager"}'::jsonb),
  ('shop-by-category', '{"component":"CategorySlider","owner":"marketplace-manager"}'::jsonb)
) as v(key, cfg)
where public.marketplace_homepage_sections.key = v.key;
-- Order the registry the way the homepage actually renders, and close two gaps
-- the scan turned up.
--
-- The pre-existing fifteen rows carried their own sort_order and the seven I
-- added reused the same numbers, so the list collided. More importantly the
-- numbers did not describe the page: the real sequence is the order
-- HomeIndex.tsx renders in, and that is what a manager needs to see.
--
-- Two findings from reading the page against the registry:
--
--   partner-ecosystem renders on the homepage and had no record at all.
--   shop-by-category and category-slider both point at CategorySlider — one
--   section, two registry rows. Nothing is deleted; the older, unused one is
--   archived and says why, so the duplicate stops appearing as a second thing
--   to manage.

insert into public.marketplace_homepage_sections
  (key, title, row_type, source, sort_order, status, enabled,
   visible_desktop, visible_mobile, config)
values
  ('partner-ecosystem', 'Partner Ecosystem', 'content', 'collection', 15, 'draft', false, true, true,
   '{"component":"PartnerEcosystem","file":"src/components/marketplace-home/RefSections.tsx","owner":"marketplace-manager"}'::jsonb)
on conflict (key) do nothing;

-- The real render order, read from HomeIndex.tsx top to bottom.
update public.marketplace_homepage_sections s set sort_order = v.n, updated_at = now()
from (values
  ('utility-bar', 1), ('offer-banner', 2), ('feature-strip', 3), ('hero-carousel', 4),
  ('shop-by-industry', 5), ('category-slider', 6), ('search-bar', 7), ('catalog-rows', 8),
  ('ai-zone', 9), ('success-stories', 10), ('awards-champions', 11), ('live-activity', 12),
  ('vala-tv', 13), ('vala-academy', 14), ('partner-ecosystem', 15), ('faq', 16),
  ('enterprise-cta', 17), ('footer', 18),
  -- The curated product rows do not render yet. They sit after the page so
  -- publishing one appends it rather than pushing the page around.
  ('featured-software', 20), ('trending-now', 21), ('top-selling', 22), ('new-releases', 23)
) as v(key, n)
where s.key = v.key;

-- The duplicate. shop-by-category was never wired to anything the page renders;
-- category-slider is the row that names the component. Archived rather than
-- removed, with the reason recorded.
update public.marketplace_homepage_sections
set status = 'archived',
    enabled = false,
    archived_at = coalesce(archived_at, now()),
    sort_order = 99,
    config = coalesce(config,'{}'::jsonb)
             || '{"archived_reason":"duplicate of category-slider; both describe CategorySlider","superseded_by":"category-slider"}'::jsonb,
    updated_at = now()
where key = 'shop-by-category';

-- ---------------------------------------------------------------------------
-- The homepage/manager matrix — section 24, answered from the database.
-- ---------------------------------------------------------------------------
-- One function so the manager screen and any report agree about what the
-- homepage contains and who owns each part of it.

create or replace function public.mm_homepage_sections()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by (r->>'sort_order')::int), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'key', s.key,
      'title', s.title,
      'row_type', s.row_type,
      'source', s.source,
      'sort_order', s.sort_order,
      'status', s.status,
      'enabled', s.enabled,
      'visible_desktop', s.visible_desktop,
      'visible_mobile', s.visible_mobile,
      'starts_at', s.starts_at,
      'ends_at', s.ends_at,
      'component', s.config->>'component',
      'file', s.config->>'file',
      -- Which module owns this section's content. Marketplace Manager controls
      -- placement and publication; the owner controls what is inside.
      'owner', coalesce(s.config->>'owner', 'marketplace-manager'),
      'data_source', s.config->>'data_source',
      'archived_reason', s.config->>'archived_reason',
      -- Live means it would render right now: published, enabled and inside
      -- its schedule.
      'live_now', (s.status = 'published' and coalesce(s.enabled,false)
                   and (s.starts_at is null or s.starts_at <= now())
                   and (s.ends_at is null or s.ends_at > now())),
      -- For the one section that expands into many, say how many.
      'child_rows', case when s.key = 'catalog-rows'
                         then (select count(*) from public.marketplace_categories where not is_hidden)
                         else null end
    ) r
    from public.marketplace_homepage_sections s
  ) x;
$$;

grant execute on function public.mm_homepage_sections() to authenticated;
