-- Approving a second application for someone who is already an influencer
-- crashed instead of approving.
--
-- Found by approving a real application in Influencer Manager:
--
--   duplicate key value violates unique constraint "influencer_profiles_user_id_key"
--
-- review_influencer_application() creates the profile on approval with
-- `on conflict (application_id) do update`, which covers the same application
-- being approved twice. It does not cover the same *person* applying twice -
-- a different application_id, so the conflict clause never fires, and the
-- UNIQUE on user_id refuses the insert. The operator saw a raw database error
-- and the application stayed pending.
--
-- This happens in ordinary use: an influencer who has been through the
-- programme applies again, or an account that already holds a profile is
-- approved on a fresh application.
--
-- The rule this encodes is the one the schema already states with its two
-- unique constraints: one profile per person. So where the person already has a
-- profile, the approval attaches to it and reactivates it rather than trying to
-- create a second. Their original application_id is left alone, because it
-- records which application first admitted them and rewriting it would lose
-- that; the new application is recorded in the audit entry instead.
--
-- Nothing else about the function changes: staff only, no reviewing your own
-- application, a reason required to reject, no deciding an application twice,
-- the role granted, the notice sent.

create or replace function public.review_influencer_application(
  p_application_id uuid,
  p_status text,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_before public.influencer_applications%rowtype;
  v public.influencer_applications%rowtype;
  p public.influencer_profiles%rowtype;
  v_existing public.influencer_profiles%rowtype;
  v_reused boolean := false;
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
    -- One profile per person. If this account already has one, the approval
    -- attaches to it rather than trying to create a second.
    if v.applicant_user_id is not null then
      select * into v_existing from public.influencer_profiles
       where user_id = v.applicant_user_id limit 1;
    end if;

    if found and v_existing.id is not null then
      update public.influencer_profiles
         set status = 'active',
             full_name = coalesce(nullif(btrim(v.full_name), ''), influencer_profiles.full_name),
             email = coalesce(nullif(btrim(v.email), ''), influencer_profiles.email),
             country = coalesce(v.country, influencer_profiles.country),
             region = coalesce(v.region, influencer_profiles.region),
             niche = coalesce(nullif(btrim(v.niche), ''), influencer_profiles.niche),
             -- Their first application stays recorded; this one is in the audit.
             application_id = coalesce(influencer_profiles.application_id, v.id),
             updated_at = now()
       where id = v_existing.id
       returning * into p;
      v_reused := true;
    else
      insert into public.influencer_profiles(application_id, user_id, full_name, email, country, region, niche, status)
      values (v.id, v.applicant_user_id, v.full_name, v.email, v.country, v.region, v.niche, 'active')
      on conflict (application_id) do update
        set status = 'active',
            user_id = coalesce(influencer_profiles.user_id, excluded.user_id),
            updated_at = now()
      returning * into p;
    end if;

    if v.applicant_user_id is not null then
      insert into public.user_roles (user_id, role) values (v.applicant_user_id, 'influencer') on conflict do nothing;
    end if;
  end if;

  insert into public.influencer_audit_logs(actor_user_id, entity_type, entity_id, action, after_data, metadata)
  values (auth.uid(), 'application', v.id, p_status, to_jsonb(v),
          jsonb_build_object('profile_id', p.id, 'reused_existing_profile', v_reused));

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

  return jsonb_build_object(
    'application', to_jsonb(v),
    'profile', case when p.id is null then null else to_jsonb(p) end,
    'reused_existing_profile', v_reused);
end;
$function$;
