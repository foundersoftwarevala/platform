-- Applications do not keep bank details or identity-document numbers.
--
-- The owner decided these are not collected at application time: no account
-- holder, account number, IFSC/SWIFT, bank name or UPI/PayPal handle, and no ID
-- number (the ID type and the uploaded document remain). The forms no longer
-- ask for them. This makes the database refuse to keep them too, whatever
-- sends them - an older copy of the form still open in someone's browser, the
-- running site until the new forms are deployed, an API call, a service key.
--
-- A BEFORE trigger strips the keys; the row is otherwise saved exactly as sent.
-- Existing values were removed separately. Terminated resellers are left as
-- they are: reseller_terminated_is_final keeps them unchangeable as history.

create or replace function public.strip_application_bank_and_id()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_keys text[] := array['accountHolder', 'accountNumber', 'ifsc', 'bankName', 'upi', 'idNumber'];
begin
  if new.application is not null and new.application ?| v_keys then
    new.application := new.application - v_keys;
  end if;
  return new;
end;
$function$;

create or replace function public.strip_influencer_bank_and_id()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.application is not null then
    new.application := new.application - array['accountHolder', 'accountNumber', 'ifsc', 'bankName', 'upi', 'idNumber'];
  end if;
  if new.payment_details is not null then
    new.payment_details := new.payment_details - array['accountHolder', 'accountNumber', 'ifsc', 'bankName', 'upi'];
  end if;
  if new.tax_details is not null then
    new.tax_details := new.tax_details - array['id_number', 'taxId'];
  end if;
  return new;
end;
$function$;

drop trigger if exists resellers_strip_bank_and_id on public.resellers;
create trigger resellers_strip_bank_and_id
  before insert or update of application on public.resellers
  for each row execute function public.strip_application_bank_and_id();

drop trigger if exists marketplace_sellers_strip_bank_and_id on public.marketplace_sellers;
create trigger marketplace_sellers_strip_bank_and_id
  before insert or update of application on public.marketplace_sellers
  for each row execute function public.strip_application_bank_and_id();

drop trigger if exists franchise_applications_strip_bank_and_id on public.franchise_applications;
create trigger franchise_applications_strip_bank_and_id
  before insert or update of application on public.franchise_applications
  for each row execute function public.strip_application_bank_and_id();

drop trigger if exists marketplace_affiliate_partners_strip_bank_and_id on public.marketplace_affiliate_partners;
create trigger marketplace_affiliate_partners_strip_bank_and_id
  before insert or update of application on public.marketplace_affiliate_partners
  for each row execute function public.strip_application_bank_and_id();

drop trigger if exists influencer_applications_strip_bank_and_id on public.influencer_applications;
create trigger influencer_applications_strip_bank_and_id
  before insert or update of application, payment_details, tax_details on public.influencer_applications
  for each row execute function public.strip_influencer_bank_and_id();
