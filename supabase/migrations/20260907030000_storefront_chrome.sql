-- Storefront chrome: the footer and the floating elements.
--
-- Nothing existed for either. There is no footer table, no floating or sticky
-- or widget table, no social link table and no trust badge table anywhere in
-- this database, so these are created rather than reused. Everything they have
-- to talk to does already exist and is reused as it stands: the lead endpoint,
-- the legal policies, the support system, the audit trail and mm_is_operator.
--
-- The editing model is draft-and-publish, because section 35 asks for it and
-- because the footer is on every public page.
--
--   The working tables below are the draft. A manager edits them freely and
--   the public site does not move.
--
--   storefront_published_config holds a snapshot of what is actually live, one
--   row per kind, plus every previous version for history and rollback. The
--   public storefront reads exactly one row - a single indexed lookup per kind
--   for the whole footer, which is what keeps section 54 honest.
--
-- Rollback republishes an old snapshot as a NEW version rather than deleting
-- the ones after it, so history is never rewritten.

/* ----------------------------------------------------------- footer draft */

create table if not exists public.storefront_footer_columns (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  heading     text not null,
  position    integer not null,
  enabled     boolean not null default true,
  created_by  uuid,
  updated_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint storefront_footer_columns_position_ck check (position between 1 and 20)
);

create table if not exists public.storefront_footer_links (
  id          uuid primary key default gen_random_uuid(),
  column_id   uuid not null references public.storefront_footer_columns(id) on delete cascade,
  label       text not null,
  -- What the link points at. `href` is used directly for internal, external,
  -- mailto and tel. For a legal link it is resolved at publish time from the
  -- Legal Manager instead, so the footer never carries a second copy of a
  -- policy URL that could go stale.
  link_type   text not null default 'internal'
              check (link_type in ('internal','external','mailto','tel','legal')),
  href        text,
  legal_policy_type text,
  open_in_new boolean not null default false,
  position    integer not null,
  enabled     boolean not null default true,
  -- Who sees it. Reuses the same vocabulary the floating elements use.
  audience    text not null default 'all' check (audience in ('all','guest','authenticated')),
  created_by  uuid,
  updated_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint storefront_footer_links_position_ck check (position between 1 and 60),
  -- A link must actually be able to resolve to something.
  constraint storefront_footer_links_target_ck check (
    (link_type = 'legal' and legal_policy_type is not null)
    or (link_type <> 'legal' and href is not null and href <> '' and href <> '#')
  )
);

create unique index if not exists storefront_footer_links_pos_uq
  on public.storefront_footer_links (column_id, position);

create table if not exists public.storefront_social_links (
  id          uuid primary key default gen_random_uuid(),
  platform    text not null unique,
  url         text not null,
  handle      text,
  position    integer not null,
  enabled     boolean not null default true,
  created_by  uuid,
  updated_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Section 25. https only, and a real host.
  constraint storefront_social_url_ck check (url ~ '^https://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$')
);

create table if not exists public.storefront_trust_items (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('payment','security','certification','trust')),
  name        text not null,
  -- Section 41. A trust mark is an image and needs its own description.
  alt_text    text not null,
  icon        text,
  href        text,
  position    integer not null,
  enabled     boolean not null default true,
  created_by  uuid,
  updated_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One row. The settings that are not a list.
create table if not exists public.storefront_footer_settings (
  id                    boolean primary key default true check (id),
  show_footer           boolean not null default true,
  newsletter_enabled    boolean not null default false,
  newsletter_title      text not null default 'Get marketplace updates',
  newsletter_description text,
  newsletter_placeholder text not null default 'you@company.com',
  newsletter_success    text not null default 'Thank you — please check your inbox.',
  newsletter_consent    text,
  -- Which subscriber system receives the address. Null means none is
  -- connected, and the storefront must not pretend a subscription worked.
  newsletter_provider   text,
  newsletter_list_id    text,
  trust_strip_enabled   boolean not null default true,
  updated_by            uuid,
  updated_at            timestamptz not null default now()
);

insert into public.storefront_footer_settings (id) values (true)
on conflict (id) do nothing;

/* -------------------------------------------------------- floating drafts */

create table if not exists public.storefront_floating_elements (
  id              uuid primary key default gen_random_uuid(),
  key             text not null unique,
  element_type    text not null
                  check (element_type in ('ai_chat','support','request_demo','actions','link')),
  name            text not null,
  enabled         boolean not null default false,

  -- Section 6. Three devices, independently.
  desktop_enabled boolean not null default true,
  tablet_enabled  boolean not null default true,
  mobile_enabled  boolean not null default true,

  -- Section 7.
  position        text not null default 'bottom-right'
                  check (position in ('bottom-right','bottom-left','top-right','top-left')),
  offset_x        integer not null default 24 check (offset_x between 0 and 200),
  offset_y        integer not null default 24 check (offset_y between 0 and 200),

  -- Section 8. A named theme token, not arbitrary CSS, so the brand holds.
  theme           text not null default 'accent'
                  check (theme in ('accent','primary','success','premium','neutral')),
  icon            text,
  label           text not null,

  -- Section 9.
  trigger_type    text not null default 'immediate'
                  check (trigger_type in ('immediate','delay','scroll','exit_intent')),
  trigger_value   integer not null default 0 check (trigger_value between 0 and 100000),

  -- Section 5 and 12. Where clicking it actually goes.
  action_type     text not null default 'route'
                  check (action_type in ('route','external','whatsapp','mailto','tel','lead_form','none')),
  action_target   text,

  -- Section 11. Lower number wins the corner.
  priority        integer not null default 10 check (priority between 1 and 100),

  -- Section 10.
  audience        text not null default 'all' check (audience in ('all','guest','authenticated')),
  page_scope      text not null default 'all'
                  check (page_scope in ('all','home','marketplace','product','category')),

  starts_at       timestamptz,
  ends_at         timestamptz,
  created_by      uuid,
  updated_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- An element that does something must say where it goes. 'none' and the
  -- multi-action launcher carry their targets elsewhere.
  constraint storefront_floating_action_ck check (
    action_type in ('none','lead_form') or (action_target is not null and action_target <> '')
  )
);

-- Section 11. Two elements may not claim the same corner at the same rank.
create unique index if not exists storefront_floating_corner_uq
  on public.storefront_floating_elements (position, priority);

/* --------------------------------------------------- published + history */

create table if not exists public.storefront_published_config (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('footer','floating')),
  version      integer not null,
  snapshot     jsonb not null,
  is_live      boolean not null default false,
  note         text,
  published_by uuid,
  published_at timestamptz not null default now(),
  unique (kind, version)
);

-- Exactly one live version per kind.
create unique index if not exists storefront_published_live_uq
  on public.storefront_published_config (kind) where is_live;

create index if not exists storefront_published_hist_idx
  on public.storefront_published_config (kind, version desc);

/* ------------------------------------------------------------------- RLS */

alter table public.storefront_footer_columns     enable row level security;
alter table public.storefront_footer_links       enable row level security;
alter table public.storefront_social_links       enable row level security;
alter table public.storefront_trust_items        enable row level security;
alter table public.storefront_footer_settings    enable row level security;
alter table public.storefront_floating_elements  enable row level security;
alter table public.storefront_published_config   enable row level security;

-- The draft tables are operator-only in both directions. The public never
-- reads them: the storefront reads the published snapshot through a function,
-- so an unpublished edit cannot leak onto the site by way of a stray query.
do $$
declare t text;
begin
  foreach t in array array[
    'storefront_footer_columns','storefront_footer_links','storefront_social_links',
    'storefront_trust_items','storefront_footer_settings','storefront_floating_elements',
    'storefront_published_config'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_operator', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.mm_is_operator()) with check (public.mm_is_operator())',
      t || '_operator', t);

    -- Anonymous writes are refused per command rather than with a single ALL
    -- policy: a restrictive ALL policy also covers SELECT, which is how the
    -- hero slides and the homepage sections were both silently unreadable.
    execute format('drop policy if exists %I on public.%I', t || '_anon_ins', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_upd', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_del', t);
    execute format(
      'create policy %I on public.%I as restrictive for insert to anon with check (false)',
      t || '_anon_ins', t);
    execute format(
      'create policy %I on public.%I as restrictive for update to anon using (false) with check (false)',
      t || '_anon_upd', t);
    execute format(
      'create policy %I on public.%I as restrictive for delete to anon using (false)',
      t || '_anon_del', t);
  end loop;
end;
$$;
-- Reading, editing, validating and publishing the storefront chrome.
--
-- Every write goes through mm_is_operator() and mm_audit(), the checks and the
-- trail the rest of the Marketplace Manager already uses. Nothing here is a
-- second authorisation or a second audit system.

/* ------------------------------------------------------------------ legal */

-- Section 28 and 29. A legal footer link resolves through the Legal Manager
-- rather than carrying a URL of its own, so a newly published policy is picked
-- up without anybody editing the footer.
--
-- It returns null today for every policy type, and that is the honest answer:
-- legal_policies holds no rows at all, so nothing is published to link to.
-- Validation reports that rather than the footer quietly dropping the link.
create or replace function public.sf_legal_href(p_policy_type text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select '/legal/' || lower(regexp_replace(p.policy_type, '[^a-zA-Z0-9]+', '-', 'g'))
    from public.legal_policies p
   where p.policy_type = p_policy_type
     and p.status = 'published'
   order by p.last_updated desc nulls last
   limit 1;
$$;

/* ------------------------------------------------------------ draft reads */

create or replace function public.sf_config_draft(p_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  if p_kind = 'footer' then
    select jsonb_build_object(
      'ok', true,
      'kind', 'footer',
      'settings', (select to_jsonb(s) from public.storefront_footer_settings s limit 1),
      'columns', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', c.id, 'key', c.key, 'heading', c.heading,
                 'position', c.position, 'enabled', c.enabled,
                 'links', coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'id', l.id, 'label', l.label, 'link_type', l.link_type,
                            'href', l.href, 'legal_policy_type', l.legal_policy_type,
                            'resolved_href', case when l.link_type = 'legal'
                                                  then public.sf_legal_href(l.legal_policy_type)
                                                  else l.href end,
                            'open_in_new', l.open_in_new, 'position', l.position,
                            'enabled', l.enabled, 'audience', l.audience)
                          order by l.position)
                     from public.storefront_footer_links l where l.column_id = c.id), '[]'::jsonb))
               order by c.position)
          from public.storefront_footer_columns c), '[]'::jsonb),
      'socials', coalesce((
        select jsonb_agg(to_jsonb(s) order by s.position)
          from public.storefront_social_links s), '[]'::jsonb),
      'trust', coalesce((
        select jsonb_agg(to_jsonb(t) order by t.position)
          from public.storefront_trust_items t), '[]'::jsonb)
    ) into v;
  elsif p_kind = 'floating' then
    select jsonb_build_object(
      'ok', true,
      'kind', 'floating',
      'elements', coalesce((
        select jsonb_agg(to_jsonb(f) order by f.position, f.priority)
          from public.storefront_floating_elements f), '[]'::jsonb)
    ) into v;
  else
    return jsonb_build_object('ok', false, 'reason', 'unknown_kind');
  end if;

  return v || jsonb_build_object(
    'live_version', (select version from public.storefront_published_config
                      where kind = p_kind and is_live),
    'published_at', (select published_at from public.storefront_published_config
                      where kind = p_kind and is_live));
end;
$$;

/* --------------------------------------------------------- published read */

-- What the public storefront reads: one row, one lookup, already assembled.
create or replace function public.sf_config_live(p_kind text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select snapshot from public.storefront_published_config
      where kind = p_kind and is_live limit 1),
    -- Never published: an empty answer, which the storefront reads as "use the
    -- built-in footer". It must not be confused with "everything is switched
    -- off", so it carries a flag saying so.
    jsonb_build_object('published', false));
$$;

revoke all on function public.sf_config_live(text) from public;
grant execute on function public.sf_config_live(text) to anon, authenticated, service_role;

/* -------------------------------------------------------------- validation */

-- Section 53. Everything that would make a bad footer, checked before it can
-- reach production rather than after.
create or replace function public.sf_validate(p_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_problems jsonb := '[]'::jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  if p_kind = 'footer' then
    -- A link with nothing to point at.
    v_problems := v_problems || coalesce((
      select jsonb_agg(jsonb_build_object(
               'severity', 'error', 'item', l.label,
               'message', 'Link has no destination.'))
        from public.storefront_footer_links l
       where l.enabled
         and l.link_type <> 'legal'
         and (l.href is null or btrim(l.href) in ('', '#'))), '[]'::jsonb);

    -- A legal link whose policy is not published. This is every legal link
    -- today, because legal_policies is empty.
    v_problems := v_problems || coalesce((
      select jsonb_agg(jsonb_build_object(
               'severity', 'error', 'item', l.label,
               'message', 'No published ' || coalesce(l.legal_policy_type, 'legal')
                          || ' policy exists in the Legal Manager, so this link '
                          || 'cannot resolve.'))
        from public.storefront_footer_links l
       where l.enabled and l.link_type = 'legal'
         and public.sf_legal_href(l.legal_policy_type) is null), '[]'::jsonb);

    -- An internal link that is not a path.
    v_problems := v_problems || coalesce((
      select jsonb_agg(jsonb_build_object(
               'severity', 'error', 'item', l.label,
               'message', 'Internal links must start with /'))
        from public.storefront_footer_links l
       where l.enabled and l.link_type = 'internal' and l.href not like '/%'), '[]'::jsonb);

    -- An external link that is not https.
    v_problems := v_problems || coalesce((
      select jsonb_agg(jsonb_build_object(
               'severity', 'error', 'item', l.label,
               'message', 'External links must be https.'))
        from public.storefront_footer_links l
       where l.enabled and l.link_type = 'external' and l.href not like 'https://%'), '[]'::jsonb);

    -- A column with a heading and nothing in it.
    v_problems := v_problems || coalesce((
      select jsonb_agg(jsonb_build_object(
               'severity', 'warning', 'item', c.heading,
               'message', 'Column has no enabled links and will not render.'))
        from public.storefront_footer_columns c
       where c.enabled
         and not exists (select 1 from public.storefront_footer_links l
                          where l.column_id = c.id and l.enabled)), '[]'::jsonb);

    -- A trust item with no description. Section 41.
    v_problems := v_problems || coalesce((
      select jsonb_agg(jsonb_build_object(
               'severity', 'error', 'item', t.name,
               'message', 'Trust item needs alt text.'))
        from public.storefront_trust_items t
       where t.enabled and btrim(coalesce(t.alt_text, '')) = ''), '[]'::jsonb);

    -- Section 22. Offering a subscription with nowhere to send it.
    v_problems := v_problems || coalesce((
      select jsonb_agg(jsonb_build_object(
               'severity', 'error', 'item', 'Newsletter',
               'message', 'The newsletter is switched on but no provider is '
                       || 'configured, so a subscription could not be stored. '
                       || 'Connect a provider or switch it off.'))
        from public.storefront_footer_settings s
       where s.newsletter_enabled
         and coalesce(btrim(s.newsletter_provider), '') = ''), '[]'::jsonb);

  elsif p_kind = 'floating' then
    -- Section 11. Two enabled widgets in the same corner at the same rank.
    v_problems := v_problems || coalesce((
      select jsonb_agg(jsonb_build_object(
               'severity', 'error', 'item', f.position,
               'message', 'Two enabled elements share this corner and priority.'))
        from (select position, priority, count(*) n
                from public.storefront_floating_elements
               where enabled group by position, priority having count(*) > 1) f), '[]'::jsonb);

    -- An element that is on but cannot be seen on any device.
    v_problems := v_problems || coalesce((
      select jsonb_agg(jsonb_build_object(
               'severity', 'warning', 'item', f.name,
               'message', 'Enabled but hidden on every device.'))
        from public.storefront_floating_elements f
       where f.enabled
         and not f.desktop_enabled and not f.tablet_enabled and not f.mobile_enabled), '[]'::jsonb);

    -- An element pointing at nothing usable.
    v_problems := v_problems || coalesce((
      select jsonb_agg(jsonb_build_object(
               'severity', 'error', 'item', f.name,
               'message', 'Action target is missing or malformed.'))
        from public.storefront_floating_elements f
       where f.enabled
         and f.action_type in ('route','external','whatsapp','mailto','tel')
         and (f.action_target is null
              or (f.action_type = 'route'    and f.action_target not like '/%')
              or (f.action_type in ('external','whatsapp') and f.action_target not like 'https://%')
              or (f.action_type = 'mailto'   and f.action_target not like 'mailto:%')
              or (f.action_type = 'tel'      and f.action_target not like 'tel:%'))), '[]'::jsonb);

    -- A schedule that has already closed.
    v_problems := v_problems || coalesce((
      select jsonb_agg(jsonb_build_object(
               'severity', 'warning', 'item', f.name,
               'message', 'Enabled but its schedule has ended.'))
        from public.storefront_floating_elements f
       where f.enabled and f.ends_at is not null and f.ends_at <= now()), '[]'::jsonb);
  else
    return jsonb_build_object('ok', false, 'reason', 'unknown_kind');
  end if;

  return jsonb_build_object(
    'ok', true,
    'errors',   (select count(*) from jsonb_array_elements(v_problems) e
                  where e->>'severity' = 'error'),
    'warnings', (select count(*) from jsonb_array_elements(v_problems) e
                  where e->>'severity' = 'warning'),
    'problems', v_problems);
end;
$$;
-- Editing and publishing the storefront chrome.

/* ---------------------------------------------------------- footer links */

-- Add or edit one link. Section 18 and 19.
create or replace function public.sf_footer_link_save(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id     uuid := nullif(p_patch->>'id','')::uuid;
  v_col    uuid;
  v_before jsonb;
  v_after  jsonb;
  v_pos    integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  if v_id is not null then
    select to_jsonb(l), l.column_id into v_before, v_col
      from public.storefront_footer_links l where l.id = v_id;
    if v_before is null then
      return jsonb_build_object('ok', false, 'reason', 'unknown_link');
    end if;
  end if;

  v_col := coalesce(nullif(p_patch->>'column_id','')::uuid, v_col);
  if v_col is null then
    return jsonb_build_object('ok', false, 'reason', 'column_required');
  end if;
  if not exists (select 1 from public.storefront_footer_columns where id = v_col) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_column');
  end if;

  if v_id is null then
    -- A new link goes to the end of its column unless told otherwise.
    v_pos := coalesce((p_patch->>'position')::int,
                      (select coalesce(max(position), 0) + 1
                         from public.storefront_footer_links where column_id = v_col));

    insert into public.storefront_footer_links
      (column_id, label, link_type, href, legal_policy_type, open_in_new,
       position, enabled, audience, created_by, updated_by)
    values (
      v_col,
      coalesce(nullif(btrim(p_patch->>'label'),''), 'Untitled link'),
      coalesce(p_patch->>'link_type', 'internal'),
      nullif(btrim(coalesce(p_patch->>'href','')), ''),
      nullif(p_patch->>'legal_policy_type',''),
      coalesce((p_patch->>'open_in_new')::boolean, false),
      v_pos,
      coalesce((p_patch->>'enabled')::boolean, true),
      coalesce(p_patch->>'audience', 'all'),
      auth.uid(), auth.uid())
    returning to_jsonb(storefront_footer_links) into v_after;
  else
    update public.storefront_footer_links l set
      column_id         = v_col,
      label             = coalesce(nullif(btrim(p_patch->>'label'),''), l.label),
      link_type         = coalesce(p_patch->>'link_type', l.link_type),
      href              = case when p_patch ? 'href'
                               then nullif(btrim(p_patch->>'href'),'') else l.href end,
      legal_policy_type = case when p_patch ? 'legal_policy_type'
                               then nullif(p_patch->>'legal_policy_type','')
                               else l.legal_policy_type end,
      open_in_new       = coalesce((p_patch->>'open_in_new')::boolean, l.open_in_new),
      position          = coalesce((p_patch->>'position')::int, l.position),
      enabled           = coalesce((p_patch->>'enabled')::boolean, l.enabled),
      audience          = coalesce(p_patch->>'audience', l.audience),
      updated_by        = auth.uid(),
      updated_at        = now()
    where l.id = v_id
    returning to_jsonb(l) into v_after;
  end if;

  perform public.mm_audit(
    case when v_id is null then 'footer.link.add' else 'footer.link.edit' end,
    'storefront_footer', coalesce(v_id::text, (v_after->>'id')),
    v_before, v_after, null);

  return jsonb_build_object('ok', true, 'link', v_after);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'position_taken',
      'message', 'Another link already holds that position in this column.');
  when check_violation then
    return jsonb_build_object('ok', false, 'reason', 'invalid_link',
      'message', 'A link needs a real destination — a path, an https URL, a '
              || 'mailto address, or a legal policy type.');
end;
$$;

-- Section 20. Disable rather than destroy; deletion is a separate, explicit
-- act that still leaves the audit record behind.
create or replace function public.sf_footer_link_remove(p_id uuid, p_hard boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select to_jsonb(l) into v_before from public.storefront_footer_links l where l.id = p_id;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_link');
  end if;

  if p_hard then
    delete from public.storefront_footer_links where id = p_id;
    perform public.mm_audit('footer.link.delete', 'storefront_footer', p_id::text,
                            v_before, null, 'permanently removed');
    return jsonb_build_object('ok', true, 'deleted', true);
  end if;

  update public.storefront_footer_links
     set enabled = false, updated_by = auth.uid(), updated_at = now()
   where id = p_id;
  perform public.mm_audit('footer.link.disable', 'storefront_footer', p_id::text,
                          v_before, jsonb_build_object('enabled', false), null);
  return jsonb_build_object('ok', true, 'deleted', false);
end;
$$;

-- Section 21. The whole column's order in one statement, so it cannot be left
-- half applied.
create or replace function public.sf_footer_links_reorder(p_column_id uuid, p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb; v_n integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select count(*) into v_n from public.storefront_footer_links
   where column_id = p_column_id and id = any(p_ids);
  if v_n <> coalesce(array_length(p_ids, 1), 0) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_link',
      'message', 'The order names a link that is not in this column.');
  end if;

  select jsonb_agg(jsonb_build_object('id', id, 'position', position) order by position)
    into v_before from public.storefront_footer_links where column_id = p_column_id;

  -- Two passes through a negative range, because (column_id, position) is
  -- unique and a direct renumber would collide with itself half way.
  update public.storefront_footer_links l
     set position = -(array_position(p_ids, l.id))
   where l.column_id = p_column_id and l.id = any(p_ids);

  update public.storefront_footer_links l
     set position = -l.position, updated_by = auth.uid(), updated_at = now()
   where l.column_id = p_column_id and l.position < 0;

  select jsonb_agg(jsonb_build_object('id', id, 'position', position) order by position)
    into v_after from public.storefront_footer_links where column_id = p_column_id;

  perform public.mm_audit('footer.links.reorder', 'storefront_footer',
                          p_column_id::text, v_before, v_after, null);
  return jsonb_build_object('ok', true, 'order', v_after);
end;
$$;

/* ------------------------------------------------ socials, trust, settings */

create or replace function public.sf_social_save(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb; v_platform text := btrim(coalesce(p_patch->>'platform',''));
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if v_platform = '' then
    return jsonb_build_object('ok', false, 'reason', 'platform_required');
  end if;

  select to_jsonb(s) into v_before from public.storefront_social_links s
   where s.platform = v_platform;

  insert into public.storefront_social_links
    (platform, url, handle, position, enabled, created_by, updated_by)
  values (v_platform,
          btrim(coalesce(p_patch->>'url','')),
          nullif(btrim(coalesce(p_patch->>'handle','')), ''),
          coalesce((p_patch->>'position')::int,
                   (select coalesce(max(position),0)+1 from public.storefront_social_links)),
          coalesce((p_patch->>'enabled')::boolean, true),
          auth.uid(), auth.uid())
  on conflict (platform) do update set
    url        = coalesce(nullif(btrim(excluded.url), ''), public.storefront_social_links.url),
    handle     = coalesce(excluded.handle, public.storefront_social_links.handle),
    position   = coalesce(excluded.position, public.storefront_social_links.position),
    enabled    = excluded.enabled,
    updated_by = auth.uid(), updated_at = now()
  returning to_jsonb(storefront_social_links) into v_after;

  perform public.mm_audit('footer.social.save', 'storefront_footer', v_platform,
                          v_before, v_after, null);
  return jsonb_build_object('ok', true, 'social', v_after);
exception when check_violation then
  return jsonb_build_object('ok', false, 'reason', 'invalid_url',
    'message', 'A social profile must be a full https:// address.');
end;
$$;

create or replace function public.sf_trust_save(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid := nullif(p_patch->>'id','')::uuid; v_before jsonb; v_after jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_item');
  end if;
  select to_jsonb(t) into v_before from public.storefront_trust_items t where t.id = v_id;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_item');
  end if;

  update public.storefront_trust_items t set
    name       = coalesce(nullif(btrim(p_patch->>'name'),''), t.name),
    alt_text   = coalesce(nullif(btrim(p_patch->>'alt_text'),''), t.alt_text),
    icon       = case when p_patch ? 'icon' then nullif(p_patch->>'icon','') else t.icon end,
    href       = case when p_patch ? 'href' then nullif(p_patch->>'href','') else t.href end,
    position   = coalesce((p_patch->>'position')::int, t.position),
    enabled    = coalesce((p_patch->>'enabled')::boolean, t.enabled),
    updated_by = auth.uid(), updated_at = now()
  where t.id = v_id
  returning to_jsonb(t) into v_after;

  perform public.mm_audit('footer.trust.save', 'storefront_footer', v_id::text,
                          v_before, v_after, null);
  return jsonb_build_object('ok', true, 'item', v_after);
end;
$$;

create or replace function public.sf_footer_settings_save(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select to_jsonb(s) into v_before from public.storefront_footer_settings s limit 1;

  update public.storefront_footer_settings s set
    show_footer            = coalesce((p_patch->>'show_footer')::boolean, s.show_footer),
    newsletter_enabled     = coalesce((p_patch->>'newsletter_enabled')::boolean, s.newsletter_enabled),
    newsletter_title       = coalesce(nullif(btrim(p_patch->>'newsletter_title'),''), s.newsletter_title),
    newsletter_description = case when p_patch ? 'newsletter_description'
                                  then nullif(p_patch->>'newsletter_description','')
                                  else s.newsletter_description end,
    newsletter_placeholder = coalesce(nullif(btrim(p_patch->>'newsletter_placeholder'),''), s.newsletter_placeholder),
    newsletter_success     = coalesce(nullif(btrim(p_patch->>'newsletter_success'),''), s.newsletter_success),
    newsletter_consent     = case when p_patch ? 'newsletter_consent'
                                  then nullif(p_patch->>'newsletter_consent','')
                                  else s.newsletter_consent end,
    newsletter_provider    = case when p_patch ? 'newsletter_provider'
                                  then nullif(btrim(p_patch->>'newsletter_provider'),'')
                                  else s.newsletter_provider end,
    newsletter_list_id     = case when p_patch ? 'newsletter_list_id'
                                  then nullif(btrim(p_patch->>'newsletter_list_id'),'')
                                  else s.newsletter_list_id end,
    trust_strip_enabled    = coalesce((p_patch->>'trust_strip_enabled')::boolean, s.trust_strip_enabled),
    updated_by = auth.uid(), updated_at = now()
  where s.id
  returning to_jsonb(s) into v_after;

  perform public.mm_audit('footer.settings.save', 'storefront_footer', 'settings',
                          v_before, v_after, null);
  return jsonb_build_object('ok', true, 'settings', v_after);
end;
$$;

/* -------------------------------------------------------- floating writes */

create or replace function public.sf_floating_save(p_key text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select to_jsonb(f) into v_before from public.storefront_floating_elements f where f.key = p_key;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_element');
  end if;

  update public.storefront_floating_elements f set
    name            = coalesce(nullif(btrim(p_patch->>'name'),''), f.name),
    label           = coalesce(nullif(btrim(p_patch->>'label'),''), f.label),
    enabled         = coalesce((p_patch->>'enabled')::boolean, f.enabled),
    desktop_enabled = coalesce((p_patch->>'desktop_enabled')::boolean, f.desktop_enabled),
    tablet_enabled  = coalesce((p_patch->>'tablet_enabled')::boolean, f.tablet_enabled),
    mobile_enabled  = coalesce((p_patch->>'mobile_enabled')::boolean, f.mobile_enabled),
    position        = coalesce(p_patch->>'position', f.position),
    offset_x        = coalesce((p_patch->>'offset_x')::int, f.offset_x),
    offset_y        = coalesce((p_patch->>'offset_y')::int, f.offset_y),
    theme           = coalesce(p_patch->>'theme', f.theme),
    icon            = case when p_patch ? 'icon' then nullif(p_patch->>'icon','') else f.icon end,
    trigger_type    = coalesce(p_patch->>'trigger_type', f.trigger_type),
    trigger_value   = coalesce((p_patch->>'trigger_value')::int, f.trigger_value),
    action_type     = coalesce(p_patch->>'action_type', f.action_type),
    action_target   = case when p_patch ? 'action_target'
                           then nullif(btrim(p_patch->>'action_target'),'') else f.action_target end,
    priority        = coalesce((p_patch->>'priority')::int, f.priority),
    audience        = coalesce(p_patch->>'audience', f.audience),
    page_scope      = coalesce(p_patch->>'page_scope', f.page_scope),
    starts_at       = case when p_patch ? 'starts_at'
                           then nullif(p_patch->>'starts_at','')::timestamptz else f.starts_at end,
    ends_at         = case when p_patch ? 'ends_at'
                           then nullif(p_patch->>'ends_at','')::timestamptz else f.ends_at end,
    updated_by      = auth.uid(), updated_at = now()
  where f.key = p_key
  returning to_jsonb(f) into v_after;

  perform public.mm_audit('floating.save', 'storefront_floating', p_key,
                          v_before, v_after, null);
  return jsonb_build_object('ok', true, 'element', v_after);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'corner_taken',
      'message', 'Another element already sits in that corner at that priority.');
  when check_violation then
    return jsonb_build_object('ok', false, 'reason', 'invalid_config',
      'message', 'That combination is not allowed — check the position, '
              || 'trigger, offsets and action target.');
end;
$$;

/* ------------------------------------------------------------- publishing */

-- Section 34. Validate, snapshot, version, go live. If validation finds an
-- error nothing is published and the caller is told what to fix, so "Published"
-- is never shown over a change that did not happen.
create or replace function public.sf_publish(p_kind text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_check    jsonb;
  v_snapshot jsonb;
  v_version  integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_kind not in ('footer','floating') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_kind');
  end if;

  v_check := public.sf_validate(p_kind);
  if (v_check->>'errors')::int > 0 then
    return jsonb_build_object('ok', false, 'reason', 'validation_failed',
      'message', 'Nothing was published. Fix the errors first.',
      'validation', v_check);
  end if;

  -- The snapshot holds only what the public needs, already resolved: enabled
  -- rows, in order, with legal links turned into real destinations. The
  -- storefront then renders it without another lookup or another decision.
  if p_kind = 'footer' then
    select jsonb_build_object(
      'published', true,
      'show_footer', (select show_footer from public.storefront_footer_settings limit 1),
      'newsletter', (
        select jsonb_build_object(
          'enabled', s.newsletter_enabled
                     and coalesce(btrim(s.newsletter_provider),'') <> '',
          'title', s.newsletter_title, 'description', s.newsletter_description,
          'placeholder', s.newsletter_placeholder, 'consent', s.newsletter_consent,
          'success', s.newsletter_success)
          from public.storefront_footer_settings s limit 1),
      'columns', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'heading', c.heading,
                 'links', (select jsonb_agg(jsonb_build_object(
                                    'label', l.label,
                                    'href', case when l.link_type = 'legal'
                                                 then public.sf_legal_href(l.legal_policy_type)
                                                 else l.href end,
                                    'open_in_new', l.open_in_new,
                                    'audience', l.audience) order by l.position)
                             from public.storefront_footer_links l
                            where l.column_id = c.id and l.enabled
                              and (l.link_type <> 'legal'
                                   or public.sf_legal_href(l.legal_policy_type) is not null)))
               order by c.position)
          from public.storefront_footer_columns c
         where c.enabled
           and exists (select 1 from public.storefront_footer_links l
                        where l.column_id = c.id and l.enabled)), '[]'::jsonb),
      'socials', coalesce((
        select jsonb_agg(jsonb_build_object('label', s.platform, 'href', s.url,
                                            'handle', s.handle) order by s.position)
          from public.storefront_social_links s where s.enabled), '[]'::jsonb),
      'trust', coalesce((
        select jsonb_agg(jsonb_build_object('kind', t.kind, 'name', t.name,
                                            'alt', t.alt_text, 'icon', t.icon,
                                            'href', t.href) order by t.position)
          from public.storefront_trust_items t
         where t.enabled
           and (select trust_strip_enabled from public.storefront_footer_settings limit 1)),
        '[]'::jsonb)
    ) into v_snapshot;
  else
    select jsonb_build_object(
      'published', true,
      'elements', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'key', f.key, 'type', f.element_type, 'label', f.label,
                 'position', f.position, 'offset_x', f.offset_x, 'offset_y', f.offset_y,
                 'theme', f.theme, 'icon', f.icon, 'priority', f.priority,
                 'desktop', f.desktop_enabled, 'tablet', f.tablet_enabled,
                 'mobile', f.mobile_enabled,
                 'trigger', f.trigger_type, 'trigger_value', f.trigger_value,
                 'action', f.action_type, 'target', f.action_target,
                 'audience', f.audience, 'scope', f.page_scope)
               order by f.position, f.priority)
          from public.storefront_floating_elements f
         where f.enabled
           and (f.starts_at is null or f.starts_at <= now())
           and (f.ends_at   is null or f.ends_at   >  now())), '[]'::jsonb)
    ) into v_snapshot;
  end if;

  select coalesce(max(version), 0) + 1 into v_version
    from public.storefront_published_config where kind = p_kind;

  update public.storefront_published_config set is_live = false
   where kind = p_kind and is_live;

  insert into public.storefront_published_config
    (kind, version, snapshot, is_live, note, published_by)
  values (p_kind, v_version, v_snapshot, true, p_note, auth.uid());

  perform public.mm_audit('storefront.publish', 'storefront_' || p_kind,
                          p_kind, null,
                          jsonb_build_object('version', v_version), p_note);

  return jsonb_build_object('ok', true, 'kind', p_kind, 'version', v_version,
                            'validation', v_check, 'snapshot', v_snapshot);
end;
$$;

-- Section 37. Rolling back republishes an old snapshot as a new version, so the
-- versions in between stay on the record.
create or replace function public.sf_rollback(p_kind text, p_version integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_snapshot jsonb; v_new integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select snapshot into v_snapshot from public.storefront_published_config
   where kind = p_kind and version = p_version;
  if v_snapshot is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_version');
  end if;

  select coalesce(max(version), 0) + 1 into v_new
    from public.storefront_published_config where kind = p_kind;

  update public.storefront_published_config set is_live = false
   where kind = p_kind and is_live;

  insert into public.storefront_published_config
    (kind, version, snapshot, is_live, note, published_by)
  values (p_kind, v_new, v_snapshot, true,
          format('Rollback to version %s', p_version), auth.uid());

  perform public.mm_audit('storefront.rollback', 'storefront_' || p_kind, p_kind,
                          jsonb_build_object('from_version', p_version),
                          jsonb_build_object('new_version', v_new), null);

  return jsonb_build_object('ok', true, 'version', v_new, 'restored_from', p_version);
end;
$$;

-- Section 36.
create or replace function public.sf_versions(p_kind text, p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  return jsonb_build_object('ok', true, 'versions', coalesce((
    select jsonb_agg(jsonb_build_object(
             'version', v.version, 'is_live', v.is_live, 'note', v.note,
             'published_at', v.published_at,
             'published_by', (select u.email from auth.users u where u.id = v.published_by))
           order by v.version desc)
      from (select * from public.storefront_published_config
             where kind = p_kind order by version desc limit greatest(p_limit,1)) v),
    '[]'::jsonb));
end;
$$;
-- Reorder a footer column in one statement.
--
-- The first version renumbered through a negative range to dodge the unique
-- index on (column_id, position), because renumbering in place collides with
-- itself half way through. That traded one constraint for another: position
-- also carries a check that it is between 1 and 60, so the negative pass
-- failed on the very first row.
--
-- The right tool is a deferrable constraint. With uniqueness checked at commit
-- instead of per row, the new order can be written directly - every position
-- valid at every moment, and the arrangement only has to be consistent once the
-- statement finishes.
--
-- A unique INDEX cannot be deferred, only a unique CONSTRAINT, so the index is
-- replaced by an equivalent constraint. Uniqueness itself is unchanged.

alter table public.storefront_footer_links
  drop constraint if exists storefront_footer_links_pos_uq;
drop index if exists public.storefront_footer_links_pos_uq;

alter table public.storefront_footer_links
  add constraint storefront_footer_links_pos_uq
  unique (column_id, position) deferrable initially immediate;

create or replace function public.sf_footer_links_reorder(p_column_id uuid, p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb; v_n integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select count(*) into v_n from public.storefront_footer_links
   where column_id = p_column_id and id = any(p_ids);
  if v_n <> coalesce(array_length(p_ids, 1), 0) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_link',
      'message', 'The order names a link that is not in this column.');
  end if;

  select jsonb_agg(jsonb_build_object('id', id, 'label', label, 'position', position)
                   order by position)
    into v_before from public.storefront_footer_links where column_id = p_column_id;

  -- Uniqueness is checked when the statement commits, so the whole column can
  -- be renumbered at once and every intermediate row stays inside 1..60.
  set constraints public.storefront_footer_links_pos_uq deferred;

  update public.storefront_footer_links l
     set position = array_position(p_ids, l.id),
         updated_by = auth.uid(),
         updated_at = now()
   where l.column_id = p_column_id and l.id = any(p_ids);

  select jsonb_agg(jsonb_build_object('id', id, 'label', label, 'position', position)
                   order by position)
    into v_after from public.storefront_footer_links where column_id = p_column_id;

  perform public.mm_audit('footer.links.reorder', 'storefront_footer',
                          p_column_id::text, v_before, v_after, null);
  return jsonb_build_object('ok', true, 'order', v_after);
end;
$$;
