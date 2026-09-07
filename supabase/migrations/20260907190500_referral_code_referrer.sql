-- A referral code had to belong to an affiliate or an influencer. A reseller is
-- now a third legitimate referrer, so the constraint admits one — still
-- requiring that a code belong to somebody rather than to nobody.
alter table public.marketplace_referral_codes
  drop constraint if exists marketplace_referral_codes_referrer_check;
alter table public.marketplace_referral_codes
  add constraint marketplace_referral_codes_referrer_check
  check (affiliate_partner_id is not null
      or influencer_profile_id is not null
      or reseller_id is not null);
