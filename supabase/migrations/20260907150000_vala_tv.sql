-- Vala TV, on a real table.
--
-- The section on the public homepage is fed by a client-side store seeded with
-- six videos. All six point at the same placeholder YouTube id, all six carry
-- invented view counts — 12k, 8.3k, 15k, 9.4k, 6.7k, 5.2k — and their titles
-- name products that do not exist in the catalogue: MediCore 360, ShopEngine,
-- EduFlow. Those titles and those view counts are on softwarevala.net right
-- now.
--
-- There is no video table in this database at all, so one is created. Nothing
-- is seeded into it. The homepage section already returns null when it has no
-- videos, so until somebody adds a real one the section simply does not appear
-- — which is the honest state for a video wall with no videos.

create table if not exists public.vala_tv_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text not null unique,
  position   integer not null default 50,
  visible    boolean not null default true,
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vala_tv_videos (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  -- The address of the video itself. A row without one cannot be published.
  url           text,
  thumbnail_url text,
  duration      text,
  category_id   uuid references public.vala_tv_categories(id) on delete set null,
  product_id    uuid references public.marketplace_products(id) on delete set null,
  language      text default 'en',
  country       text,
  status        text not null default 'draft'
                check (status in ('draft','scheduled','published','archived')),
  featured      boolean not null default false,
  position      integer not null default 50,
  publish_at    timestamptz,
  published_at  timestamptz,
  seo_title     text,
  seo_description text,
  -- Counted from vala_tv_views, never typed in. The old store carried a views
  -- string like "12k" that nothing had measured.
  created_by    uuid,
  updated_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists vala_tv_videos_status_idx on public.vala_tv_videos (status, position);
create index if not exists vala_tv_videos_category_idx on public.vala_tv_videos (category_id);

-- One row per view, so a view count is a count rather than a claim.
create table if not exists public.vala_tv_views (
  id         uuid primary key default gen_random_uuid(),
  video_id   uuid not null references public.vala_tv_videos(id) on delete cascade,
  user_id    uuid,
  session_id text,
  watched_ms integer,
  completed  boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists vala_tv_views_video_idx on public.vala_tv_views (video_id, created_at desc);

-- The six categories the screen already lists.
insert into public.vala_tv_categories (name, slug, position) values
  ('Product Demo',  'product-demo',  1),
  ('Walkthrough',   'walkthrough',   2),
  ('Customer Film', 'customer-film', 3),
  ('White Label',   'white-label',   4),
  ('SaaS',          'saas',          5),
  ('Academy',       'academy',       6)
on conflict (slug) do nothing;

/* ------------------------------------------------------------------- reads */

-- What the storefront shows. Published, in window, ordered. Empty is normal
-- and means the section does not render.
create or replace function public.sf_vala_tv()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id, 'title', v.title, 'description', v.description,
           'url', v.url, 'thumbnail', v.thumbnail_url, 'duration', v.duration,
           'category', c.name, 'featured', v.featured,
           'product_slug', p.slug,
           -- Counted, not declared. Null when nothing has been recorded, so a
           -- card can omit it rather than print a zero that looks like failure.
           'views', nullif((select count(*) from public.vala_tv_views w
                             where w.video_id = v.id), 0))
         order by v.featured desc, v.position, v.published_at desc nulls last), '[]'::jsonb)
    from public.vala_tv_videos v
    left join public.vala_tv_categories c on c.id = v.category_id
    left join public.marketplace_products p on p.id = v.product_id
   where v.status = 'published'
     and coalesce(btrim(v.url), '') <> ''
     and (v.publish_at is null or v.publish_at <= now());
$$;

revoke all on function public.sf_vala_tv() from public;
grant execute on function public.sf_vala_tv() to anon, authenticated, service_role;

-- The manager's view, counted.
create or replace function public.mm_vala_tv()
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

  return jsonb_build_object(
    'ok', true,
    'total',      (select count(*) from public.vala_tv_videos),
    'published',  (select count(*) from public.vala_tv_videos where status='published'),
    'drafts',     (select count(*) from public.vala_tv_videos where status='draft'),
    'scheduled',  (select count(*) from public.vala_tv_videos where status='scheduled'),
    'archived',   (select count(*) from public.vala_tv_videos where status='archived'),
    'categories', (select count(*) from public.vala_tv_categories where not archived),
    'views',      (select count(*) from public.vala_tv_views),
    'live_now',   jsonb_array_length(public.sf_vala_tv()),
    'videos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id, 'title', v.title, 'url', v.url, 'status', v.status,
               'category', c.name, 'featured', v.featured, 'position', v.position,
               'product', p.name,
               'views', (select count(*) from public.vala_tv_views w where w.video_id = v.id),
               'publish_at', v.publish_at, 'updated_at', v.updated_at)
             order by v.position, v.created_at desc)
        from public.vala_tv_videos v
        left join public.vala_tv_categories c on c.id = v.category_id
        left join public.marketplace_products p on p.id = v.product_id), '[]'::jsonb),
    'category_list', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'slug', slug,
                                          'position', position, 'visible', visible)
             order by position)
        from public.vala_tv_categories where not archived), '[]'::jsonb));
end;
$$;

/* ------------------------------------------------------------------ writes */

create or replace function public.mm_vala_tv_save(p_patch jsonb)
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

  if v_id is not null then
    select to_jsonb(v) into v_before from public.vala_tv_videos v where v.id = v_id;
    if v_before is null then
      return jsonb_build_object('ok', false, 'reason', 'unknown_video');
    end if;
  end if;

  if v_id is null then
    insert into public.vala_tv_videos
      (title, description, url, thumbnail_url, duration, category_id, product_id,
       language, country, status, featured, position, publish_at,
       seo_title, seo_description, created_by, updated_by)
    values (
      coalesce(nullif(btrim(p_patch->>'title'),''), 'Untitled video'),
      nullif(p_patch->>'description',''),
      nullif(btrim(p_patch->>'url'),''),
      nullif(p_patch->>'thumbnail_url',''),
      nullif(p_patch->>'duration',''),
      nullif(p_patch->>'category_id','')::uuid,
      nullif(p_patch->>'product_id','')::uuid,
      coalesce(nullif(p_patch->>'language',''), 'en'),
      nullif(p_patch->>'country',''),
      -- A new video is a draft. Adding one must not put it on the homepage
      -- before anybody has watched it.
      'draft',
      coalesce((p_patch->>'featured')::boolean, false),
      coalesce((p_patch->>'position')::int, 50),
      nullif(p_patch->>'publish_at','')::timestamptz,
      nullif(p_patch->>'seo_title',''),
      nullif(p_patch->>'seo_description',''),
      auth.uid(), auth.uid())
    returning to_jsonb(vala_tv_videos) into v_after;
  else
    update public.vala_tv_videos v set
      title         = coalesce(nullif(btrim(p_patch->>'title'),''), v.title),
      description   = case when p_patch ? 'description' then nullif(p_patch->>'description','') else v.description end,
      url           = case when p_patch ? 'url' then nullif(btrim(p_patch->>'url'),'') else v.url end,
      thumbnail_url = case when p_patch ? 'thumbnail_url' then nullif(p_patch->>'thumbnail_url','') else v.thumbnail_url end,
      duration      = case when p_patch ? 'duration' then nullif(p_patch->>'duration','') else v.duration end,
      category_id   = case when p_patch ? 'category_id' then nullif(p_patch->>'category_id','')::uuid else v.category_id end,
      product_id    = case when p_patch ? 'product_id' then nullif(p_patch->>'product_id','')::uuid else v.product_id end,
      language      = coalesce(nullif(p_patch->>'language',''), v.language),
      country       = case when p_patch ? 'country' then nullif(p_patch->>'country','') else v.country end,
      featured      = coalesce((p_patch->>'featured')::boolean, v.featured),
      position      = coalesce((p_patch->>'position')::int, v.position),
      publish_at    = case when p_patch ? 'publish_at' then nullif(p_patch->>'publish_at','')::timestamptz else v.publish_at end,
      seo_title     = case when p_patch ? 'seo_title' then nullif(p_patch->>'seo_title','') else v.seo_title end,
      seo_description = case when p_patch ? 'seo_description' then nullif(p_patch->>'seo_description','') else v.seo_description end,
      updated_by = auth.uid(), updated_at = now()
    where v.id = v_id
    returning to_jsonb(v) into v_after;
  end if;

  perform public.mm_audit(
    case when v_id is null then 'valatv.created' else 'valatv.updated' end,
    'vala_tv_video', coalesce(v_id::text, v_after->>'id'), v_before, v_after, null);

  return jsonb_build_object('ok', true, 'video', v_after);
end;
$$;

create or replace function public.mm_vala_tv_status(p_id uuid, p_to text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v record; v_before jsonb; v_after jsonb; v_problems text[] := '{}';
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_to not in ('draft','scheduled','published','archived') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_status');
  end if;

  select * into v from public.vala_tv_videos where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_video');
  end if;
  v_before := to_jsonb(v);

  -- Publishing is the step that reaches the public homepage, so it is the one
  -- that checks the video can actually be watched.
  if p_to = 'published' then
    if coalesce(btrim(v.url), '') = '' then
      v_problems := v_problems || 'The video has no address, so nothing would play.'::text;
    end if;
    if coalesce(btrim(v.title), '') = '' then
      v_problems := v_problems || 'The video needs a title.'::text;
    end if;
    if array_length(v_problems, 1) > 0 then
      return jsonb_build_object('ok', false, 'reason', 'validation_failed',
                                'problems', to_jsonb(v_problems));
    end if;
  end if;

  update public.vala_tv_videos set
    status = p_to,
    published_at = case when p_to = 'published' then coalesce(published_at, now()) else published_at end,
    updated_by = auth.uid(), updated_at = now()
  where id = p_id
  returning to_jsonb(vala_tv_videos) into v_after;

  perform public.mm_audit('valatv.' || p_to, 'vala_tv_video', p_id::text,
                          v_before, v_after, p_reason);

  return jsonb_build_object('ok', true, 'video', v_after,
                            'live_now', jsonb_array_length(public.sf_vala_tv()));
end;
$$;

-- A view is recorded once per session per video, so a reload is not a view.
create or replace function public.sf_vala_tv_view(p_video uuid, p_session text,
                                                  p_watched_ms integer default null,
                                                  p_completed boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.vala_tv_videos
                  where id = p_video and status = 'published') then
    return jsonb_build_object('ok', false, 'reason', 'not_published');
  end if;

  if exists (select 1 from public.vala_tv_views
              where video_id = p_video
                and coalesce(session_id,'') = coalesce(p_session,'')
                and created_at > now() - interval '6 hours') then
    return jsonb_build_object('ok', true, 'counted', false);
  end if;

  insert into public.vala_tv_views (video_id, user_id, session_id, watched_ms, completed)
  values (p_video, auth.uid(), p_session, p_watched_ms, coalesce(p_completed, false));

  return jsonb_build_object('ok', true, 'counted', true);
end;
$$;

grant execute on function public.sf_vala_tv_view(uuid, text, integer, boolean)
  to anon, authenticated;

/* --------------------------------------------------------------------- RLS */

alter table public.vala_tv_videos     enable row level security;
alter table public.vala_tv_categories enable row level security;
alter table public.vala_tv_views      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['vala_tv_videos','vala_tv_categories','vala_tv_views'] loop
    execute format('drop policy if exists %I on public.%I', t || '_operator', t);
    execute format('create policy %I on public.%I for all to authenticated
                      using (public.mm_is_operator()) with check (public.mm_is_operator())',
                   t || '_operator', t);
    -- The public reads through sf_vala_tv(), which filters to published rows,
    -- so the tables need no anonymous read. Denials are per command, never a
    -- restrictive ALL that would also cancel a SELECT.
    execute format('drop policy if exists %I on public.%I', t || '_anon_sel', t);
    execute format('create policy %I on public.%I as restrictive for select to anon using (false)',
                   t || '_anon_sel', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_ins', t);
    execute format('create policy %I on public.%I as restrictive for insert to anon with check (false)',
                   t || '_anon_ins', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_upd', t);
    execute format('create policy %I on public.%I as restrictive for update to anon using (false) with check (false)',
                   t || '_anon_upd', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_del', t);
    execute format('create policy %I on public.%I as restrictive for delete to anon using (false)',
                   t || '_anon_del', t);
  end loop;
end;
$$;
