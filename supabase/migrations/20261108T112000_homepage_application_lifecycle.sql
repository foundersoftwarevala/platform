-- Additive homepage intake wiring. Employee approval is recruitment shortlisting,
-- never an employment offer or a user_roles grant. No existing rows are rewritten.

create or replace function public.application_staff()
returns boolean language sql stable security definer
set search_path to 'public'
as $$
  select auth.uid() is not null and exists (
    select 1 from public.user_roles where user_id = auth.uid()
      and lower(role::text) in ('admin','boss','super_admin','boss_owner','founder','owner','marketing'));
$$;

create table if not exists public.employee_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid unique references auth.users(id) on delete set null,
  application_number text not null unique,
  full_name text not null,
  email text not null,
  application jsonb not null,
  status text not null default 'pending' check (status in ('pending','in_review','approved','rejected')),
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.employee_applications is
  'Recruitment applications. approved means shortlisted, not hired; no internal access is granted.';
create index if not exists employee_applications_pending_idx
  on public.employee_applications (status, created_at desc, id desc);
alter table public.employee_applications enable row level security;
revoke all on public.employee_applications from anon, authenticated;
grant select on public.employee_applications to authenticated;
grant select, insert, update on public.employee_applications to service_role;
drop policy if exists employee_applications_reader on public.employee_applications;
create policy employee_applications_reader on public.employee_applications for select to authenticated
  using (applicant_user_id = auth.uid() or public.application_staff());
drop trigger if exists employee_applications_strip_bank_and_id on public.employee_applications;
create trigger employee_applications_strip_bank_and_id
  before insert or update of application on public.employee_applications
  for each row execute function public.strip_application_bank_and_id();

alter table public.application_documents drop constraint if exists application_documents_application_kind_check;
alter table public.application_documents add constraint application_documents_application_kind_check
  check (application_kind in ('reseller','vendor','author','franchise','influencer','affiliate','employee'));

create or replace function public.submit_employee_application(p_application jsonb)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_row public.employee_applications%rowtype;
  v_missing text[];
  v_number text := 'SVE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
begin
  if v_user is null then raise exception 'Sign in to apply'; end if;
  if p_application is null or jsonb_typeof(p_application) <> 'object'
     or octet_length(p_application::text) > 65536 then
    raise exception 'An application object of at most 64 KB is required';
  end if;
  if coalesce((p_application ->> 'agreementAccepted')::boolean, false) is not true then
    raise exception 'The agreement must be accepted';
  end if;
  v_missing := public.role_application_missing(p_application,
    array['fullName','email','phone','country','idType','department','position','totalExperience','skills']);
  if array_length(v_missing, 1) > 0 then
    raise exception 'Missing required fields: %', array_to_string(v_missing, ', ');
  end if;
  if btrim(p_application ->> 'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required';
  end if;
  insert into public.employee_applications
    (applicant_user_id, application_number, full_name, email, application)
  values (v_user, v_number, left(btrim(p_application ->> 'fullName'), 200),
    lower(btrim(p_application ->> 'email')),
    (p_application - 'agreementAccepted') || jsonb_build_object('agreement_accepted_at', now()))
  on conflict (applicant_user_id) do nothing returning * into v_row;
  if not found then
    select * into strict v_row from public.employee_applications where applicant_user_id = v_user;
    return jsonb_build_object('id', v_row.id, 'application_number', v_row.application_number,
      'status', v_row.status, 'duplicate', true);
  end if;
  perform public.mm_audit('employee.application_submitted', 'employee_application', v_row.id::text,
    null, jsonb_build_object('application_number', v_number), null);
  perform public.mm_notify('employee.application_submitted', 'Application received',
    format('Your employee application %s is pending review.', v_number),
    v_user, null, null, null, 0, 'info');
  return jsonb_build_object('id', v_row.id, 'application_number', v_number,
    'status', v_row.status, 'duplicate', false);
end;
$$;

create or replace function public.review_employee_application(p_id uuid, p_status text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_row public.employee_applications%rowtype;
  v_before jsonb;
begin
  if not public.application_staff() then raise exception 'Application staff only'; end if;
  select * into v_row from public.employee_applications where id = p_id for update;
  if not found then raise exception 'Application not found'; end if;
  if v_row.applicant_user_id = auth.uid() then raise exception 'You cannot review your own application'; end if;
  if v_row.status not in ('pending','in_review') then raise exception 'This application is already decided'; end if;
  if p_status is null or p_status not in ('in_review','approved','rejected') or p_status = v_row.status then
    raise exception 'Invalid application transition';
  end if;
  if p_status = 'rejected' and coalesce(btrim(p_reason), '') = '' then
    raise exception 'A rejection reason is required';
  end if;
  v_before := jsonb_build_object('status', v_row.status);
  update public.employee_applications set status = p_status, review_notes = nullif(btrim(p_reason), ''),
    reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    where id = p_id returning * into v_row;
  perform public.mm_audit('employee.' || p_status, 'employee_application', p_id::text,
    v_before, jsonb_build_object('status', p_status), p_reason);
  if v_row.applicant_user_id is not null then
    perform public.mm_notify('employee.' || p_status, 'Employee application updated',
      case when p_status = 'approved' then 'You have been shortlisted. This is not a job offer and grants no internal access.'
           else coalesce(p_reason, 'Your employee application is under review.') end,
      v_row.applicant_user_id, null, null, null, 0, 'info');
  end if;
  return jsonb_build_object('ok', true, 'status', v_row.status);
end;
$$;
revoke all on function public.submit_employee_application(jsonb) from public, anon;
revoke all on function public.review_employee_application(uuid,text,text) from public, anon;
grant execute on function public.submit_employee_application(jsonb) to authenticated, service_role;
grant execute on function public.review_employee_application(uuid,text,text) to authenticated, service_role;

-- Deferred until the review RPC has written its audit: reseller reasons live
-- there, not on the reseller row. Outbox and notifications commit with the decision.
create or replace function public.notify_application_lifecycle()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_application jsonb := v_row -> 'application';
  v_kind text;
  v_status text := v_row ->> 'status';
  v_id text := v_row ->> 'id';
  v_owner uuid;
  v_number text;
  v_email text;
  v_reason text;
  v_body text;
  v_title text;
  v_staff text[] := array['admin','boss','super_admin','boss_owner','founder','owner','marketing'];
begin
  v_kind := case tg_table_name
    when 'resellers' then 'reseller'
    when 'marketplace_sellers' then v_row ->> 'seller_kind'
    when 'franchise_applications' then 'franchise'
    when 'influencer_applications' then 'influencer'
    when 'marketplace_affiliate_partners' then 'affiliate'
    when 'employee_applications' then 'employee' end;
  if v_kind is null or v_kind not in ('reseller','vendor','author','franchise','influencer','affiliate','employee') then
    return new;
  end if;
  if tg_table_name in ('resellers','marketplace_sellers','marketplace_affiliate_partners')
     and (v_application is null or v_application = 'null'::jsonb) then return new; end if;
  v_number := coalesce(v_row ->> 'application_number', v_application ->> 'application_number',
    v_row ->> 'code', v_row ->> 'slug', v_id);
  if tg_op = 'INSERT' then
    if v_status not in ('pending','in_review') then return new; end if;
    perform public.mm_notify('application.submitted', 'New application',
      format('%s application %s is pending review.', initcap(v_kind), v_number),
      null, v_staff, '/application-manager', 'Review applications', 0, 'info');
    return new;
  end if;
  if old.status is not distinct from new.status then return new; end if;
  perform public.mm_notify('application.decided', 'Application status changed',
    format('%s application %s is now %s.', initcap(v_kind), v_number, v_status),
    null, v_staff, '/application-manager', 'Review applications', 0, 'info');
  if old.status not in ('pending','in_review') or v_status not in ('approved','active','rejected') then return new; end if;
  v_owner := coalesce(v_row ->> 'applicant_user_id', v_row ->> 'owner_user_id', v_row ->> 'user_id')::uuid;
  select nullif(btrim(email), '') into v_email from auth.users where id = v_owner;
  v_email := coalesce(v_email, nullif(btrim(v_row ->> 'email'), ''), nullif(btrim(v_application ->> 'email'), ''));
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Applicant email is missing or invalid; the decision has not been saved';
  end if;
  v_reason := coalesce(v_row ->> 'rejection_reason', v_row ->> 'review_notes');
  if v_kind = 'reseller' and v_status = 'rejected' then
    select reason into v_reason from public.marketplace_audit_logs
      where entity_type = 'reseller' and entity_id = v_id::uuid and action = 'reseller.rejected'
      order by created_at desc, id desc limit 1;
  end if;
  v_title := format('Your %s application %s', v_kind,
    case when v_kind = 'employee' and v_status = 'approved' then 'was shortlisted'
         when v_status = 'rejected' then 'was not accepted' else 'was approved' end);
  v_body := format('Application %s: %s.', v_number, v_title);
  if v_reason is not null then v_body := v_body || E'\nReason: ' || v_reason; end if;
  if v_kind = 'employee' and v_status = 'approved' then
    v_body := v_body || E'\nShortlisting is not a job offer and does not grant internal access.';
  end if;
  insert into public.email_outbox (to_email, subject, body_text, body_html, context, last_error)
    values (v_email, v_title, v_body,
      '<div><p>' || replace(replace(replace(v_body, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p></div>',
      jsonb_build_object('event', 'application.decided', 'application_kind', v_kind,
        'application_id', v_id, 'application_status', v_status),
      'Queued; delivery has not been confirmed.');
  return new;
end;
$$;
revoke all on function public.notify_application_lifecycle() from public, anon, authenticated;

do $$
declare v_table text;
begin
  foreach v_table in array array['resellers','marketplace_sellers','franchise_applications',
    'influencer_applications','marketplace_affiliate_partners','employee_applications']
  loop
    execute format('drop trigger if exists application_lifecycle_notify on public.%I', v_table);
    execute format('create constraint trigger application_lifecycle_notify after insert or update on public.%I
      deferrable initially deferred for each row execute function public.notify_application_lifecycle()', v_table);
  end loop;
end;
$$;

create or replace function public.notify_rd_request_submitted()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  perform public.mm_notify('rd.request_submitted', 'New software request',
    format('Request %s: %s', new.public_request_id, left(new.title, 160)),
    null, array['admin','boss','super_admin','boss_owner','founder','owner'],
    '/rd-manager/inbox', 'Open R&D inbox', 0, 'info');
  return new;
end;
$$;
revoke all on function public.notify_rd_request_submitted() from public, anon, authenticated;
drop trigger if exists rd_request_submitted_notify on public.rd_opportunities;
create trigger rd_request_submitted_notify after insert on public.rd_opportunities
  for each row execute function public.notify_rd_request_submitted();

notify pgrst, 'reload schema';
