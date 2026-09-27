-- The top bar registry, re-measured against the header that actually renders.
--
-- marketplace_topbar_modules is the right table and TopUtilityBar already reads
-- it, so this changes no architecture. What it corrects is the registry's own
-- account of itself, which had gone stale, and what it adds is the handful of
-- real header elements that had no row at all.
--
-- Two notes were wrong, and a wrong note is worse than none: it turns a fixable
-- gap into a permanent-looking one that nobody re-checks.
--
--   favorites  said "no favourites table exists". marketplace_saved_products
--              exists, holds rows, and src/lib/useSavedProducts.ts reads and
--              writes it through my_saved_products / toggle_saved_product. The
--              heart in the bar has been backed by a real table all along.
--
--   ai-chat    said "api_keys holds 15 registrations with 0 stored secrets".
--              api_keys holds 3 rows now, and the question that actually
--              decides whether the chat can answer is whether AI API Manager
--              has a usable credential — which is api_services, not api_keys.
--
-- Three things the header renders had no registry row, so the manager could
-- not even name them:
--
--   brand-name         the <h1>Software Vala</h1> and its tagline, beside the
--                      logo. Compiled into the page, like the logo.
--   announcement-bar   the offer ticker under the utility strip. Real, and
--                      already owned: it reads marketing_offers through
--                      sf_active_offers, so Marketing controls its content.
--   sticky-filter-bar  the category filter and search strip that sticks to the
--                      top of the page as it scrolls.
--
-- Registering them does not move their control here. Each carries
-- config.controlled_by naming the manager that owns it today, and
-- config.on_storefront saying whether it is visible on the page now. That is
-- the distinction the screen could not draw before: "not built yet" and "on
-- the storefront, controlled elsewhere" both showed as draft.
--
-- mm_topbar_configure still refuses to make a module live while nothing in the
-- header renders it, so none of these rows can be switched on and quietly do
-- nothing.

-- ---------------------------------------------------------------- corrections
UPDATE public.marketplace_topbar_modules
   SET config = config
              - 'note'
              || jsonb_build_object(
                   'on_storefront', true,
                   'controlled_by', 'Top Bar Manager',
                   'source', 'marketplace_saved_products, via my_saved_products '
                          || 'and toggle_saved_product')
 WHERE module_key = 'favorites';

UPDATE public.marketplace_topbar_modules
   SET config = config
              - 'note'
              || jsonb_build_object(
                   'on_storefront', true,
                   'controlled_by', 'Top Bar Manager',
                   'source', 'AI API Manager (api_services). The chat answers '
                          || 'only while an active AI service holds a usable '
                          || 'credential; without one it reports that rather '
                          || 'than inventing a reply.')
 WHERE module_key = 'ai-chat';

UPDATE public.marketplace_topbar_modules
   SET config = config
              - 'note'
              || jsonb_build_object(
                   'on_storefront', true,
                   'controlled_by', 'Top Bar Manager',
                   'source', 'Live rates are fetched per request. There is no '
                          || 'currency table, so this module controls the '
                          || 'picker''s presence, not the rates behind it.')
 WHERE module_key = 'currency';

UPDATE public.marketplace_topbar_modules
   SET config = config || jsonb_build_object(
                   'on_storefront', true,
                   'controlled_by', 'Top Bar Manager',
                   'source', 'The picker offers the twelve languages listed in '
                          || 'TopUtilityBar.tsx. The canonical registry — '
                          || 'src/lib/i18n/registry.ts, mirrored in '
                          || 'i18n_languages — carries 140 enabled languages, '
                          || 'so the bar shows a twelfth of what the platform '
                          || 'translates.')
 WHERE module_key = 'language';

UPDATE public.marketplace_topbar_modules
   SET config = config || jsonb_build_object(
                   'on_storefront', true,
                   'controlled_by', 'Top Bar Manager')
 WHERE module_key IN ('apply-now','calendar','calculator','login',
                      'notifications','dashboards');

-- The logo is on the page; what is missing is a component that reads it from
-- anywhere. Its old note said "a header brand component" and that is still
-- exactly right, so only the storefront flag is added.
UPDATE public.marketplace_topbar_modules
   SET config = config || jsonb_build_object(
                   'on_storefront', true,
                   'controlled_by', 'none — compiled into the page',
                   'source', 'src/components/marketplace-home/HomeIndex.tsx '
                          || 'and its sapphire-home twin import the asset and '
                          || 'size it in markup.')
 WHERE module_key = 'logo';

-- These four describe a navigation the header does not have. Saying so in the
-- row is the difference between a plan and a phantom.
UPDATE public.marketplace_topbar_modules
   SET config = config || jsonb_build_object(
                   'on_storefront', false,
                   'controlled_by', 'none',
                   'source', 'The header renders a logo, a name and the utility '
                          || 'strip. It has no navigation bar, so there is no '
                          || 'menu to manage yet.')
 WHERE module_key IN ('products-menu','categories-menu','solutions-menu',
                      'pricing-menu');

UPDATE public.marketplace_topbar_modules
   SET config = config || jsonb_build_object(
                   'on_storefront', false,
                   'controlled_by', 'none',
                   'needs', 'a Register control in the header',
                   'source', 'The header offers Login only. Nothing in it links '
                          || 'to /register.')
 WHERE module_key = 'register';

-- ------------------------------------------------------------------ additions
INSERT INTO public.marketplace_topbar_modules
  (module_key, name, category, description, component, icon, sort_order, status,
   desktop_enabled, tablet_enabled, mobile_enabled, sticky_enabled, featured, config)
VALUES
  ('brand-name', 'Marketplace Name', 'brand',
   'The Software Vala wordmark and its tagline, beside the logo.',
   NULL, 'Type', 30, 'draft', true, true, true, false, false,
   jsonb_build_object(
     'on_storefront', true,
     'controlled_by', 'none — compiled into the page',
     'needs', 'a header brand component, the same one the logo needs',
     'source', 'Written as literal markup in both HomeIndex files: '
            || '"Software Vala" on the front page, "Software Vala™" on '
            || '/marketplace, each with the tagline "- The Name of Trust".')),

  ('announcement-bar', 'Announcement Bar', 'bars',
   'The offer ticker that runs under the utility strip.',
   'FestiveBanner', 'Megaphone', 31, 'draft', true, true, true, false, false,
   jsonb_build_object(
     'on_storefront', true,
     'controlled_by', 'Marketing — marketing_offers, read through sf_active_offers',
     'needs', 'nothing for its content, which Marketing owns. To switch the bar '
           || 'itself on and off from here, the header would have to read this '
           || 'row the way the utility strip already does.',
     'source', 'marketing_offers, filtered to published and in-window offers.')),

  ('sticky-filter-bar', 'Sticky Category & Search Bar', 'behavior',
   'The category filter and search strip that sticks to the top while the page scrolls.',
   NULL, 'Search', 32, 'draft', true, true, true, true, false,
   jsonb_build_object(
     'on_storefront', true,
     'controlled_by', 'none — its sticky behaviour is a CSS class in the page',
     'needs', 'a component that reads its own row, as the utility strip does',
     'source', 'Rendered inside HomeIndex with sticky top-0; its search box '
            || 'filters the catalogue already on the page.'))
ON CONFLICT (module_key) DO NOTHING;

COMMENT ON TABLE public.marketplace_topbar_modules IS
  'Every element of the storefront header, whether or not this manager controls it yet. config.on_storefront says whether it is visible on the page now; config.controlled_by names the manager that owns it; config.needs says what is missing before this manager could. TopUtilityBar reads status, sort_order and the device flags, so those three genuinely change the storefront.';
