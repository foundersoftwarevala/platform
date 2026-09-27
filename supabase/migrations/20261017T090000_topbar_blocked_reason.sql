-- Two corrections to the top bar registry, both found by reading what the
-- registry function promises against what the rows actually carry.
--
-- 1. blocked_reason never had a value.
--
--    mm_topbar_modules returns 'blocked_reason', m.config->>'reason'. No row
--    has ever had config.reason; the key the rows use, and the key
--    mm_topbar_configure quotes back when it refuses to make a module live, is
--    config.needs. So the field the manager screens read to explain why a
--    module cannot go live was null for every module, and the explanation had
--    to be dug out of the config blob by hand.
--
--    It now reads needs, falling back to reason for anything written later
--    under the older key.
--
-- 2. announcement-bar must not claim to be rendered.
--
--    'rendered' is (component is not null), and mm_topbar_configure allows a
--    module to go live only when it is rendered. The row added for the offer
--    ticker named FestiveBanner as its component, which is true of the page but
--    false of the registry: FestiveBanner reads marketing_offers through
--    sf_active_offers and has never looked at this row. Leaving the component
--    set would have let an operator switch the bar to live and see nothing
--    change — the exact failure the not_rendered guard exists to prevent.
--
--    The component is cleared. The row still records that the ticker is on the
--    storefront and that Marketing owns its content; what it no longer does is
--    pretend this manager can turn it off.

CREATE OR REPLACE FUNCTION public.mm_topbar_modules()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'module_key', m.module_key, 'name', m.name, 'category', m.category,
    'description', m.description, 'component', m.component,
    'sort_order', m.sort_order, 'status', m.status,
    'desktop_enabled', m.desktop_enabled,
    'tablet_enabled', m.tablet_enabled,
    'mobile_enabled', m.mobile_enabled,
    'sticky_enabled', m.sticky_enabled,
    'featured', m.featured,
    'config', m.config,
    'live', (m.status = 'live'),
    -- True only when a component in TopUtilityBar actually renders it. A
    -- planned module can be configured, but the manager must not imply it is
    -- on the storefront.
    'rendered', (m.component is not null),
    'planned', coalesce((m.config->>'planned')::boolean, false),
    -- What is missing before this module could go live, in the module's own
    -- words. 'reason' is kept as a fallback so nothing written under the older
    -- key is lost.
    'blocked_reason', coalesce(m.config->>'needs', m.config->>'reason'),
    'updated_at', m.updated_at) order by m.sort_order, m.module_key), '[]'::jsonb)
  from public.marketplace_topbar_modules m
  where m.status <> 'archived';
$function$;

UPDATE public.marketplace_topbar_modules
   SET component = NULL
 WHERE module_key = 'announcement-bar';
