-- The twenty-eight storefront FAQs, moved out of the TypeScript file and
-- into the table the manager writes and the storefront reads.
--
-- Nothing is rewritten: the questions and answers are exactly what
-- softwarevala.net already serves, with the three template values resolved
-- to the figures it already renders. They arrive published, because they are
-- published today and moving them must not take them off the site.
--
-- Keyed on the question, so re-running this changes nothing.

create unique index if not exists faqs_question_language_key
  on public.faqs (question, language);

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'general'),
        'What exactly is Software Vala?',
        'Software Vala is a ready-to-deploy software marketplace with 12,000+ business solutions across 80+ master categories — ERP, CRM, healthcare, education, logistics, POS, HR, SaaS and more. You pick a product, see a live demo, pay once and get it deployed.',
        'what-exactly-is-software-vala', 'published', now(), 1, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'general'),
        'How many products and categories are available?',
        '12,000+ software solutions organised into 80+ master categories, each with related sub-category modules so you can start narrow and expand later.',
        'how-many-products-and-categories-are-available', 'published', now(), 2, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'general'),
        'Is every product production-ready or just a template?',
        'Every listing is a working product with an admin panel, roles, reporting and data model — not a UI template. You get the full frontend and backend.',
        'is-every-product-production-ready-or-just-a-template', 'published', now(), 3, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'general'),
        'Can I get a product customised for my business?',
        'Yes. Every product supports paid customisation — extra modules, branding, workflows and integrations. Raise a request from the product page and our team scopes it within one business day.',
        'can-i-get-a-product-customised-for-my-business', 'published', now(), 4, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'pricing-licensing'),
        'How much does a product cost?',
        'One fixed price across the entire ecosystem: $249 one-time for lifetime access. No tiers, no per-seat pricing, no renewals — that is our USP.',
        'how-much-does-a-product-cost', 'published', now(), 5, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'pricing-licensing'),
        'Why is every product the same price?',
        'Because comparing prices wastes your time. Whether it is a school ERP or a multi-vendor marketplace, the price stays $249 lifetime so you choose on fit, not on budget.',
        'why-is-every-product-the-same-price', 'published', now(), 6, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'pricing-licensing'),
        'Is $249 really a one-time payment?',
        'Yes. There is no advance payment, no hidden charge, no monthly fee and no forced renewal. You pay $249 once and the licence never expires.',
        'is-249-really-a-one-time-payment', 'published', now(), 7, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'pricing-licensing'),
        'What does the lifetime licence include?',
        'Lifetime use of the product, all version updates, source code access, one year of free technical support and no usage caps on your own domain.',
        'what-does-the-lifetime-licence-include', 'published', now(), 8, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'pricing-licensing'),
        'Do I get the source code?',
        'Yes — full frontend and backend source code is delivered with every purchase, so your own team can extend it.',
        'do-i-get-the-source-code', 'published', now(), 9, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'pricing-licensing'),
        'Do you offer refunds?',
        'Because live demos are open before purchase, refunds apply only when a product cannot be delivered or does not match its published feature list. Raise a ticket within 7 days and we resolve or refund.',
        'do-you-offer-refunds', 'published', now(), 10, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'pricing-licensing'),
        'Do you provide a GST invoice?',
        'Yes, a GST-compliant invoice is generated automatically after payment and is available in your account downloads.',
        'do-you-provide-a-gst-invoice', 'published', now(), 11, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'delivery-setup'),
        'How does 2-hour delivery work?',
        'Once payment is confirmed, provisioning starts automatically. Credentials, source code and setup notes reach your email within 120 minutes.',
        'how-does-2-hour-delivery-work', 'published', now(), 12, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'delivery-setup'),
        'Can you host and deploy it for me?',
        'Yes. Choose self-hosted (we hand over code plus a deployment guide) or managed deployment where our team installs it on your domain and server.',
        'can-you-host-and-deploy-it-for-me', 'published', now(), 13, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'delivery-setup'),
        'Which stack do the products use?',
        'Modern React/TypeScript frontends with Node or PHP backends and PostgreSQL/MySQL databases. The exact stack is listed on each product card under Tech Stack.',
        'which-stack-do-the-products-use', 'published', now(), 14, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'delivery-setup'),
        'Can I migrate my existing data?',
        'Yes. Send a CSV or database dump and our migration team maps and imports your records as part of onboarding.',
        'can-i-migrate-my-existing-data', 'published', now(), 15, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'demos'),
        'Can I try a product before paying?',
        'Yes. Every listing links to a real live demo with sample data. Demo credentials are shown on the demo screen — no signup and no card required.',
        'can-i-try-a-product-before-paying', 'published', now(), 16, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'demos'),
        'Are the demos the same build I receive?',
        'Yes. Demos run the same release you get on delivery, so what you test is what you deploy.',
        'are-the-demos-the-same-build-i-receive', 'published', now(), 17, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'demos'),
        'A demo link is not opening — what now?',
        'Demo health is monitored continuously. If a demo is under maintenance the card shows its status; request a fresh demo link from the product page and it is re-issued instantly.',
        'a-demo-link-is-not-opening-what-now', 'published', now(), 18, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'white-label-saas'),
        'Can I sell these products under my own brand?',
        'Yes. White label is included in the standard licence — replace the logo, colours, domain and product name and sell it as your own.',
        'can-i-sell-these-products-under-my-own-brand', 'published', now(), 19, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'white-label-saas'),
        'Can I run a product as a SaaS with multiple clients?',
        'Yes. SaaS-ready builds ship with multi-tenant support, subscription plans and tenant-level admin so you can onboard unlimited customers.',
        'can-i-run-a-product-as-a-saas-with-multiple-clients', 'published', now(), 20, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'white-label-saas'),
        'Is my white-label brand protected?',
        'Yes — trademark-protected branding, per-tenant asset isolation and licence keys tied to your account keep your brand and your clients separate from ours.',
        'is-my-white-label-brand-protected', 'published', now(), 21, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'partners'),
        'How does the reseller programme work?',
        'Resellers earn up to 40% margin on every $249 licence, get a branded storefront, demo access and lead routing from the marketplace.',
        'how-does-the-reseller-programme-work', 'published', now(), 22, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'partners'),
        'Can I publish my own product on the marketplace?',
        'Yes. Apply as a vendor or author, submit your product for the quality gate and security scan, and it goes live with the standard $249 lifetime price.',
        'can-i-publish-my-own-product-on-the-marketplace', 'published', now(), 23, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'partners'),
        'Do you offer franchise or territory rights?',
        'Yes — franchise partners get exclusive territory rights, onboarding, training and a regional revenue share. Apply from the Partner Ecosystem section.',
        'do-you-offer-franchise-or-territory-rights', 'published', now(), 24, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'support-security'),
        'What support do I get after purchase?',
        'One year of free technical support on every licence — bug fixes, deployment help and update assistance — with extendable annual plans afterwards.',
        'what-support-do-i-get-after-purchase', 'published', now(), 25, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'support-security'),
        'How secure are the products?',
        'Every upload passes a security scan, role-based access control is built in, and enterprise deployments add SSO, audit logs and regional data residency.',
        'how-secure-are-the-products', 'published', now(), 26, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'support-security'),
        'Do I get future updates?',
        'Yes. All major and minor version updates are included for life at no extra cost.',
        'do-i-get-future-updates', 'published', now(), 27, false)
on conflict (question, language) do nothing;

insert into public.faqs
  (category_id, question, answer, slug, status, published_at, position, ai_generated)
values ((select id from public.faq_categories where slug = 'support-security'),
        'Is enterprise support available for large teams?',
        'Yes — dedicated success manager, custom SLA, white-glove migration and 24/7 coverage for teams of 100 to 10,000+.',
        'is-enterprise-support-available-for-large-teams', 'published', now(), 28, false)
on conflict (question, language) do nothing;
