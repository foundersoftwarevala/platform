-- One registry for both top bar managers.
--
-- There are two screens for the same header: "Top Bar" (TopBarManagerSection)
-- and "Storefront Bar" (StorefrontTopBarSection, titled Public Top Bar Manager).
-- The second is entirely hardcoded — twelve nav strings, seven apply roles, ten
-- languages, ten currencies, a hand-drawn preview and `<Switch on />` with no
-- state and no handler, under a "Publish Top Bar" button with no onClick.
--
-- Both screens must read one source, so this brings the second screen's twelve
-- modules into marketplace_topbar_modules alongside the ten the header renders.
-- Nothing is removed, as instructed.
--
-- Six of the second screen's twelve are not rendered by TopUtilityBar at all:
-- Logo, Products, Categories, Solutions, Pricing and Register. They are
-- registered as drafts carrying the reason, so the manager lists them honestly
-- as planned rather than either deleting them or pretending they are live.
--
-- The reverse gap matters too: Calendar, Calculator, Favorites and Dashboards
-- are on the real header and were missing from the second screen entirely.
-- Reading one registry fixes that in both directions.

insert into public.marketplace_topbar_modules
  (module_key, name, category, description, component, sort_order, status,
   desktop_enabled, tablet_enabled, mobile_enabled, config)
values
  ('logo', 'Logo', 'brand',
   'Software Vala brand mark in the header.',
   null, 20, 'draft', true, true, true,
   '{"planned":true,"reason":"TopUtilityBar renders no logo; the brand mark sits elsewhere on the page.","needs":"a header brand component"}'::jsonb),

  ('products-menu', 'Products Menu', 'menus',
   'Products dropdown. Would draw on the real catalogue.',
   null, 21, 'draft', true, true, false,
   '{"planned":true,"reason":"No products menu exists in TopUtilityBar.","data_available":"marketplace_products, 5469 published","needs":"a header dropdown component"}'::jsonb),

  ('categories-menu', 'Categories Menu', 'menus',
   'Categories dropdown. Would draw on the real category list.',
   null, 22, 'draft', true, true, false,
   '{"planned":true,"reason":"No categories menu exists in TopUtilityBar.","data_available":"marketplace_categories, 91 rows, served by /api/marketplace/rows","needs":"a header dropdown component"}'::jsonb),

  ('solutions-menu', 'Solutions Menu', 'menus',
   'Solutions dropdown.',
   null, 23, 'draft', true, true, false,
   '{"planned":true,"reason":"No solutions menu exists in TopUtilityBar.","data_available":"none - there is no solutions table","needs":"both a data source and a component"}'::jsonb),

  ('pricing-menu', 'Pricing Menu', 'menus',
   'Pricing dropdown. Would draw on real product pricing.',
   null, 24, 'draft', true, true, false,
   '{"planned":true,"reason":"No pricing menu exists in TopUtilityBar.","data_available":"marketplace_product_pricing, 3714 rows","needs":"a header dropdown component"}'::jsonb),

  ('register', 'Register', 'identity',
   'Registration entry point.',
   null, 25, 'draft', true, true, true,
   '{"planned":true,"reason":"TopUtilityBar renders LoginPill only; there is no separate register control.","auth":"supabase - sign-up is reached through the login flow"}'::jsonb)
on conflict (module_key) do nothing;

-- ---------------------------------------------------------------------------
-- Say plainly, in the read, whether a module is actually rendered.
-- ---------------------------------------------------------------------------
-- Both screens need to distinguish "live and on the page" from "registered but
-- not built yet", and neither should have to infer it.

create or replace function public.mm_topbar_modules()
returns jsonb
language sql stable security definer set search_path = public as $$
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
    'blocked_reason', m.config->>'reason',
    'updated_at', m.updated_at) order by m.sort_order, m.module_key), '[]'::jsonb)
  from public.marketplace_topbar_modules m
  where m.status <> 'archived';
$$;

grant execute on function public.mm_topbar_modules() to anon, authenticated;

-- A module the header cannot render must not be publishable, or somebody will
-- switch it live and reasonably expect it on the storefront.
create or replace function public.mm_topbar_configure(p_key text, p_patch jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_before jsonb; v_component text; v_planned boolean;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select to_jsonb(m), m.component, coalesce((m.config->>'planned')::boolean,false)
    into v_before, v_component, v_planned
  from public.marketplace_topbar_modules m where m.module_key = p_key;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_module');
  end if;

  if p_patch->>'status' = 'live' and v_component is null then
    return jsonb_build_object('ok', false, 'reason', 'not_rendered',
      'message', 'Nothing in the header renders this module yet, so making it '
                 'live would not put it on the storefront. '
                 || coalesce(v_before->'config'->>'needs', ''));
  end if;

  update public.marketplace_topbar_modules set
    name            = coalesce(p_patch->>'name', name),
    status          = coalesce(p_patch->>'status', status),
    sort_order      = coalesce((p_patch->>'sort_order')::int, sort_order),
    desktop_enabled = coalesce((p_patch->>'desktop_enabled')::boolean, desktop_enabled),
    tablet_enabled  = coalesce((p_patch->>'tablet_enabled')::boolean, tablet_enabled),
    mobile_enabled  = coalesce((p_patch->>'mobile_enabled')::boolean, mobile_enabled),
    sticky_enabled  = coalesce((p_patch->>'sticky_enabled')::boolean, sticky_enabled),
    featured        = coalesce((p_patch->>'featured')::boolean, featured),
    config          = coalesce(p_patch->'config', config),
    updated_by = auth.uid(), updated_at = now()
  where module_key = p_key;

  perform public.mm_audit('topbar_configure', 'topbar_module', p_key,
    v_before, p_patch, 'top bar module changed');

  return jsonb_build_object('ok', true, 'module', p_key);
end $$;

grant execute on function public.mm_topbar_configure(text,jsonb) to authenticated;
