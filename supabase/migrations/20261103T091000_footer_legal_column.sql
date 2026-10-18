-- The footer's Legal column.
--
-- storefront_footer_links has carried `link_type` and `legal_policy_type` from
-- the day it was written, and sf_publish already turns a legal link into a real
-- destination through sf_legal_href(). The column was never added because
-- legal_policies was empty and sf_publish drops a legal link whose policy is
-- not published - so the mechanism sat complete and unused. The policies exist
-- now, so this is the row it was waiting for.
--
-- The hrefs are deliberately not written out here. A legal link stores the
-- policy type, and the destination is resolved at publish time from what is
-- actually published, so the footer can never point at a policy that has been
-- withdrawn or renamed in the Legal Manager.

insert into public.storefront_footer_columns (key, heading, position, enabled)
select 'legal', 'Legal',
       coalesce((select max(position) from public.storefront_footer_columns), 0) + 1,
       true
where not exists (select 1 from public.storefront_footer_columns where key = 'legal');

insert into public.storefront_footer_links
  (column_id, label, link_type, legal_policy_type, href, open_in_new, position, enabled, audience)
select c.id, v.label, 'legal', v.policy_type, null, false, v.position, true, 'all'
  from public.storefront_footer_columns c
  cross join (values
    ('Privacy policy',   'privacy-policy',   1),
    ('Terms of service', 'terms-of-service', 2),
    ('Refund policy',    'refund-policy',    3)
  ) as v(label, policy_type, position)
 where c.key = 'legal'
   and not exists (
     select 1 from public.storefront_footer_links l
      where l.column_id = c.id and l.legal_policy_type = v.policy_type
   );
