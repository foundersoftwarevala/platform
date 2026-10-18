begin;

-- Native language sessions contain no credentials, only revocable token hashes.
create table if not exists public.i18n_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists i18n_sessions_expiry_idx on public.i18n_sessions(expires_at);
alter table public.i18n_sessions enable row level security;
revoke all on public.i18n_sessions from public, anon, authenticated;
grant select, insert, delete on public.i18n_sessions to service_role;

create or replace function public.i18n_native_session_caller(p_hash text)
returns table(user_id uuid, operator boolean)
language sql stable security definer set search_path = pg_catalog, public as $$
  select s.user_id, exists (
    select 1 from public.user_roles r where r.user_id=s.user_id and r.role::text in ('admin','boss')
  )
  from public.i18n_sessions s join auth.users u on u.id=s.user_id
  where s.token_hash=p_hash and s.expires_at>now() and u.deleted_at is null
    and (u.banned_until is null or u.banned_until<=now())
    and u.confirmed_at is not null
    and not coalesce(u.is_sso_user,false)
    and not exists (select 1 from auth.mfa_factors f where f.user_id=u.id and f.status::text='verified')
$$;

create or replace function public.i18n_native_create_session(p_email text, p_password text, p_hash text)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
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
end $$;

create or replace function public.i18n_native_revoke_session(p_hash text)
returns void language sql security definer set search_path = pg_catalog, public as $$
  delete from public.i18n_sessions where token_hash=p_hash
$$;

revoke all on function public.i18n_native_session_caller(text),
  public.i18n_native_create_session(text,text,text),public.i18n_native_revoke_session(text)
  from public,anon,authenticated;
grant execute on function public.i18n_native_session_caller(text),
  public.i18n_native_create_session(text,text,text),public.i18n_native_revoke_session(text)
  to sv_app,service_role;

-- Public catalogue reads now go through the native pack/translation privacy gate.
-- Keep the existing independently authorized operator SEO console functional.
drop policy if exists "anon_write_denied" on public.marketplace_translations;
drop policy if exists "translations public read" on public.marketplace_translations;
drop policy if exists i18n_legacy_operator_read on public.marketplace_translations;
create policy i18n_legacy_operator_read on public.marketplace_translations for select
  to authenticated using (
    public.has_role(auth.uid(),'admin'::public.app_role)
    or public.has_role(auth.uid(),'boss'::public.app_role)
  );
drop policy if exists i18n_glossary_read on public.i18n_glossary_terms;
drop policy if exists i18n_legacy_operator_read on public.i18n_glossary_terms;
create policy i18n_legacy_operator_read on public.i18n_glossary_terms for select
  to authenticated using (
    public.has_role(auth.uid(),'admin'::public.app_role)
    or public.has_role(auth.uid(),'boss'::public.app_role)
  );

-- Limit the existing server-only application role to language infrastructure.
grant select,insert,update,delete on public.i18n_languages,public.marketplace_translations,
  public.i18n_glossary_terms,public.i18n_translation_jobs,public.i18n_request_quota to sv_app;
grant select on public.i18n_translation_revisions to sv_app;

do $$
declare name text;
begin
  foreach name in array array['i18n_languages','marketplace_translations','i18n_glossary_terms',
    'i18n_translation_jobs','i18n_request_quota'] loop
    execute format('drop policy if exists i18n_native_backend on public.%I',name);
    execute format('create policy i18n_native_backend on public.%I for all to sv_app using (true) with check (true)',name);
  end loop;
end $$;
drop policy if exists i18n_native_backend on public.i18n_translation_revisions;
create policy i18n_native_backend on public.i18n_translation_revisions for select to sv_app using (true);

grant execute on function public.i18n_enqueue_translation_jobs(jsonb),
  public.i18n_claim_translation_jobs(text,integer,integer),
  public.i18n_finish_translation_job(uuid,text,boolean,text,numeric,text),
  public.i18n_job_summary(),public.i18n_translation_coverage(),
  public.i18n_mark_stale(text,text,text[]),public.i18n_prune(integer,integer),
  public.i18n_requeue_engine_failures(),public.i18n_consume_quota(text,integer,bigint,integer)
  to sv_app;
commit;
