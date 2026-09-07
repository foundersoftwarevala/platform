-- The attribution guard learns about resellers.
--
-- It already refused an attribution whose affiliate or influencer disagreed
-- with the code or the session it claims to come from. The reseller was not
-- checked, so a reseller attribution could name anyone. Same rule, third party.
create or replace function public.marketplace_validate_attribution()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code public.marketplace_referral_codes%rowtype;
  v_session public.marketplace_referral_sessions%rowtype;
begin
  if new.referral_code_id is not null then
    select * into v_code from public.marketplace_referral_codes where id = new.referral_code_id;
    if v_code.id is null or not v_code.active then
      raise exception 'referral code is not active';
    end if;
    if v_code.affiliate_partner_id is not null
       and new.affiliate_partner_id is distinct from v_code.affiliate_partner_id then
      raise exception 'affiliate does not match referral code';
    end if;
    if v_code.influencer_profile_id is not null
       and new.influencer_profile_id is distinct from v_code.influencer_profile_id then
      raise exception 'influencer does not match referral code';
    end if;
    if v_code.reseller_id is not null
       and new.reseller_id is distinct from v_code.reseller_id then
      raise exception 'reseller does not match referral code';
    end if;
  end if;

  if new.session_id is not null then
    select * into v_session from public.marketplace_referral_sessions where id = new.session_id;
    if v_session.id is null then
      raise exception 'referral session does not exist';
    end if;
    if v_session.affiliate_partner_id is not null
       and new.affiliate_partner_id is distinct from v_session.affiliate_partner_id then
      raise exception 'affiliate does not match referral session';
    end if;
    if v_session.influencer_profile_id is not null
       and new.influencer_profile_id is distinct from v_session.influencer_profile_id then
      raise exception 'influencer does not match referral session';
    end if;
    if v_session.reseller_id is not null
       and new.reseller_id is distinct from v_session.reseller_id then
      raise exception 'reseller does not match referral session';
    end if;
  end if;

  return new;
end;
$function$;
