-- The Affiliate Manager's Applications page, backed by the applications that exist.
--
-- The page read a table called affiliate_applications, which has never
-- existed: every request came back 404 and the page was empty whatever had been
-- submitted. Affiliate applications live in marketplace_affiliate_partners (with
-- the submitted form in `application`). This view gives the page those rows
-- under the names it reads.
--
-- Nothing is invented. There is no applicant category, risk score or KYC status
-- anywhere in the affiliate programme, so those columns are null and the page
-- shows them as empty - and its "KYC Verified" count is an honest zero.
--
-- security_invoker: the view reads as the person asking, so the table's own
-- policy (marketplace_is_admin) decides what anyone sees, exactly as before.

create or replace view public.affiliate_applications
with (security_invoker = true) as
select p.id,
       coalesce(nullif(p.application ->> 'fullName', ''), p.display_name) as applicant_name,
       p.application ->> 'email' as email,
       p.application ->> 'country' as country,
       null::text as category,
       p.status,
       null::integer as risk_score,
       null::text as kyc_status,
       coalesce(p.applied_at, p.created_at) as submitted_at
  from public.marketplace_affiliate_partners p
 -- Affiliates enrolled before the form existed are members, not applicants.
 where p.application is not null or p.status = 'pending';

revoke all on public.affiliate_applications from anon;
grant select on public.affiliate_applications to authenticated, service_role;

comment on view public.affiliate_applications is
  'Affiliate applications for the Affiliate Manager, read from marketplace_affiliate_partners. Category, risk score and KYC status do not exist in the programme and are null.';
