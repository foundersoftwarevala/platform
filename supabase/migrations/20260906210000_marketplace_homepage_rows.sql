-- Homepage Rows: the control system of section 4.
--
-- marketplace_homepage_sections exists with eight columns - key, title, enabled,
-- sort_order and a config blob - and is empty and unread. The homepage builds
-- its category rows directly from marketplace_categories, so the Manager's
-- Homepage Rows screen has nothing behind it and its controls are honest
-- placeholders.
--
-- Section 4 asks for a real CMS: a row that knows what it shows, where it comes
-- from, when it runs, who it runs for and how it performed. Every existing
-- column is kept, so anything that ever wrote to this table still works.
--
-- The important design decision is the fallback. The marketplace homepage is
-- the front door of this business and must never go blank, so a configured row
-- set is treated as an override, not a requirement: with no published rows the
-- homepage behaves exactly as it does today. Control is added without becoming
-- a new way for the page to break.

alter table public.marketplace_homepage_sections
  add column if not exists row_type text not null default 'category',
  add column if not exists subtitle text,
  add column if not exists description text,
  add column if not exists source text not null default 'category',
  add column if not exists category_id uuid,
  add column if not exists collection_key text,
  add column if not exists product_filter jsonb not null default '{}'::jsonb,
  add column if not exists manual_product_ids uuid[] not null default '{}',
  add column if not exists sort_by text not null default 'position',
  add column if not exists item_limit integer not null default 12,
  add column if not exists visible_desktop boolean not null default true,
  add column if not exists visible_mobile boolean not null default true,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists priority integer not null default 0,
  add column if not exists status text not null default 'draft',
  add column if not exists cta_label text,
  add column if not exists cta_href text,
  add column if not exists impressions bigint not null default 0,
  add column if not exists clicks bigint not null default 0,
  add column if not exists conversions bigint not null default 0,
  add column if not exists owner_user_id uuid,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid,
  add column if not exists archived_at timestamptz,
  add column if not exists duplicated_from uuid;

alter table public.marketplace_homepage_sections drop constraint if exists mhs_status_check;
alter table public.marketplace_homepage_sections add constraint mhs_status_check
  check (status in ('draft','review','scheduled','published','unpublished','archived'));

alter table public.marketplace_homepage_sections drop constraint if exists mhs_source_check;
alter table public.marketplace_homepage_sections add constraint mhs_source_check
  check (source in ('category','collection','manual','filter','featured','trending','new','recommended'));

create index if not exists mhs_status_idx   on public.marketplace_homepage_sections(status, sort_order);
create index if not exists mhs_schedule_idx on public.marketplace_homepage_sections(starts_at, ends_at);
create index if not exists mhs_category_idx on public.marketplace_homepage_sections(category_id);

-- ------------------------------------------------------------------ who ----
create or replace function public.mm_is_operator()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin','boss','founder','super_admin','boss_owner','marketing','seo')
  );
$$;

revoke all on function public.mm_is_operator() from public, anon;
grant execute on function public.mm_is_operator() to authenticated;

-- ------------------------------------------------- audit completeness ------
-- Section 24 lists what a marketplace audit event has to carry: the actor and
-- their role, the entity, the state before and after, the reason, the source
-- module and something to correlate a request by. The table held the actor's id
-- and a metadata blob, so a change could be recorded with no way of saying what
-- it changed or who, by name, changed it.
alter table public.marketplace_audit_logs
  add column if not exists actor        text,
  add column if not exists actor_role   text,
  add column if not exists before_state jsonb,
  add column if not exists after_state  jsonb,
  add column if not exists reason       text,
  add column if not exists module       text not null default 'marketplace',
  add column if not exists request_id   text,
  add column if not exists ip_address   text;

create index if not exists marketplace_audit_entity_idx
  on public.marketplace_audit_logs(entity_type, entity_id, created_at desc);
create index if not exists marketplace_audit_actor_idx
  on public.marketplace_audit_logs(actor_id);

-- The trail is history: append-only, enforced by trigger so it holds even for a
-- role that bypasses policies.
create or replace function public.mm_audit_is_append_only()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'the marketplace audit log is append-only; % is not permitted', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists marketplace_audit_no_rewrite on public.marketplace_audit_logs;
create trigger marketplace_audit_no_rewrite
before update or delete on public.marketplace_audit_logs
for each row execute function public.mm_audit_is_append_only();

-- ---------------------------------------------------------------- audit ----
-- Section 24: every consequential change is recorded, in the marketplace audit
-- table that already exists rather than a new one.
create or replace function public.mm_audit(
  p_action text, p_entity_type text, p_entity_id text default null,
  p_before jsonb default null, p_after jsonb default null,
  p_reason text default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id uuid; v_email text; v_role text; v_entity uuid;
begin
  select u.email into v_email from auth.users u where u.id = auth.uid();
  select ur.role::text into v_role from public.user_roles ur where ur.user_id = auth.uid() limit 1;

  -- entity_id on this table is a uuid. Callers pass text because not every
  -- entity in the marketplace is keyed by one; anything that is not a uuid is
  -- kept in the metadata rather than dropped.
  begin
    v_entity := p_entity_id::uuid;
  exception when others then
    v_entity := null;
  end;

  insert into public.marketplace_audit_logs
    (action, entity_type, entity_id, actor, actor_id, actor_role,
     before_state, after_state, reason, module, metadata)
  values
    (p_action, p_entity_type, v_entity,
     coalesce(v_email, case when auth.uid() is null then 'system' else 'account' end),
     auth.uid(), coalesce(v_role, 'system'),
     p_before, p_after, p_reason, 'marketplace_manager',
     jsonb_build_object('entity', p_entity_type, 'entity_ref', p_entity_id))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.mm_audit(text, text, text, jsonb, jsonb, text) from public, anon;
grant execute on function public.mm_audit(text, text, text, jsonb, jsonb, text) to authenticated;

-- ------------------------------------------------------- the row lifecycle --
-- Section 4 and 29: draft, review, scheduled, published, unpublished, archived.
-- Each move is one call, so the state and the audit entry cannot come apart.
create or replace function public.mm_row_set_status(
  p_row_id uuid, p_status text, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  r public.marketplace_homepage_sections%rowtype;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_status not in ('draft','review','scheduled','published','unpublished','archived') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_status');
  end if;

  select * into r from public.marketplace_homepage_sections where id = p_row_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_such_row'); end if;

  -- A scheduled row needs a window, or "scheduled" means nothing.
  if p_status = 'scheduled' and r.starts_at is null then
    return jsonb_build_object('ok', false, 'reason', 'a scheduled row needs a start time');
  end if;

  update public.marketplace_homepage_sections
     set status = p_status,
         enabled = (p_status = 'published'),
         published_at = case when p_status = 'published' then now() else published_at end,
         published_by = case when p_status = 'published' then auth.uid() else published_by end,
         archived_at = case when p_status = 'archived' then now() else null end,
         updated_by = auth.uid()
   where id = p_row_id;

  perform public.mm_audit(
    case p_status
      when 'published' then 'Homepage Row Published'
      when 'unpublished' then 'Homepage Row Unpublished'
      when 'archived' then 'Homepage Row Archived'
      when 'scheduled' then 'Homepage Row Scheduled'
      else 'Homepage Row Status Changed' end,
    'homepage_row', p_row_id::text,
    jsonb_build_object('status', r.status),
    jsonb_build_object('status', p_status), p_reason);

  return jsonb_build_object('ok', true, 'status', p_status, 'row', r.key);
end;
$$;

-- Reordering is one call for the whole set: doing it row by row leaves the page
-- in a half-ordered state if anything fails in the middle.
create or replace function public.mm_row_reorder(p_ordered_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare i integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  for i in 1 .. coalesce(array_length(p_ordered_ids, 1), 0) loop
    update public.marketplace_homepage_sections
       set sort_order = i, updated_by = auth.uid()
     where id = p_ordered_ids[i];
  end loop;

  perform public.mm_audit('Homepage Rows Reordered', 'homepage_row', null, null,
    jsonb_build_object('order', p_ordered_ids));

  return jsonb_build_object('ok', true, 'rows', coalesce(array_length(p_ordered_ids, 1), 0));
end;
$$;

create or replace function public.mm_row_duplicate(p_row_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  r public.marketplace_homepage_sections%rowtype;
  v_new uuid;
  v_key text;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select * into r from public.marketplace_homepage_sections where id = p_row_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_such_row'); end if;

  v_key := r.key || '-copy-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.marketplace_homepage_sections
    (key, title, subtitle, description, row_type, source, category_id, collection_key,
     product_filter, manual_product_ids, sort_by, item_limit, visible_desktop,
     visible_mobile, priority, cta_label, cta_href, config, sort_order,
     -- A duplicate always starts as a draft. Copying a live row straight onto
     -- the homepage is how a page ends up showing the same shelf twice.
     status, enabled, created_by, updated_by, duplicated_from)
  values
    (v_key, r.title || ' (copy)', r.subtitle, r.description, r.row_type, r.source,
     r.category_id, r.collection_key, r.product_filter, r.manual_product_ids,
     r.sort_by, r.item_limit, r.visible_desktop, r.visible_mobile, r.priority,
     r.cta_label, r.cta_href, r.config,
     coalesce((select max(sort_order) + 1 from public.marketplace_homepage_sections), 1),
     'draft', false, auth.uid(), auth.uid(), p_row_id)
  returning id into v_new;

  perform public.mm_audit('Homepage Row Duplicated', 'homepage_row', v_new::text,
    jsonb_build_object('from', r.key), jsonb_build_object('key', v_key));

  return jsonb_build_object('ok', true, 'row_id', v_new, 'key', v_key);
end;
$$;

-- ------------------------------------------------------- what the page shows --
-- The published, in-window rows, in order. Used by the Manager's preview and by
-- the homepage itself, so the preview cannot drift from the page.
create or replace function public.mm_active_rows(p_surface text default 'desktop')
returns table (
  id uuid, key text, title text, subtitle text, row_type text, source text,
  category_id uuid, collection_key text, manual_product_ids uuid[],
  sort_by text, item_limit integer, cta_label text, cta_href text, sort_order integer
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select s.id, s.key, s.title, s.subtitle, s.row_type, s.source, s.category_id,
         s.collection_key, s.manual_product_ids, s.sort_by, s.item_limit,
         s.cta_label, s.cta_href, s.sort_order
  from public.marketplace_homepage_sections s
  where s.status = 'published'
    and s.enabled
    and (s.starts_at is null or s.starts_at <= now())
    and (s.ends_at is null or s.ends_at > now())
    and case when p_surface = 'mobile' then s.visible_mobile else s.visible_desktop end
  order by s.sort_order, s.priority desc;
$$;

grant execute on function public.mm_active_rows(text) to anon, authenticated;
revoke all on function public.mm_row_set_status(uuid, text, text) from public, anon;
revoke all on function public.mm_row_reorder(uuid[]) from public, anon;
revoke all on function public.mm_row_duplicate(uuid) from public, anon;
grant execute on function public.mm_row_set_status(uuid, text, text) to authenticated;
grant execute on function public.mm_row_reorder(uuid[]) to authenticated;
grant execute on function public.mm_row_duplicate(uuid) to authenticated;

create unique index if not exists mhs_key_unique on public.marketplace_homepage_sections(key);

drop trigger if exists marketplace_audit_no_rewrite on public.marketplace_audit_logs;
CREATE TRIGGER marketplace_audit_no_rewrite BEFORE DELETE OR UPDATE ON public.marketplace_audit_logs FOR EACH ROW EXECUTE FUNCTION mm_audit_is_append_only();
