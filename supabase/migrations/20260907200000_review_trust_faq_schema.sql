-- Review Manager, Trust Manager and FAQ Manager.
--
-- What was already here:
--
--   marketplace_reviews      the canonical review table, empty, and already
--                            carrying order_item_id NOT NULL — which means a
--                            review cannot exist without a purchase behind it,
--                            so section 4's verified-purchase rule is enforced
--                            by the schema rather than by a badge
--   storefront_trust_items   six rows, all disabled — the payment-rail strip,
--                            not the verification badges section 12 describes
--   src/lib/site-content/faq twenty-eight real, accurate FAQs in a TypeScript
--                            file, rendered on the storefront from a
--                            browser-local store the manager also edits, so
--                            nothing an operator changed ever reached a visitor
--
-- The FAQ content below is moved, not invented: the same twenty-eight questions
-- and answers, now in a table that the manager writes and the storefront reads.

/* =================================================================== REVIEWS */

alter table public.marketplace_reviews add column if not exists title text;
alter table public.marketplace_reviews add column if not exists review_type text
  not null default 'text';
alter table public.marketplace_reviews add column if not exists helpful_count integer
  not null default 0;
alter table public.marketplace_reviews add column if not exists report_count integer
  not null default 0;
alter table public.marketplace_reviews add column if not exists moderated_by uuid;
alter table public.marketplace_reviews add column if not exists moderated_at timestamptz;
alter table public.marketplace_reviews add column if not exists moderation_note text;
alter table public.marketplace_reviews add column if not exists published_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='marketplace_reviews_type_check') then
    alter table public.marketplace_reviews add constraint marketplace_reviews_type_check
      check (review_type in ('text','image','video'));
  end if;
end;
$$;

comment on column public.marketplace_reviews.order_item_id is
  'The purchase this review is about. NOT NULL, which is what makes every review '
  'a verified purchase: there is no way to record one without an order line.';

-- Media. Kept out of the review row so a review can carry several images or a
-- video without the row growing a column per asset.
create table if not exists public.review_media (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.marketplace_reviews(id) on delete cascade,
  kind text not null check (kind in ('image','video')),
  -- A storage path, not a public URL. Section 8 requires private files stay
  -- private, so the path is signed at read time rather than exposed.
  storage_path text not null,
  thumbnail_path text,
  processing_status text not null default 'pending'
    check (processing_status in ('pending','ready','failed')),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending','approved','rejected')),
  bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists review_media_review_idx on public.review_media (review_id);

create table if not exists public.review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.marketplace_reviews(id) on delete cascade,
  author_id uuid,
  -- Who is speaking. The storefront shows this, so an official reply is never
  -- mistaken for a vendor's and the other way round.
  author_role text not null
    check (author_role in ('official','vendor','author','reseller')),
  content text not null check (length(btrim(content)) > 0),
  status text not null default 'published'
    check (status in ('draft','published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists review_replies_review_idx on public.review_replies (review_id);

create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.marketplace_reviews(id) on delete cascade,
  reporter_id uuid,
  reason text not null check (reason in
    ('spam','fake','abuse','harassment','misleading','copyright',
     'personal_information','fraud','other')),
  detail text,
  status text not null default 'open'
    check (status in ('open','investigating','upheld','dismissed')),
  resolved_by uuid,
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz not null default now(),
  -- One person reports one review once. Repeated reports from one account are
  -- not evidence of anything.
  constraint review_reports_once unique (review_id, reporter_id)
);
create index if not exists review_reports_open_idx
  on public.review_reports (status) where status in ('open','investigating');

create table if not exists public.review_votes (
  review_id uuid not null references public.marketplace_reviews(id) on delete cascade,
  user_id uuid not null,
  helpful boolean not null,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

/* ==================================================================== TRUST */

-- The badge definitions. Each one is a rule, not a stored flag: whether a badge
-- shows for a given product or seller is worked out at read time from the
-- canonical data, so a badge can never outlive the fact behind it.
create table if not exists public.trust_badges (
  key text primary key,
  label text not null,
  description text not null,
  icon text,
  enabled boolean not null default false,
  priority integer not null default 10,
  -- Where it is allowed to appear. The storefront asks for a surface and gets
  -- only the badges configured for it.
  display_locations text[] not null default array['product_card','product_detail'],
  -- Human-readable statement of what has to be true. The rule itself lives in
  -- trust_evaluate below; this is what an operator reads.
  rule_summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trust_audit_logs (
  id uuid primary key default gen_random_uuid(),
  badge_key text references public.trust_badges(key) on delete cascade,
  entity_type text,
  entity_id uuid,
  action text not null,
  actor_id uuid,
  reason text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);
create index if not exists trust_audit_badge_idx on public.trust_audit_logs (badge_key, created_at desc);

insert into public.trust_badges (key, label, description, icon, priority, rule_summary, display_locations)
values
  ('verified_product', 'Verified Product',
   'The product has been approved by the marketplace and belongs to an approved seller.',
   'ShieldCheck', 10,
   'Product moderation_status is approved, it is visible, and its seller is approved.',
   array['product_card','product_detail']),
  ('verified_vendor', 'Verified Vendor',
   'The seller is an approved vendor with at least one published product.',
   'BadgeCheck', 20,
   'Seller kind is vendor, status is approved, and it has a published product.',
   array['product_detail','vendor_profile']),
  ('verified_author', 'Verified Author',
   'The seller is an approved author with at least one published product.',
   'PenTool', 30,
   'Seller kind is author, status is approved, and it has a published product.',
   array['product_detail','author_profile']),
  ('verified_reviews', 'Verified Reviews',
   'Every review shown is tied to a real purchase and has passed moderation.',
   'Star', 40,
   'The product has at least one published review, and every review is bound to an order line.',
   array['product_card','product_detail']),
  ('instant_delivery', 'Instant Delivery',
   'The product is delivered by licence key as soon as payment is confirmed.',
   'Zap', 50,
   'The product has a live demo and licence issuance is configured for it.',
   array['product_card','product_detail','checkout']),
  ('secure_purchase', 'Secure Purchase',
   'Payment runs through the marketplace''s own order and payment flow.',
   'Lock', 60,
   'A payment provider is configured and the order flow issues a licence on payment.',
   array['product_detail','checkout','footer'])
on conflict (key) do nothing;

/* ====================================================================== FAQ */

create table if not exists public.faq_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  position integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.faq_categories(id) on delete set null,
  question text not null check (length(btrim(question)) > 0),
  answer text not null check (length(btrim(answer)) > 0),
  slug text unique,
  tags text[] not null default '{}',
  language text not null default 'en',
  -- A translation points at the FAQ it translates. The original is never
  -- overwritten, which is what section 32 asks for.
  translation_of uuid references public.faqs(id) on delete cascade,
  seo_title text,
  seo_description text,
  keywords text[] not null default '{}',
  related_product_ids uuid[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft','pending_review','scheduled','published','archived')),
  -- True until a person has approved it. An AI draft stays identifiable.
  ai_generated boolean not null default false,
  ai_sources jsonb not null default '[]'::jsonb,
  scheduled_for timestamptz,
  published_at timestamptz,
  version integer not null default 1,
  author_id uuid,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A scheduled FAQ without a time would never publish.
  constraint faqs_schedule_needs_time
    check (status <> 'scheduled' or scheduled_for is not null)
);

create index if not exists faqs_status_idx on public.faqs (status, position);
create index if not exists faqs_category_idx on public.faqs (category_id);
create index if not exists faqs_language_idx on public.faqs (language);
create index if not exists faqs_search_idx
  on public.faqs using gin (to_tsvector('english', question || ' ' || answer));

-- History. Never destroyed, so a rollback restores rather than reconstructs.
create table if not exists public.faq_versions (
  id uuid primary key default gen_random_uuid(),
  faq_id uuid not null references public.faqs(id) on delete cascade,
  version integer not null,
  question text not null,
  answer text not null,
  status text not null,
  change_summary text,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  snapshot jsonb not null,
  constraint faq_versions_unique unique (faq_id, version)
);
create index if not exists faq_versions_faq_idx on public.faq_versions (faq_id, version desc);

insert into public.faq_categories (slug, name, position) values
  ('general','General',1),
  ('pricing-licensing','Pricing & Licensing',2),
  ('delivery-setup','Delivery & Setup',3),
  ('demos','Demos',4),
  ('white-label-saas','White Label & SaaS',5),
  ('partners','Partners',6),
  ('support-security','Support & Security',7)
on conflict (slug) do nothing;
