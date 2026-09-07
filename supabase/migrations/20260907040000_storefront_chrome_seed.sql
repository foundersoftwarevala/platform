-- Seed the footer from the footer that is actually on the site.
--
-- Section 16 lists columns to preserve - COMPANY, MARKETPLACE, PARTNER,
-- SUPPORT, LEGAL, with links like About, Careers, Blog, Press, Status,
-- Documentation, GDPR. Those are the manager mock's links, and twenty of the
-- twenty-five have no route in this project at all. Seeding them would put
-- twenty dead links on every public page, which sections 17 and 53 explicitly
-- forbid.
--
-- The links that exist are the ones the live SiteFooter ships, and every one of
-- them was checked against production and returns 200. Those are what is
-- preserved here, exactly as they are today, so making the footer
-- database-driven changes the page by nothing at all.
--
-- Legal is deliberately not seeded. legal_policies holds zero rows, so there is
-- no published Terms, Privacy or Refund Policy to point at. The footer will
-- carry legal links the moment the Legal Manager publishes one; inventing the
-- URLs now would be the one thing worse than not having them.

insert into public.storefront_footer_columns (key, heading, position) values
  ('marketplace', 'Marketplace', 1),
  ('learn',       'Learn',       2),
  ('partners',    'Partners',    3),
  ('support',     'Support',     4)
on conflict (key) do nothing;

insert into public.storefront_footer_links (column_id, label, link_type, href, position, open_in_new)
select c.id, v.label, v.link_type, v.href, v.position, v.open_in_new
  from (values
    -- Marketplace
    ('marketplace', 'Browse all software',   'internal', '/marketplace',    1, false),
    ('marketplace', 'AI Product Finder',     'internal', '/ai/finder',      2, false),
    ('marketplace', 'Recommendations',       'internal', '/ai/recommend',   3, false),
    ('marketplace', 'Compare products',      'internal', '/ai/compare',     4, false),
    -- Learn
    ('learn',       'Vala TV',               'internal', '/vala-tv',        1, false),
    ('learn',       'Vala Academy',          'internal', '/academy',        2, false),
    ('learn',       'Frequently asked questions', 'internal', '/#faq-faq-1', 3, false),
    -- Partners
    ('partners',    'Become a reseller',     'internal', '/apply/reseller', 1, false),
    ('partners',    'Become a vendor',       'internal', '/apply/vendor',   2, false),
    ('partners',    'Franchise partner',     'internal', '/apply/franchise',3, false),
    ('partners',    'Publish as an author',  'internal', '/apply/author',   4, false),
    ('partners',    'Affiliate programme',   'internal', '/apply/affiliate',5, false),
    ('partners',    'All partner programmes','internal', '/apply',          6, false),
    -- Support
    ('support',     'Contact support',       'internal', '/support',        1, false),
    ('support',     'Sales assistant',       'internal', '/ai/assistant',   2, false),
    ('support',     'Sign in',               'internal', '/login',          3, false),
    ('support',     'Your purchases',        'internal', '/account/purchases', 4, false),
    ('support',     'WhatsApp +91 83488 38383', 'external', 'https://wa.me/918348838383', 5, true),
    ('support',     'hellosoftwarevala@gmail.com', 'mailto', 'mailto:hellosoftwarevala@gmail.com', 6, false),
    ('support',     'Offline software — ErpVala', 'external', 'https://erpvala.com', 7, true)
  ) as v(col, label, link_type, href, position, open_in_new)
  join public.storefront_footer_columns c on c.key = v.col
on conflict do nothing;

-- Section 24. Only accounts the business actually runs, taken from the live
-- footer rather than assumed from the platform list in the manager mock.
-- Twitter and LinkedIn are absent because Software Vala has no configured
-- profile on either, and section 24 says not to invent one.
insert into public.storefront_social_links (platform, url, handle, position) values
  ('Facebook',  'https://facebook.com/share/1HpGSvExis',      null,                  1),
  ('Instagram', 'https://instagram.com/new_software_vala',    '@new_software_vala',  2),
  ('WhatsApp',  'https://wa.me/918348838383',                 '+91 83488 38383',     3),
  ('YouTube',   'https://youtube.com/@softwarevala',          '@softwarevala',       4)
on conflict (platform) do nothing;

-- Section 27. The payment routes Software Vala actually uses. Seeded disabled:
-- the live footer shows no trust strip today, and turning one on is a business
-- decision for the manager, not a side effect of making the footer editable.
insert into public.storefront_trust_items (kind, name, alt_text, position, enabled) values
  ('payment', 'Wise',             'Pay by Wise transfer',            1, false),
  ('payment', 'Bank remittance',  'Pay by bank remittance',          2, false),
  ('payment', 'UPI',              'Pay by UPI',                      3, false),
  ('payment', 'PayU',             'Pay by card through PayU',        4, false),
  ('payment', 'Binance',          'Pay by Binance',                  5, false),
  ('security','SSL secured',      'Connection secured with SSL',     6, false)
on conflict do nothing;

/* --------------------------------------------------- floating elements */

-- Every target below is a real destination that was checked:
--
--   /ai/assistant  public route, returns 200. This is the customer-facing
--                  assistant. ValaAiAgent is NOT used - it is the internal
--                  operator console assistant mounted only in control-panel,
--                  and its commands are Finance, CRM and HR.
--   WhatsApp       the number already published in the footer, and the channel
--                  the support team actually works on.
--   lead_form      posts to /api/marketplace/lead with action request_demo -
--                  the existing rate-limited, validated public lead endpoint.
--                  No second lead system is created.
--
-- All four are seeded disabled. The public storefront carries no floating
-- widget today, and adding one is a decision a manager makes and publishes,
-- which is exactly the flow section 12 describes.
insert into public.storefront_floating_elements
  (key, element_type, name, label, enabled, position, priority, theme, icon,
   action_type, action_target, trigger_type, trigger_value, mobile_enabled)
values
  ('ai-chat', 'ai_chat', 'AI Chat', 'Ask Vala AI', false,
   'bottom-right', 1, 'accent', 'Bot', 'route', '/ai/assistant', 'delay', 3000, true),

  ('support', 'support', 'Support Button', 'Chat on WhatsApp', false,
   'bottom-right', 2, 'success', 'MessageCircle', 'whatsapp', 'https://wa.me/918348838383',
   'immediate', 0, true),

  ('request-demo', 'request_demo', 'Request Demo', 'Request a demo', false,
   'bottom-left', 1, 'premium', 'Sparkles', 'lead_form', null, 'scroll', 35, true),

  ('floating-actions', 'actions', 'Floating Actions', 'Get in touch', false,
   'bottom-left', 2, 'primary', 'Plus', 'none', null, 'immediate', 0, false)
on conflict (key) do nothing;

select 'columns' as t, count(*)::text as n from public.storefront_footer_columns
union all select 'links',   count(*)::text from public.storefront_footer_links
union all select 'socials', count(*)::text from public.storefront_social_links
union all select 'trust',   count(*)::text from public.storefront_trust_items
union all select 'floating',count(*)::text from public.storefront_floating_elements;
-- Let Layout Order see the floating elements too.
--
-- HomeIndex renders them as a registry section, so without a row here they
-- would be a section the registry has never heard of - which renders, by the
-- fail-toward-rendering rule, but could not be switched off from the manager.
-- Registering it makes that switch real.
--
-- Published and enabled, because the section renders nothing until an element
-- inside it is enabled and published. Its real gate is the Floating Elements
-- manager; this row only decides whether the storefront asks at all.
insert into public.marketplace_homepage_sections
  (key, title, description, row_type, source, status, enabled,
   sort_order, visible_mobile, visible_desktop, published_at, config)
values
  ('floating-elements', 'Floating Elements',
   'Chat, support and demo widgets that float above the page.',
   'content', 'manual', 'published', true,
   19, true, true, now(),
   jsonb_build_object('component', 'FloatingElements',
                      'file', 'src/components/marketplace-home/FloatingElements.tsx',
                      'owner', 'marketplace-manager'))
on conflict (key) do nothing;

select key, sort_order, enabled, status
  from public.marketplace_homepage_sections
 where key in ('footer','floating-elements')
 order by sort_order;
