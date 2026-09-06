-- Top Bar modules, seeded from what the header actually renders.
--
-- The scan settles the count. TopUtilityBar.tsx defines thirteen components and
-- composes exactly ten of them into the bar: ApplyNow, LanguagePicker,
-- CalendarTool, CalculatorTool, LoginPill, CurrencyPicker, Notifications,
-- Favorites, AiChat and DashboardsMenu. PanelHead, Weather and WorldClock are
-- helpers inside CalendarTool, not modules of their own.
--
-- The manager says twenty-five. That number is a hardcoded string on line 59 of
-- TopBarManagerSection.tsx — `eyebrow="Top Bar Manager · 25 modules"` — sitting
-- above a static MODULES array. The Live/Draft/Hidden cards do count, but they
-- count that array, so they were真 counts of fake rows.
--
-- No top bar, header or navigation table exists anywhere in the database, so
-- this is genuinely new rather than a duplicate. It is deliberately a child of
-- the section registry: `utility-bar` is already registered in
-- marketplace_homepage_sections, and these are the modules inside that one
-- section, which is a different granularity rather than a second system.

create table if not exists public.marketplace_topbar_modules (
  id            uuid primary key default gen_random_uuid(),
  module_key    text not null unique,
  name          text not null,
  category      text not null default 'tools'
                  check (category in ('brand','navigation','menus','locale','tools',
                                      'identity','bars','behavior','responsive')),
  description   text,
  -- The component that actually renders it, so a manager can see where it lives
  -- and nobody has to guess which file to edit.
  component     text,
  icon          text,
  sort_order    int not null default 0,
  status        text not null default 'live'
                  check (status in ('live','draft','hidden','archived')),
  desktop_enabled boolean not null default true,
  tablet_enabled  boolean not null default true,
  mobile_enabled  boolean not null default true,
  sticky_enabled  boolean not null default false,
  featured        boolean not null default false,
  config        jsonb not null default '{}'::jsonb,
  created_by    uuid,
  updated_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists mm_topbar_order_idx
  on public.marketplace_topbar_modules (sort_order, module_key);

comment on table public.marketplace_topbar_modules is
  'Modules inside the homepage utility bar (TopUtilityBar.tsx). A child of the '
  'utility-bar row in marketplace_homepage_sections, not a second header system.';

alter table public.marketplace_topbar_modules enable row level security;

-- The homepage must be able to read this anonymously, or the header cannot
-- honour it for a signed-out visitor.
drop policy if exists mm_topbar_read on public.marketplace_topbar_modules;
create policy mm_topbar_read on public.marketplace_topbar_modules
  for select to anon, authenticated using (true);

drop policy if exists mm_topbar_write on public.marketplace_topbar_modules;
create policy mm_topbar_write on public.marketplace_topbar_modules
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

-- ---------------------------------------------------------------------------
-- The real ten, in the order TopUtilityBar composes them.
-- ---------------------------------------------------------------------------
insert into public.marketplace_topbar_modules
  (module_key, name, category, description, component, sort_order, status, config)
values
  ('apply-now', 'Apply Now', 'identity',
   'Role application entry point. Roles come from the APPLY_ROLES list in the component.',
   'ApplyNow', 1, 'live',
   '{"source":"APPLY_ROLES constant in TopUtilityBar.tsx","owner":"marketplace-manager"}'::jsonb),
  ('language', 'Language', 'locale',
   'Language picker. Reads src/lib/language-catalog.ts (143 entries).',
   'LanguagePicker', 2, 'live',
   '{"source":"src/lib/language-catalog.ts","note":"dropdown only; marketplace_translations is empty"}'::jsonb),
  ('calendar', 'Calendar', 'tools',
   'Calendar with world clock, weather and holidays.',
   'CalendarTool', 3, 'live',
   '{"helpers":["WorldClock","Weather"],"source":"ZONES, WX and HOLIDAY_COUNTRIES constants"}'::jsonb),
  ('calculator', 'Calculator', 'tools',
   'On-page calculator. Entirely client-side, no backend needed.',
   'CalculatorTool', 4, 'live',
   '{"source":"KEYS constant","backend":"none required"}'::jsonb),
  ('login', 'Login', 'identity',
   'Sign-in entry point. Uses the existing Supabase auth, no second auth system.',
   'LoginPill', 5, 'live',
   '{"auth":"supabase","owner":"platform-auth"}'::jsonb),
  ('currency', 'Currency', 'locale',
   'Currency picker.',
   'CurrencyPicker', 6, 'live',
   '{"source":"CURRENCIES constant in TopUtilityBar.tsx","note":"no currency table exists"}'::jsonb),
  ('notifications', 'Notifications', 'tools',
   'Notification bell and unread count.',
   'Notifications', 7, 'live',
   '{"owner":"platform-notifications"}'::jsonb),
  ('favorites', 'My Favorites', 'tools',
   'Saved products.',
   'Favorites', 8, 'live',
   '{"source":"localStorage via src/lib/marketplace-home/persistentState.ts","note":"no favourites table exists"}'::jsonb),
  ('ai-chat', 'AI Chat', 'tools',
   'Vala AI entry point in the header.',
   'AiChat', 9, 'live',
   '{"owner":"ai-manager","note":"api_keys holds 15 registrations with 0 stored secrets"}'::jsonb),
  ('dashboards', 'Dashboards', 'navigation',
   'Role dashboard menu.',
   'DashboardsMenu', 10, 'live',
   '{"source":"DASHBOARD_ROLES constant in TopUtilityBar.tsx"}'::jsonb)
on conflict (module_key) do nothing;

-- ---------------------------------------------------------------------------
-- Reads and writes.
-- ---------------------------------------------------------------------------

-- What the header should render. Anonymous-readable, because the header renders
-- for signed-out visitors too.
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
    -- Live means the header should render it at all.
    'live', (m.status = 'live'),
    'updated_at', m.updated_at) order by m.sort_order, m.module_key), '[]'::jsonb)
  from public.marketplace_topbar_modules m
  where m.status <> 'archived';
$$;

grant execute on function public.mm_topbar_modules() to anon, authenticated;

create or replace function public.mm_topbar_configure(p_key text, p_patch jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_before jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select to_jsonb(m) into v_before
  from public.marketplace_topbar_modules m where m.module_key = p_key;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_module');
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

-- Reordering writes sort_order, which is what the header sorts on.
create or replace function public.mm_topbar_reorder(p_keys text[])
returns jsonb
language plpgsql security definer set search_path = public as $$
declare i int := 0; k text; n int := 0;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  foreach k in array p_keys loop
    i := i + 1;
    update public.marketplace_topbar_modules
       set sort_order = i, updated_by = auth.uid(), updated_at = now()
     where module_key = k;
    if found then n := n + 1; end if;
  end loop;
  perform public.mm_audit('topbar_reorder', 'topbar_module', 'all',
    '{}'::jsonb, jsonb_build_object('order', to_jsonb(p_keys)), 'top bar reordered');
  return jsonb_build_object('ok', true, 'modules', n);
end $$;

grant execute on function public.mm_topbar_reorder(text[]) to authenticated;
