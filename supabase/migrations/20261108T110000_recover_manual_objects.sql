-- Recover eight objects that exist on the production database but in no migration.
--
-- A read-only comparison of the VPS database (sv_platform) against this
-- repository found one table and seven functions that were created by hand on
-- the server and never written down. The application calls six of them:
--
--   i18n_sessions                    Translate Engine native-language sessions
--   i18n_native_create_session()     src/lib/i18n/session.server.ts
--   i18n_native_revoke_session()     src/lib/i18n/session.server.ts
--   i18n_native_session_caller()     src/lib/i18n/session.server.ts
--   i18n_public_catalogue_texts()    src/lib/i18n/catalogue.server.ts
--   mm_notify()                      marketplace notifications (3 callers)
--   submit_influencer_application()  influencer application form
--   sv_whoami()                      diagnostic; no caller in the app
--
-- Rebuilding a database from the migrations would have lost all of them, and
-- with them the Translate Engine's native session layer. The definitions below
-- are copied from the server as they stand (pg_dump and pg_get_functiondef,
-- 2026-10-11) and change nothing about how they behave.
--
-- Safe to run anywhere, any number of times: the table and index are created
-- only if missing, the functions are CREATE OR REPLACE with identical bodies,
-- and the grants are reset to exactly what the server holds. On the VPS this is
-- a no-op. The sv_app role exists only on the VPS, so its grants are applied
-- only where that role exists.

begin;

-- Function bodies reference tables from earlier migrations; validate them when
-- they run, as pg_dump does, so the file does not depend on statement order.
set local check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- i18n_sessions
-- ---------------------------------------------------------------------------

create table if not exists public.i18n_sessions (
  token_hash text not null,
  user_id    uuid not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now() not null,
  constraint i18n_sessions_pkey primary key (token_hash),
  constraint i18n_sessions_token_hash_check check ((token_hash ~ '^[a-f0-9]{64}$'::text)),
  constraint i18n_sessions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

create index if not exists i18n_sessions_expiry_idx on public.i18n_sessions using btree (expires_at);

-- RLS on with no policies: only the service role and the definer functions
-- below can read or write a session.
alter table public.i18n_sessions enable row level security;

revoke all on table public.i18n_sessions from public, anon, authenticated;
grant all on table public.i18n_sessions to service_role;

-- ---------------------------------------------------------------------------
-- i18n_native_create_session
-- ---------------------------------------------------------------------------

create or replace function public.i18n_native_create_session(p_email text, p_password text, p_hash text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare account_id uuid;
begin
  if p_hash !~ '^[a-f0-9]{64}$' or length(p_email)>320 or length(p_password)>1024 then
    raise exception 'invalid native language session request';
  end if;
  select u.id into account_id from auth.users u
    where lower(u.email)=lower(p_email) and u.deleted_at is null and u.confirmed_at is not null
      and not coalesce(u.is_sso_user,false)
      and (u.banned_until is null or u.banned_until<=now())
      and u.encrypted_password<>'' and u.encrypted_password=extensions.crypt(p_password,u.encrypted_password)
      and not exists (select 1 from auth.mfa_factors f where f.user_id=u.id and f.status::text='verified')
    limit 1;
  if account_id is null then return null; end if;
  delete from public.i18n_sessions where expires_at<=now();
  insert into public.i18n_sessions(token_hash,user_id,expires_at)
    values(p_hash,account_id,now()+interval '1 hour');
  return account_id;
end $function$;

-- ---------------------------------------------------------------------------
-- i18n_native_revoke_session
-- ---------------------------------------------------------------------------

create or replace function public.i18n_native_revoke_session(p_hash text)
 returns void
 language sql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  delete from public.i18n_sessions where token_hash=p_hash
$function$;

-- ---------------------------------------------------------------------------
-- i18n_native_session_caller
-- ---------------------------------------------------------------------------

create or replace function public.i18n_native_session_caller(p_hash text)
 returns table(user_id uuid, operator boolean)
 language sql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  select s.user_id, exists (
    select 1 from public.user_roles r where r.user_id=s.user_id and r.role::text in ('admin','boss')
  )
  from public.i18n_sessions s join auth.users u on u.id=s.user_id
  where s.token_hash=p_hash and s.expires_at>now() and u.deleted_at is null
    and (u.banned_until is null or u.banned_until<=now())
    and u.confirmed_at is not null
    and not coalesce(u.is_sso_user,false)
    and not exists (select 1 from auth.mfa_factors f where f.user_id=u.id and f.status::text='verified')
$function$;

-- ---------------------------------------------------------------------------
-- i18n_public_catalogue_texts
-- ---------------------------------------------------------------------------

create or replace function public.i18n_public_catalogue_texts()
 returns table(source_text text)
 language sql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  with published as (
    select p.* from public.marketplace_products p
    where p.visible and p.content_status='published' and p.deleted_at is null
      and (p.publish_at is null or p.publish_at<=now())
      and (p.unpublish_at is null or p.unpublish_at>now())
  ), text_values as (
    select v.text from published p cross join lateral (
      values (p.name), (p.industry_label), (p.description),
        (left(btrim(p.description),240)), (p.subcategory),
        (p.badge), (p.price_period), (p.license), (p.deployment)
    ) v(text)
    union all
    select jsonb_array_elements_text(
      case when jsonb_typeof(p.features)='array' then p.features else '[]'::jsonb end
    ) from published p
    union all
    select c.name from public.marketplace_categories c where not coalesce(c.is_hidden,false)
    union all
    select v.text from public.marketplace_row_config r cross join lateral
      (values(r.title),(r.cta_label)) v(text)
    where r.status='published'
      and (r.starts_at is null or r.starts_at<=now())
      and (r.ends_at is null or r.ends_at>now())
  )
  select distinct btrim(v.text) from text_values v
  where v.text is not null and length(btrim(v.text)) between 2 and 2000
$function$;

-- ---------------------------------------------------------------------------
-- mm_notify
-- ---------------------------------------------------------------------------

create or replace function public.mm_notify(p_event text, p_title text, p_message text, p_user uuid default null::uuid, p_role_target text[] default null::text[], p_action_url text default null::text, p_action_label text default null::text, p_dedupe_minutes integer default 60, p_severity text default 'info'::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
  v_targets uuid[];
  v_target uuid;
  v_sent integer := 0;
  v_skipped integer := 0;
begin
  if coalesce(btrim(p_title), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'title_required');
  end if;
  if p_user is null and p_role_target is null then
    return jsonb_build_object('ok', false, 'reason', 'no_recipient');
  end if;

  -- user_id is NOT NULL on this table, so a role broadcast is fanned out to
  -- the people who hold the role rather than stored as one row with no owner.
  -- That is the better shape anyway: read and dismissed are per person, so one
  -- operator clearing an alert does not clear it for everybody else.
  if p_user is not null then
    v_targets := array[p_user];
  else
    select coalesce(array_agg(distinct ur.user_id), '{}')
      into v_targets
      from public.user_roles ur
     where ur.role::text = any(p_role_target);
  end if;

  if coalesce(array_length(v_targets, 1), 0) = 0 then
    return jsonb_build_object('ok', true, 'delivered', 0,
                              'reason', 'no_recipient_holds_that_role');
  end if;

  foreach v_target in array v_targets loop
    -- Concurrent sends to one person for one event deduplicate too.
    perform pg_advisory_xact_lock(hashtextextended('mm_notify:' || v_target::text || ':' || p_event, 0));
    -- Deduplicated per person, so a demo that stays offline does not produce
    -- ninety-six identical rows a day for each operator.
    if exists (
      select 1 from public.user_notifications n
       where n.event_type = p_event
         and n.user_id = v_target
         and n.created_at > now() - make_interval(mins => greatest(p_dedupe_minutes, 0))
         and not coalesce(n.is_dismissed, false))
    then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.user_notifications
      (user_id, type, message, event_type, action_label, action_url,
       is_buzzer, is_read, is_dismissed, role_target)
    values (v_target,
            case when p_severity in ('info','success','warning','danger','priority')
                 then p_severity else 'info' end,
            case when coalesce(btrim(p_message), '') = '' then p_title
                 else p_title || ' - ' || p_message end,
            p_event, p_action_label, p_action_url,
            -- A buzzer is for the things somebody has to act on.
            p_event in ('demo.offline', 'seo.page_broken', 'license.issue_failed'),
            false, false, p_role_target)
    returning id into v_id;
    v_sent := v_sent + 1;
  end loop;

  return jsonb_build_object('ok', true, 'delivered', v_sent,
                            'deduplicated', v_skipped > 0 and v_sent = 0,
                            'suppressed', v_skipped, 'id', v_id);
end;
$function$;

-- ---------------------------------------------------------------------------
-- submit_influencer_application
-- ---------------------------------------------------------------------------

create or replace function public.submit_influencer_application(p_full_name text, p_email text, p_phone text, p_country text, p_region text, p_social_profiles jsonb, p_followers bigint, p_niche text, p_content_types text[], p_engagement_rate numeric, p_payment_details jsonb, p_tax_details jsonb, p_agreement_accepted boolean, p_consent_accepted boolean, p_terms_accepted boolean, p_application jsonb default null::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.influencer_applications%rowtype;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sign in to apply'; end if;
  if not (p_agreement_accepted and p_consent_accepted and p_terms_accepted) then
    raise exception 'All agreement, consent and terms acknowledgements are required';
  end if;
  if nullif(btrim(coalesce(p_full_name, '')), '') is null or nullif(btrim(coalesce(p_email, '')), '') is null
     or nullif(btrim(coalesce(p_niche, '')), '') is null then
    raise exception 'Missing required fields: full name, email and niche';
  end if;
  select * into v from public.influencer_applications
   where applicant_user_id = v_user and status in ('pending', 'in_review')
   order by created_at desc limit 1;
  if found then
    return jsonb_build_object('id', v.id, 'application_number', v.application_number, 'status', v.status,
                              'created_at', v.created_at, 'duplicate', true);
  end if;
  insert into public.influencer_applications(applicant_user_id, full_name, email, phone, country, region, social_profiles,
    followers, niche, content_types, engagement_rate, payment_details, tax_details,
    agreement_accepted, consent_accepted, terms_accepted, application)
  values (v_user, p_full_name, p_email, p_phone, p_country, p_region, coalesce(p_social_profiles, '{}'),
    p_followers, p_niche, coalesce(p_content_types, '{}'), p_engagement_rate, coalesce(p_payment_details, '{}'),
    coalesce(p_tax_details, '{}'), p_agreement_accepted, p_consent_accepted, p_terms_accepted,
    case when p_application is null then null
         else (p_application - 'agreementAccepted') || jsonb_build_object('agreement_accepted_at', now()) end)
  returning * into v;
  insert into public.influencer_audit_logs(actor_user_id, entity_type, entity_id, action, after_data)
  values (v_user, 'application', v.id, 'submitted', to_jsonb(v));
  perform public.mm_notify('influencer.application_submitted', 'Application received',
    format('Your influencer application %s is pending review.', v.application_number),
    v_user, null, null, null, 0, 'info');
  return jsonb_build_object('id', v.id, 'application_number', v.application_number, 'status', v.status,
                            'created_at', v.created_at, 'duplicate', false);
end;
$function$;

-- ---------------------------------------------------------------------------
-- sv_whoami
-- ---------------------------------------------------------------------------

create or replace function public.sv_whoami()
 returns json
 language sql
 stable
as $function$
  select json_build_object(
    'current_user', current_user,
    'current_role', current_role,
    'session_user', session_user,
    'bypassrls', (select rolbypassrls from pg_roles where rolname = current_user),
    'products_visible_here', (select count(*) from public.marketplace_products)
  );
$function$;

-- ---------------------------------------------------------------------------
-- Grants: exactly what the server holds. A new function is executable by
-- PUBLIC by default, so every function is reset first and granted back.
-- ---------------------------------------------------------------------------

revoke all on function public.i18n_native_create_session(text, text, text) from public, anon, authenticated;
revoke all on function public.i18n_native_revoke_session(text) from public, anon, authenticated;
revoke all on function public.i18n_native_session_caller(text) from public, anon, authenticated;
revoke all on function public.i18n_public_catalogue_texts() from public, anon, authenticated;
grant execute on function public.i18n_native_create_session(text, text, text) to service_role;
grant execute on function public.i18n_native_revoke_session(text) to service_role;
grant execute on function public.i18n_native_session_caller(text) to service_role;
grant execute on function public.i18n_public_catalogue_texts() to service_role;

revoke all on function public.mm_notify(text, text, text, uuid, text[], text, text, integer, text) from public, anon, authenticated;
grant execute on function public.mm_notify(text, text, text, uuid, text[], text, text, integer, text) to service_role;

revoke all on function public.submit_influencer_application(text, text, text, text, text, jsonb, bigint, text, text[], numeric, jsonb, jsonb, boolean, boolean, boolean, jsonb) from public;
grant execute on function public.submit_influencer_application(text, text, text, text, text, jsonb, bigint, text, text[], numeric, jsonb, jsonb, boolean, boolean, boolean, jsonb) to anon, authenticated, service_role;

grant execute on function public.sv_whoami() to public, anon, authenticated, service_role;

-- The application's own database role on the VPS. Absent elsewhere.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'sv_app') then
    execute 'grant execute on function public.i18n_native_create_session(text, text, text) to sv_app';
    execute 'grant execute on function public.i18n_native_revoke_session(text) to sv_app';
    execute 'grant execute on function public.i18n_native_session_caller(text) to sv_app';
    execute 'grant execute on function public.i18n_public_catalogue_texts() to sv_app';
  end if;
end;
$$;

commit;
