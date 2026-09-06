-- Who may see and change legal records.
--
-- The source's policies say what they are out loud: "Legal records are open
-- while auth is disabled", FOR ALL TO anon, authenticated USING (true). The
-- author knew and never closed them. Applied as shipped it means an anonymous
-- caller can read every contract, rewrite a published policy, delete a
-- violation record - and, through the storage policies, read, overwrite and
-- delete the contents of the document vault.
--
-- Three audiences here. Legal staff and operators run the module. Anybody
-- signed in can read the agreements that apply to them and record their own
-- acceptance, because that is what a login gate needs. Anonymous gets nothing.
--
-- Two things are immutable regardless of who is asking: the log, and an
-- acceptance. An acceptance that can be edited is not evidence of anything.

create or replace function public.legal_is_operator()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin','boss','founder','super_admin','boss_owner','legal')
  );
$$;

create or replace function public.legal_is_reviewer()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  -- Staff who may review and comment, as distinct from those who may publish.
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin','boss','founder','super_admin','boss_owner',
                      'legal','finance','employee','sales_support_manager')
  );
$$;

revoke all on function public.legal_is_operator() from public, anon;
revoke all on function public.legal_is_reviewer() from public, anon;
grant execute on function public.legal_is_operator() to authenticated;
grant execute on function public.legal_is_reviewer() to authenticated;

do $$
declare
  t text;
  tables text[] := array[
    'legal_records','legal_policies','legal_documents','legal_alerts',
    'legal_violations','legal_trademark_assets','legal_misuse_alerts','legal_logs',
    'legal_agreements','legal_agreement_versions','legal_acceptances',
    'legal_jurisdictions','legal_regulations','legal_product_bindings',
    'legal_ai_requests'
  ];
begin
  foreach t in array tables
  loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);

    -- Drop the source's open policies by name where they exist.
    execute format('drop policy if exists "Legal records are open while auth is disabled" on public.%I', t);
    execute format('drop policy if exists "Legal policies are open while auth is disabled" on public.%I', t);
    execute format('drop policy if exists "Legal documents are open while auth is disabled" on public.%I', t);
    execute format('drop policy if exists "Legal alerts are open while auth is disabled" on public.%I', t);
    execute format('drop policy if exists "Legal violations are open while auth is disabled" on public.%I', t);
    execute format('drop policy if exists "Trademark assets are open while auth is disabled" on public.%I', t);
    execute format('drop policy if exists "Misuse alerts are open while auth is disabled" on public.%I', t);
    execute format('drop policy if exists "Legal logs are readable while auth is disabled" on public.%I', t);
    execute format('drop policy if exists "Legal logs can be appended while auth is disabled" on public.%I', t);

    execute format('drop policy if exists legal_anon_denied on public.%I', t);
    execute format($p$
      create policy legal_anon_denied on public.%I
      as restrictive for all to anon using (false) with check (false)
    $p$, t);
  end loop;
end $$;

-- ------------------------------------------------------- the working tables --
do $$
declare
  t text;
  operator_tables text[] := array[
    'legal_records','legal_policies','legal_documents','legal_alerts',
    'legal_violations','legal_trademark_assets','legal_misuse_alerts',
    'legal_product_bindings'
  ];
begin
  foreach t in array operator_tables
  loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format($p$
      create policy %I on public.%I for select to authenticated
      using (public.legal_is_reviewer())
    $p$, t || '_read', t);

    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format($p$
      create policy %I on public.%I for all to authenticated
      using (public.legal_is_operator()) with check (public.legal_is_operator())
    $p$, t || '_write', t);
  end loop;
end $$;

-- Jurisdictions and regulations are reference data: anybody signed in may read
-- them, because an agreement screen has to explain which rules applied.
do $$
declare t text;
begin
  foreach t in array array['legal_jurisdictions','legal_regulations']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (true)$p$,
                   t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format($p$create policy %I on public.%I for all to authenticated
                   using (public.legal_is_operator()) with check (public.legal_is_operator())$p$,
                   t || '_write', t);
  end loop;
end $$;

-- ------------------------------------------------------------- agreements ---
-- A person must be able to read the agreement they are being asked to accept,
-- but only once it is published. Drafts are staff-only.
drop policy if exists legal_agreements_read on public.legal_agreements;
create policy legal_agreements_read on public.legal_agreements
for select to authenticated
using (public.legal_is_reviewer() or status = 'published');

drop policy if exists legal_agreements_write on public.legal_agreements;
create policy legal_agreements_write on public.legal_agreements
for all to authenticated
using (public.legal_is_operator()) with check (public.legal_is_operator());

drop policy if exists legal_versions_read on public.legal_agreement_versions;
create policy legal_versions_read on public.legal_agreement_versions
for select to authenticated
using (public.legal_is_reviewer() or status = 'published');

drop policy if exists legal_versions_insert on public.legal_agreement_versions;
create policy legal_versions_insert on public.legal_agreement_versions
for insert to authenticated with check (public.legal_is_operator());

-- Section 12: a published version is history. It may be superseded or archived,
-- and its text may never be edited again - that is enforced by trigger below.
drop policy if exists legal_versions_update on public.legal_agreement_versions;
create policy legal_versions_update on public.legal_agreement_versions
for update to authenticated
using (public.legal_is_operator())
with check (public.legal_is_operator());

-- ------------------------------------------------------------ acceptances ---
-- A person may see their own acceptances and record their own decision.
-- Nothing may change one afterwards.
drop policy if exists legal_acceptances_read on public.legal_acceptances;
create policy legal_acceptances_read on public.legal_acceptances
for select to authenticated
using (public.legal_is_reviewer() or user_id = auth.uid());

drop policy if exists legal_acceptances_insert on public.legal_acceptances;
create policy legal_acceptances_insert on public.legal_acceptances
for insert to authenticated with check (user_id = auth.uid());

create or replace function public.legal_acceptance_is_immutable()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'a legal acceptance is a record of a moment; % is not permitted', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists legal_acceptances_no_rewrite on public.legal_acceptances;
create trigger legal_acceptances_no_rewrite
before update or delete on public.legal_acceptances
for each row execute function public.legal_acceptance_is_immutable();

-- A published version's text is frozen. Its status may still move on.
create or replace function public.legal_version_body_is_frozen()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.status in ('published','superseded','archived')
     and new.body is distinct from old.body then
    raise exception
      'the text of a published agreement version cannot be changed; publish a new version instead'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists legal_versions_freeze_body on public.legal_agreement_versions;
create trigger legal_versions_freeze_body
before update on public.legal_agreement_versions
for each row execute function public.legal_version_body_is_frozen();

-- ------------------------------------------------------------------- logs ---
drop policy if exists legal_logs_read on public.legal_logs;
create policy legal_logs_read on public.legal_logs
for select to authenticated using (public.legal_is_reviewer());
drop policy if exists legal_logs_insert on public.legal_logs;
create policy legal_logs_insert on public.legal_logs
for insert to authenticated with check (true);

create or replace function public.legal_log_is_append_only()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'the legal log is append-only; % is not permitted', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists legal_logs_no_rewrite on public.legal_logs;
create trigger legal_logs_no_rewrite
before update or delete on public.legal_logs
for each row execute function public.legal_log_is_append_only();

-- ------------------------------------------------------------ AI requests ---
drop policy if exists legal_ai_requests_read on public.legal_ai_requests;
create policy legal_ai_requests_read on public.legal_ai_requests
for select to authenticated
using (public.legal_is_reviewer() or requested_by = auth.uid());
drop policy if exists legal_ai_requests_write on public.legal_ai_requests;
create policy legal_ai_requests_write on public.legal_ai_requests
for all to authenticated
using (public.legal_is_reviewer()) with check (public.legal_is_reviewer());

-- ---------------------------------------------------------- document vault --
-- The source makes the bucket public and lets anonymous callers read, overwrite
-- and delete its contents. A legal document vault is the last place that should
-- be true.
insert into storage.buckets (id, name, public)
values ('legal-documents', 'legal-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Legal vault objects readable while auth is disabled" on storage.objects;
drop policy if exists "Legal vault objects insertable while auth is disabled" on storage.objects;
drop policy if exists "Legal vault objects updatable while auth is disabled" on storage.objects;
drop policy if exists "Legal vault objects deletable while auth is disabled" on storage.objects;

drop policy if exists legal_vault_read on storage.objects;
create policy legal_vault_read on storage.objects
for select to authenticated
using (bucket_id = 'legal-documents' and public.legal_is_reviewer());

drop policy if exists legal_vault_write on storage.objects;
create policy legal_vault_write on storage.objects
for insert to authenticated
with check (bucket_id = 'legal-documents' and public.legal_is_operator());

drop policy if exists legal_vault_update on storage.objects;
create policy legal_vault_update on storage.objects
for update to authenticated
using (bucket_id = 'legal-documents' and public.legal_is_operator())
with check (bucket_id = 'legal-documents' and public.legal_is_operator());

drop policy if exists legal_vault_delete on storage.objects;
create policy legal_vault_delete on storage.objects
for delete to authenticated
using (bucket_id = 'legal-documents' and public.legal_is_operator());

drop trigger if exists legal_acceptances_no_rewrite on public.legal_acceptances;
CREATE TRIGGER legal_acceptances_no_rewrite BEFORE DELETE OR UPDATE ON public.legal_acceptances FOR EACH ROW EXECUTE FUNCTION legal_acceptance_is_immutable();

drop trigger if exists legal_versions_freeze_body on public.legal_agreement_versions;
CREATE TRIGGER legal_versions_freeze_body BEFORE UPDATE ON public.legal_agreement_versions FOR EACH ROW EXECUTE FUNCTION legal_version_body_is_frozen();

drop trigger if exists legal_logs_no_rewrite on public.legal_logs;
CREATE TRIGGER legal_logs_no_rewrite BEFORE DELETE OR UPDATE ON public.legal_logs FOR EACH ROW EXECUTE FUNCTION legal_log_is_append_only();
