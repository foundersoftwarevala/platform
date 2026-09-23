-- Role applications on the server, the way reseller applications already are.
--
-- /apply/<role> stored every non-reseller application in the applicant's own
-- browser (localStorage) where no manager could ever see it, and offered a
-- "Pay Now" button that recorded a payment without taking one. Each role now
-- goes to the table and manager workflow that already exists for it:
--
--   reseller    resellers                 submit_reseller_application (unchanged)
--   vendor      marketplace_sellers       submit_seller_application   (new; seller_kind vendor)
--   author      marketplace_sellers       submit_seller_application   (new; seller_kind author)
--                -> reviewed with mm_seller_status in the Vendor Manager (unchanged)
--   franchise   franchise_applications    submit_franchise_application (new)
--                -> reviewed with review_franchise_application (new)
--   influencer  influencer_applications   submit_influencer_application (hardened)
--                -> reviewed with review_influencer_application (hardened)
--   affiliate   marketplace_affiliate_partners via POST /api/affiliate/account (unchanged)
--   employee    no hiring system exists; the form says so and submits nothing.
--
-- Every submit: signed-in applicant, agreement required, one open application
-- per account (a repeat returns the existing one), an application number, an
-- audit entry and an in-app notification. Status, approval and roles are only
-- ever set by staff, never by the applicant.
--
-- Security fixes found on the way:
--   * review_influencer_application accepted anyone holding the 'influencer'
--     or 'developer' role (influencer_manager_access), so an influencer could
--     approve applications, their own included. Review is now admin, boss,
--     super_admin or marketing, and never your own application.
--   * The influencer_applications policy used the same check, exposing every
--     applicant's payment and tax details to any influencer. Staff read and
--     write; an applicant reads only their own.
--   * submit_influencer_application was executable by anon and recorded no
--     applicant, so applications could be neither traced nor de-duplicated.
--   * An approved influencer's profile was not linked to their account.

/* ---------------------------------------------------------------- columns */

alter table public.marketplace_sellers
  add column if not exists application jsonb,
  add column if not exists applied_at timestamptz;

alter table public.franchise_applications
  add column if not exists applicant_user_id uuid references auth.users(id) on delete set null,
  add column if not exists application jsonb;

create unique index if not exists franchise_applications_one_per_applicant
  on public.franchise_applications (applicant_user_id)
  where applicant_user_id is not null and status in ('pending', 'in_review');

/* ------------------------------------------------------------ shared bits */

create or replace function public.role_application_missing(p_application jsonb, p_required text[])
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(k), '{}') from unnest(p_required) k
   where nullif(btrim(coalesce(p_application ->> k, '')), '') is null
$$;

create or replace function public.application_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select auth.uid() is not null and exists (
    select 1 from public.user_roles
     where user_id = auth.uid()
       and lower(role::text) in ('admin', 'boss', 'super_admin', 'boss_owner', 'founder', 'marketing'));
$$;

/* ------------------------------------------------------- vendor / author */

create or replace function public.submit_seller_application(p_kind text, p_application jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_kind text := lower(btrim(coalesce(p_kind, '')));
  v_row public.marketplace_sellers%rowtype;
  v_missing text[];
  v_name text;
  v_number text;
  v_application jsonb;
begin
  if v_user is null then raise exception 'Sign in to apply'; end if;
  if v_kind not in ('vendor', 'author') then raise exception 'Unknown seller application type'; end if;
  if coalesce((p_application ->> 'agreementAccepted')::boolean, false) is not true then
    raise exception 'The agreement must be accepted';
  end if;

  select * into v_row from public.marketplace_sellers where owner_user_id = v_user;
  if found then
    return jsonb_build_object('application_number', coalesce(v_row.application ->> 'application_number', v_row.slug),
                              'status', v_row.status, 'duplicate', true);
  end if;

  v_missing := public.role_application_missing(p_application,
    case v_kind
      when 'vendor' then array['fullName','email','phone','country','companyName','registrationNumber',
                               'gstNumber','businessAddress','contactPerson','categoriesInterested']
      else array['fullName','email','phone','country','experienceYears','experienceSummary','techStack',
                 'languages','github','softwareCategories','productsCount'] end);
  if array_length(v_missing, 1) > 0 then
    raise exception 'Missing required fields: %', array_to_string(v_missing, ', ');
  end if;

  v_name := left(coalesce(nullif(btrim(p_application ->> 'companyName'), ''), btrim(p_application ->> 'fullName')), 120);
  v_number := case v_kind when 'vendor' then 'SVV-' else 'SVA-' end
              || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_application := (p_application - 'agreementAccepted')
                   || jsonb_build_object('application_number', v_number, 'agreement_accepted_at', now());

  insert into public.marketplace_sellers (owner_user_id, display_name, slug, status, seller_kind, application, applied_at)
  values (v_user, v_name,
          left(trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')), 60)
            || '-' || lower(substr(v_number, 5, 6)),
          'pending', v_kind, v_application, now())
  returning * into v_row;

  perform public.mm_audit('seller.application_submitted', 'marketplace_seller', v_row.id::text, null,
                          jsonb_build_object('kind', v_kind, 'application_number', v_number), null);
  perform public.mm_notify('seller.application_submitted', 'Application received',
    format('Your %s application %s is pending review.', v_kind, v_number),
    v_user, null, null, null, 0, 'info');

  return jsonb_build_object('application_number', v_number, 'status', v_row.status, 'duplicate', false);
end;
$function$;

revoke all on function public.submit_seller_application(text, jsonb) from public, anon;
grant execute on function public.submit_seller_application(text, jsonb) to authenticated;

/* -------------------------------------------------------------- franchise */

create or replace function public.submit_franchise_application(p_application jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_row public.franchise_applications%rowtype;
  v_missing text[];
  v_code text;
begin
  if v_user is null then raise exception 'Sign in to apply'; end if;
  if coalesce((p_application ->> 'agreementAccepted')::boolean, false) is not true then
    raise exception 'The agreement must be accepted';
  end if;

  select * into v_row from public.franchise_applications
   where applicant_user_id = v_user and status in ('pending', 'in_review')
   order by created_at desc limit 1;
  if found then
    return jsonb_build_object('application_number', v_row.code, 'status', v_row.status, 'duplicate', true);
  end if;

  v_missing := public.role_application_missing(p_application,
    array['fullName','email','phone','country','companyName','territory','investmentCapacity','businessBackground']);
  if array_length(v_missing, 1) > 0 then
    raise exception 'Missing required fields: %', array_to_string(v_missing, ', ');
  end if;

  v_code := 'FRA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.franchise_applications
    (code, business_name, owner_name, email, phone, requested_territory, city, state, country,
     experience, business_type, investment_capacity, status, applicant_user_id, application)
  values (v_code,
          btrim(p_application ->> 'companyName'), btrim(p_application ->> 'fullName'),
          btrim(p_application ->> 'email'), btrim(p_application ->> 'phone'),
          btrim(p_application ->> 'territory'),
          coalesce(nullif(btrim(p_application ->> 'city'), ''), btrim(p_application ->> 'territory')),
          coalesce(btrim(p_application ->> 'state'), ''),
          btrim(p_application ->> 'country'),
          coalesce(btrim(p_application ->> 'businessBackground'), ''),
          coalesce(btrim(p_application ->> 'companyType'), ''),
          btrim(p_application ->> 'investmentCapacity'),
          'pending', v_user,
          (p_application - 'agreementAccepted') || jsonb_build_object('agreement_accepted_at', now()))
  returning * into v_row;

  perform public.mm_audit('franchise.application_submitted', 'franchise_application', v_row.id::text, null,
                          jsonb_build_object('code', v_code), null);
  perform public.mm_notify('franchise.application_submitted', 'Application received',
    format('Your franchise application %s is pending review.', v_code),
    v_user, null, null, null, 0, 'info');

  return jsonb_build_object('application_number', v_code, 'status', v_row.status, 'duplicate', false);
end;
$function$;

revoke all on function public.submit_franchise_application(jsonb) from public, anon;
grant execute on function public.submit_franchise_application(jsonb) to authenticated;

create or replace function public.review_franchise_application(p_id uuid, p_status text, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_before public.franchise_applications%rowtype;
  v_after public.franchise_applications%rowtype;
begin
  if not public.is_franchise_staff() then raise exception 'Franchise staff access required'; end if;
  if p_status not in ('in_review', 'approved', 'rejected') then raise exception 'Invalid application status'; end if;
  if p_status = 'rejected' and nullif(btrim(coalesce(p_notes, '')), '') is null then
    raise exception 'Record why the application is rejected';
  end if;
  select * into v_before from public.franchise_applications where id = p_id for update;
  if not found then raise exception 'Application not found'; end if;
  if v_before.applicant_user_id = auth.uid() then raise exception 'You cannot review your own application'; end if;
  if v_before.status in ('approved', 'rejected') then
    raise exception 'This application is already %', v_before.status;
  end if;

  update public.franchise_applications
     set status = p_status, review_notes = coalesce(nullif(btrim(p_notes), ''), review_notes), updated_at = now()
   where id = p_id returning * into v_after;

  perform public.mm_audit('franchise.application_' || p_status, 'franchise_application', p_id::text,
                          to_jsonb(v_before), to_jsonb(v_after), p_notes);
  if v_after.applicant_user_id is not null then
    perform public.mm_notify('franchise.application_' || p_status,
      case p_status when 'approved' then 'Franchise application approved'
                    when 'rejected' then 'Franchise application not approved'
                    else 'Franchise application in review' end,
      format('Application %s is now %s.%s', v_after.code, replace(p_status, '_', ' '),
             case when p_status = 'rejected' then ' Reason: ' || p_notes else '' end),
      v_after.applicant_user_id, null, null, null, 0,
      case p_status when 'approved' then 'success' when 'rejected' then 'warning' else 'info' end);
  end if;
  return jsonb_build_object('ok', true, 'application', to_jsonb(v_after));
end;
$function$;

revoke all on function public.review_franchise_application(uuid, text, text) from public, anon;
grant execute on function public.review_franchise_application(uuid, text, text) to authenticated;

/* ------------------------------------------------------------- influencer */

create or replace function public.submit_influencer_application(
  p_full_name text, p_email text, p_phone text, p_country text, p_region text, p_social_profiles jsonb,
  p_followers bigint, p_niche text, p_content_types text[], p_engagement_rate numeric,
  p_payment_details jsonb, p_tax_details jsonb,
  p_agreement_accepted boolean, p_consent_accepted boolean, p_terms_accepted boolean)
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
    agreement_accepted, consent_accepted, terms_accepted)
  values (v_user, p_full_name, p_email, p_phone, p_country, p_region, coalesce(p_social_profiles, '{}'),
    p_followers, p_niche, coalesce(p_content_types, '{}'), p_engagement_rate, coalesce(p_payment_details, '{}'),
    coalesce(p_tax_details, '{}'), p_agreement_accepted, p_consent_accepted, p_terms_accepted)
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

revoke all on function public.submit_influencer_application(text, text, text, text, text, jsonb, bigint, text, text[], numeric, jsonb, jsonb, boolean, boolean, boolean) from public, anon;
grant execute on function public.submit_influencer_application(text, text, text, text, text, jsonb, bigint, text, text[], numeric, jsonb, jsonb, boolean, boolean, boolean) to authenticated;

create or replace function public.review_influencer_application(p_application_id uuid, p_status text, p_rejection_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_before public.influencer_applications%rowtype;
  v public.influencer_applications%rowtype;
  p public.influencer_profiles%rowtype;
begin
  if not public.application_staff() then raise exception 'Manager access required'; end if;
  if p_status not in ('in_review', 'approved', 'rejected') then raise exception 'Invalid application status'; end if;
  select * into v_before from public.influencer_applications where id = p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  if v_before.applicant_user_id = auth.uid() then raise exception 'You cannot review your own application'; end if;
  if v_before.status in ('approved', 'rejected') then raise exception 'This application is already %', v_before.status; end if;
  if p_status = 'rejected' and nullif(btrim(coalesce(p_rejection_reason, '')), '') is null then
    raise exception 'Record why the application is rejected';
  end if;
  update public.influencer_applications
     set status = p_status,
         rejection_reason = case when p_status = 'rejected' then p_rejection_reason else null end,
         reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   where id = p_application_id returning * into v;
  if p_status = 'approved' then
    insert into public.influencer_profiles(application_id, user_id, full_name, email, country, region, niche, status)
    values (v.id, v.applicant_user_id, v.full_name, v.email, v.country, v.region, v.niche, 'active')
    on conflict (application_id) do update set status = 'active', user_id = coalesce(influencer_profiles.user_id, excluded.user_id), updated_at = now()
    returning * into p;
    if v.applicant_user_id is not null then
      insert into public.user_roles (user_id, role) values (v.applicant_user_id, 'influencer') on conflict do nothing;
    end if;
  end if;
  insert into public.influencer_audit_logs(actor_user_id, entity_type, entity_id, action, after_data)
  values (auth.uid(), 'application', v.id, p_status, to_jsonb(v));
  if v.applicant_user_id is not null then
    perform public.mm_notify('influencer.application_' || p_status,
      case p_status when 'approved' then 'Influencer application approved'
                    when 'rejected' then 'Influencer application not approved'
                    else 'Influencer application in review' end,
      format('Application %s is now %s.%s', v.application_number, replace(p_status, '_', ' '),
             case when p_status = 'rejected' then ' Reason: ' || p_rejection_reason else '' end),
      v.applicant_user_id, null, null, null, 0,
      case p_status when 'approved' then 'success' when 'rejected' then 'warning' else 'info' end);
  end if;
  return jsonb_build_object('application', to_jsonb(v), 'profile', case when p.id is null then null else to_jsonb(p) end);
end;
$function$;

revoke all on function public.review_influencer_application(uuid, text, text) from public, anon;
grant execute on function public.review_influencer_application(uuid, text, text) to authenticated;

drop policy if exists influencer_manager_all on public.influencer_applications;
drop policy if exists influencer_applications_staff on public.influencer_applications;
drop policy if exists influencer_applications_own_read on public.influencer_applications;
create policy influencer_applications_staff on public.influencer_applications
  for all to authenticated
  using (public.application_staff()) with check (public.application_staff());
create policy influencer_applications_own_read on public.influencer_applications
  for select to authenticated
  using (applicant_user_id = auth.uid());
