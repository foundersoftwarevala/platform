-- An influencer application keeps what was submitted, and accepts what the form allows.
--
-- Two faults, both live before this:
--
-- 1. "Average Engagement Rate" is optional on the form, but engagement_rate
--    was NOT NULL. Leaving it empty - or writing "4-5%", which is not one
--    number - failed the whole application with a database error. An unknown
--    rate is now stored as unknown (null), not as a made-up 0.
--
-- 2. Every other role keeps its full application as submitted; influencer
--    applications were spread over columns, so the city and state were merged
--    into one "region" and a rate written in words was lost. The application is
--    now kept verbatim beside the columns, which stay as they were.
--
-- The function gains one trailing parameter with a default, so the running
-- site's call - fifteen named arguments - reaches it unchanged. The old
-- fifteen-argument version is dropped in the same transaction: two versions
-- side by side would leave PostgREST unable to choose between them.

begin;

alter table public.influencer_applications
  alter column engagement_rate drop not null,
  add column if not exists application jsonb;

drop function if exists public.submit_influencer_application(
  text, text, text, text, text, jsonb, bigint, text, text[], numeric, jsonb, jsonb, boolean, boolean, boolean);

create function public.submit_influencer_application(
  p_full_name text, p_email text, p_phone text, p_country text, p_region text, p_social_profiles jsonb,
  p_followers bigint, p_niche text, p_content_types text[], p_engagement_rate numeric, p_payment_details jsonb,
  p_tax_details jsonb, p_agreement_accepted boolean, p_consent_accepted boolean, p_terms_accepted boolean,
  p_application jsonb default null)
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

revoke all on function public.submit_influencer_application(
  text, text, text, text, text, jsonb, bigint, text, text[], numeric, jsonb, jsonb, boolean, boolean, boolean, jsonb) from public;
grant execute on function public.submit_influencer_application(
  text, text, text, text, text, jsonb, bigint, text, text[], numeric, jsonb, jsonb, boolean, boolean, boolean, jsonb)
  to authenticated, service_role;

commit;
