-- The homepage's real row structure, moved out of the component and into the
-- database.
--
-- HomepageRowsSection renders a ROWS array declared in the file: fifteen rows
-- with hardcoded statuses and hardcoded counts like "14 industries" and "20
-- categories". Section 4 asks for a real control system and section 1 forbids
-- hardcoded operational numbers, so the definitions belong in a table where the
-- Manager can actually change them.
--
-- These fifteen are not invented: they are the rows the marketplace homepage
-- genuinely renders today, taken from the component that has been describing
-- them. Moving them into the table is a transcription, not a new claim.
--
-- Every one is seeded as a draft. The homepage falls back to its current
-- behaviour when no row is published, so this changes nothing on the public
-- page until somebody deliberately publishes a row from the Manager. The front
-- door stays exactly as it is.

insert into public.marketplace_homepage_sections
  (key, title, row_type, source, sort_order, status, enabled, item_limit, config)
values
  ('featured-software',   'Featured Software',          'products',   'featured',    1,  'draft', false, 8,  '{"icon":"Star","auto_rotate":true}'::jsonb),
  ('shop-by-industry',    'Shop By Industry',           'categories', 'category',    2,  'draft', false, 24, '{"icon":"Briefcase","grouping":"industry"}'::jsonb),
  ('trending-now',        'Trending Now',               'products',   'trending',    3,  'draft', false, 12, '{"icon":"TrendingUp"}'::jsonb),
  ('top-selling',         'Top Selling',                'products',   'filter',      4,  'draft', false, 12, '{"icon":"Award","window_days":30}'::jsonb),
  ('new-releases',        'New Releases',               'products',   'new',         5,  'draft', false, 12, '{"icon":"Sparkles"}'::jsonb),
  ('shop-by-category',    'Shop By Category',           'categories', 'category',    6,  'draft', false, 24, '{"icon":"FolderTree"}'::jsonb),
  ('ai-zone',             'AI Zone',                    'products',   'filter',      7,  'draft', false, 12, '{"icon":"Sparkles","filter":"is_ai"}'::jsonb),
  ('success-stories',     'Success Stories',            'content',    'collection',  8,  'draft', false, 6,  '{"icon":"Trophy","collection":"stories"}'::jsonb),
  ('awards-champions',    'Awards & Champions',         'content',    'collection',  9,  'draft', false, 6,  '{"icon":"Award","collection":"awards"}'::jsonb),
  ('live-activity',       'Live Marketplace Activity',  'activity',   'filter',      10, 'draft', false, 10, '{"icon":"Activity"}'::jsonb),
  ('vala-tv',             'Vala TV',                    'content',    'collection',  11, 'draft', false, 8,  '{"icon":"PlayCircle","collection":"vala_tv"}'::jsonb),
  ('vala-academy',        'Vala Academy',               'content',    'collection',  12, 'draft', false, 8,  '{"icon":"GraduationCap","collection":"academy"}'::jsonb),
  ('faq',                 'FAQ',                        'content',    'collection',  13, 'draft', false, 10, '{"icon":"HelpCircle","collection":"faq"}'::jsonb),
  ('enterprise-cta',      'Enterprise CTA',             'banner',     'manual',      14, 'draft', false, 1,  '{"icon":"Rocket"}'::jsonb),
  ('footer',              'Footer',                     'content',    'manual',      15, 'draft', false, 1,  '{"icon":"PanelBottom"}'::jsonb)
on conflict (key) do nothing;

-- The category rows point at the real category records rather than a name in a
-- string, so a renamed category cannot leave a row pointing at nothing.
update public.marketplace_homepage_sections s
   set category_id = c.id
  from public.marketplace_categories c
 where s.category_id is null
   and s.source = 'category'
   and lower(c.slug) = 'software';
