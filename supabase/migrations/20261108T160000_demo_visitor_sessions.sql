-- Short-lived records for public demo launches.
-- The UUID is a tracking/isolation hint; the external demo must understand it
-- before it can isolate server-side application data.

create table if not exists public.demo_visitor_sessions (
  visitor_session_id uuid primary key,
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  demo_url_id uuid not null references public.product_demo_urls(id) on delete cascade,
  category_id uuid not null references public.marketplace_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  constraint demo_visitor_sessions_expiry_check check (expires_at > created_at)
);

create index if not exists demo_visitor_sessions_expiry_idx
  on public.demo_visitor_sessions (expires_at);

create index if not exists demo_visitor_sessions_ended_idx
  on public.demo_visitor_sessions (ended_at)
  where ended_at is not null;

comment on table public.demo_visitor_sessions is
  'Thirty-minute demo launch records. The session UUID is forwarded to the external demo as sv_session_id; it is not an isolation boundary unless that demo supports it.';

create or replace function public.sv_demo_session_create(p_slug text)
returns table (
  session_id uuid,
  product_id uuid,
  demo_id uuid,
  category_id uuid,
  product_slug text,
  product_name text,
  demo_name text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_demo record;
  v_session_id uuid := gen_random_uuid();
  v_expires_at timestamptz := now() + interval '30 minutes';
begin
  select p.id as product_id,
         d.id as demo_id,
         p.category_id,
         p.slug as product_slug,
         p.name as product_name,
         coalesce(d.demo_name, '') as demo_name
    into v_demo
    from public.marketplace_products p
    join public.marketplace_categories c
      on c.id = p.category_id and c.is_hidden = false
    join public.product_demo_urls d
      on d.product_id = p.id
     and d.status = 'active'
     and nullif(btrim(d.url), '') is not null
     and d.detected_category_id = p.category_id
   where p.slug = p_slug
     and p.visible = true
     and p.moderation_status = 'approved'
     and coalesce(p.content_status, 'published') = 'published'
     and (p.publish_at is null or p.publish_at <= now())
     and (p.unpublish_at is null or p.unpublish_at > now())
     and p.category_id is not null
   order by d.sort_order asc, d.created_at desc
   limit 1;

  if not found then
    return;
  end if;

  delete from public.demo_visitor_sessions s
   where s.visitor_session_id in (
     select expired.visitor_session_id
       from public.demo_visitor_sessions expired
      where expired.expires_at <= now() or expired.ended_at is not null
      order by coalesce(expired.ended_at, expired.expires_at)
      limit 500
   );

  insert into public.demo_visitor_sessions
    (visitor_session_id, product_id, demo_url_id, category_id, expires_at)
  values
    (v_session_id, v_demo.product_id, v_demo.demo_id, v_demo.category_id, v_expires_at);

  return query
  select v_session_id, v_demo.product_id, v_demo.demo_id, v_demo.category_id,
         v_demo.product_slug, v_demo.product_name, v_demo.demo_name, v_expires_at;
end
$$;

create or replace function public.sv_demo_session_resolve(p_session_id uuid, p_slug text)
returns table (
  session_id uuid,
  product_id uuid,
  demo_id uuid,
  category_id uuid,
  product_slug text,
  product_name text,
  demo_name text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select s.visitor_session_id,
         s.product_id,
         s.demo_url_id,
         s.category_id,
         p.slug,
         p.name,
         coalesce(d.demo_name, ''),
         s.expires_at
    from public.demo_visitor_sessions s
    join public.marketplace_products p on p.id = s.product_id
    join public.marketplace_categories c
      on c.id = s.category_id and c.is_hidden = false
    join public.product_demo_urls d
      on d.id = s.demo_url_id and d.product_id = s.product_id
   where s.visitor_session_id = p_session_id
     and p.slug = p_slug
     and p.category_id = s.category_id
     and p.visible = true
     and p.moderation_status = 'approved'
     and coalesce(p.content_status, 'published') = 'published'
     and (p.publish_at is null or p.publish_at <= now())
     and (p.unpublish_at is null or p.unpublish_at > now())
     and d.status = 'active'
     and nullif(btrim(d.url), '') is not null
     and d.detected_category_id = p.category_id
     and s.expires_at > now()
     and s.ended_at is null
   limit 1
$$;

create or replace function public.sv_demo_session_original(
  p_session_id uuid,
  p_slug text,
  p_demo_id uuid,
  p_category_id uuid
)
returns table (url text, name text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select d.url, coalesce(nullif(d.demo_name, ''), p.name)
    from public.demo_visitor_sessions s
    join public.marketplace_products p on p.id = s.product_id
    join public.marketplace_categories c
      on c.id = s.category_id and c.is_hidden = false
    join public.product_demo_urls d
      on d.id = s.demo_url_id and d.product_id = s.product_id
   where s.visitor_session_id = p_session_id
     and p.slug = p_slug
     and s.demo_url_id = p_demo_id
     and s.category_id = p_category_id
     and p.category_id = s.category_id
     and p.visible = true
     and p.moderation_status = 'approved'
     and coalesce(p.content_status, 'published') = 'published'
     and (p.publish_at is null or p.publish_at <= now())
     and (p.unpublish_at is null or p.unpublish_at > now())
     and d.status = 'active'
     and nullif(btrim(d.url), '') is not null
     and d.detected_category_id = p.category_id
     and s.expires_at > now()
     and s.ended_at is null
   limit 1
$$;

create or replace function public.sv_demo_session_end(p_session_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  update public.demo_visitor_sessions
     set ended_at = now()
   where visitor_session_id = p_session_id
     and ended_at is null
$$;

revoke all on public.demo_visitor_sessions from public;
revoke all on function public.sv_demo_session_create(text) from public;
revoke all on function public.sv_demo_session_resolve(uuid, text) from public;
revoke all on function public.sv_demo_session_original(uuid, text, uuid, uuid) from public;
revoke all on function public.sv_demo_session_end(uuid) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'sv_app') then
    grant execute on function public.sv_demo_session_create(text) to sv_app;
    grant execute on function public.sv_demo_session_resolve(uuid, text) to sv_app;
    grant execute on function public.sv_demo_session_original(uuid, text, uuid, uuid) to sv_app;
    grant execute on function public.sv_demo_session_end(uuid) to sv_app;
  end if;
end
$$;
