-- One owner per header element, and the two rows that broke that rule.
--
-- marketplace_homepage_sections is the canonical registry of what the homepage
-- is made of, and it already carries an owner per section. Read against it,
-- two of the rows added to the top bar registry claim something that is
-- already owned:
--
--   offer-banner       owner marketing-manager, component FestiveBanner.
--                      Registered in the top bar as announcement-bar.
--
--   search-bar         a homepage section in its own right, the sticky
--                      category-and-search strip. Registered in the top bar as
--                      sticky-filter-bar.
--
-- Listing them in both places is the duplicate ownership this platform keeps
-- paying for: two screens that both look authoritative, drifting apart until
-- nobody knows which one decides. So the top bar rows are archived rather than
-- deleted — archived is the status this registry already uses for "kept for
-- audit, not active", and mm_topbar_modules excludes it — and each records
-- where its real owner lives.
--
-- The brand rows stay. The header's logo, wordmark and tagline are not a
-- homepage section and have no owner anywhere else; the top bar is where they
-- belong, and their rows already say honestly that nothing renders them from
-- configuration yet.
--
-- Two sections had no owner at all, which is the same problem from the other
-- side: an element nobody is responsible for. Both are filled in from what
-- actually renders them.

UPDATE public.marketplace_topbar_modules
   SET status = 'archived',
       config = config || jsonb_build_object(
         'controlled_by', 'Marketing — marketplace_homepage_sections.offer-banner, owner marketing-manager',
         'archived_reason',
           'Already owned as the offer-banner homepage section. Kept for audit '
        || 'so the header inventory still records that the ticker exists.')
 WHERE module_key = 'announcement-bar';

UPDATE public.marketplace_topbar_modules
   SET status = 'archived',
       config = config || jsonb_build_object(
         'controlled_by', 'marketplace_homepage_sections.search-bar',
         'archived_reason',
           'Already owned as the search-bar homepage section. Kept for audit '
        || 'so the header inventory still records that the sticky strip exists.')
 WHERE module_key = 'sticky-filter-bar';

-- ------------------------------------------------ the two unowned sections
UPDATE public.marketplace_homepage_sections
   SET config = config || jsonb_build_object(
         'owner', 'marketplace-manager',
         'owner_note',
           'The sticky category filter and search strip. Rendered inline in '
        || 'HomeIndex; its search filters the catalogue already on the page.')
 WHERE key = 'search-bar'
   AND coalesce(config->>'owner', '') = '';

UPDATE public.marketplace_homepage_sections
   SET config = config || jsonb_build_object(
         'owner', 'marketplace-manager',
         'owner_note',
           'The product rows themselves. Their composition is managed in '
        || 'Homepage Rows; this section is the slot they render into.')
 WHERE key = 'catalog-rows'
   AND coalesce(config->>'owner', '') = '';
