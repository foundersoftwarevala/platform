-- Point "Contact support" at the customer's page, and carry the second
-- WhatsApp number the business actually uses.
--
-- The footer's "Contact support" pointed at /support, which is the Support
-- Operations Center - an operator console behind a role gate - so a customer
-- following the one link they were most likely to need was shown "Access
-- restricted". /contact is the customer's way in and writes to the same
-- support_tickets table that console reads. /support itself is untouched.
--
-- The second WhatsApp number is the owner's, given alongside the first:
--
--     +91-8768878787 | +91-8348838383
--
-- Only one of them has ever been on the site. Both are added here rather than
-- one replacing the other, so a customer can reach whichever is answering.

update public.storefront_footer_links
   set href = '/contact',
       label = 'Contact support',
       updated_at = now()
 where href = '/support'
   and link_type <> 'legal';

insert into public.storefront_footer_links
  (column_id, label, link_type, legal_policy_type, href, open_in_new, position, enabled, audience)
select c.id,
       'WhatsApp +91 87688 78787',
       'external', null, 'https://wa.me/918768878787',
       true,
       coalesce((select max(l.position) from public.storefront_footer_links l where l.column_id = c.id), 0) + 1,
       true, 'all'
  from public.storefront_footer_columns c
 where c.key = 'support'
   and not exists (
     select 1 from public.storefront_footer_links l
      where l.column_id = c.id and l.href = 'https://wa.me/918768878787'
   );
