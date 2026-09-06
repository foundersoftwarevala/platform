-- AMS catalogue: what can be earned, and what earns it.
--
-- Everything here is configuration. It describes the achievements, badges and
-- XP rules that exist in the world; it does not give anybody anything. The
-- distinction matters because the blueprint forbids fabricated progress but
-- obviously requires a catalogue to progress through.
--
-- Every XP source below names a real thing that already happens on this
-- platform and is recorded in a real table. Nothing rewards a click.

-- ---------------------------------------------------------------------------
-- XP sources — section 15.
-- ---------------------------------------------------------------------------
insert into public.xp_sources (name, slug, description, default_xp, status) values
  ('Order paid',          'order.paid',
   'A marketplace order reached paid status. Recorded in marketplace_orders.', 200, 'active'::entity_status),
  ('Product published',   'product.published',
   'A vendor product became visible and published in marketplace_products.',    75, 'active'),
  ('Lead captured',       'lead.captured',
   'A lead was created in leads.',                                              40, 'active'),
  ('Lead converted',      'lead.converted',
   'A lead reached a won/converted state in leads.',                           250, 'active'),
  ('Lead contacted',      'lead.contacted',
   'An outbound contact was logged in lead_communications.',                    15, 'active'),
  ('Task completed',      'task.completed',
   'A task reached a terminal completed state in tm_tasks.',                    60, 'active'),
  ('Task approved',       'task.approved',
   'A completed task was approved in tm_tasks.',                               100, 'active'),
  ('SEO issue resolved',  'seo.issue_resolved',
   'An SEO issue moved to resolved in seo_issues.',                             50, 'active'),
  ('SEO content published','seo.published',
   'An SEO page or product entry was published.',                               70, 'active'),
  ('Support resolved',    'support.resolved',
   'A support ticket was resolved.',                                            55, 'active'),
  ('Campaign delivered',  'campaign.delivered',
   'A marketing campaign completed delivery in marketing_campaigns.',           120, 'active')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- XP rules — section 29.
-- ---------------------------------------------------------------------------
-- A rule binds a source to a role, with a value and a ceiling. Ceilings exist
-- so that a person doing one thing repeatedly cannot outrank a person doing
-- the harder thing, and so an import cannot flood a balance.
--
-- Rules are scoped by role in `conditions`. A source with no role-scoped rule
-- simply pays nobody, which is the safe default.

insert into public.xp_rules
  (name, description, source_id, xp_value, multiplier, conditions, cooldown_seconds, max_per_day, status)
select v.name, v.description, s.id, v.xp, 1.0,
       jsonb_build_object('role', v.role), v.cooldown, v.per_day, 'active'::entity_status
from (values
  -- Commerce
  ('Reseller order paid',      'Paid order attributed to a reseller.',      'order.paid',        'reseller',    200, 0, 50),
  ('Vendor order paid',        'Paid order for a vendor product.',          'order.paid',        'vendor',      180, 0, 50),
  ('Affiliate order paid',     'Paid order from an affiliate referral.',    'order.paid',        'affiliate',   150, 0, 50),
  ('Franchise order paid',     'Paid order within a franchise territory.',  'order.paid',        'franchise',   160, 0, 50),
  ('Vendor product published', 'Vendor published a product.',               'product.published', 'vendor',       75, 0, 20),
  -- Pipeline
  ('Reseller lead captured',   'Lead captured by a reseller.',              'lead.captured',     'reseller',     40, 0, 40),
  ('Affiliate lead captured',  'Lead captured by an affiliate.',            'lead.captured',     'affiliate',    40, 0, 40),
  ('Reseller lead converted',  'Lead converted by a reseller.',             'lead.converted',    'reseller',    250, 0, 20),
  ('Affiliate lead converted', 'Lead converted by an affiliate.',           'lead.converted',    'affiliate',   220, 0, 20),
  ('Support lead contacted',   'Outbound contact logged.',                  'lead.contacted',    'support',      15, 300, 30),
  -- Delivery
  ('Developer task completed', 'Developer completed a task.',               'task.completed',    'developer',    60, 0, 25),
  ('Developer task approved',  'Developer task approved by review.',        'task.approved',     'developer',   100, 0, 25),
  ('Manager task approved',    'Manager approved delivered work.',          'task.approved',     'manager',      70, 0, 30),
  ('Operator task completed',  'Operator completed an operational task.',   'task.completed',    'operator',     60, 0, 25),
  -- Content and search
  ('SEO issue resolved',       'SEO specialist resolved an issue.',         'seo.issue_resolved','seo',          50, 0, 40),
  ('SEO content published',    'SEO content published live.',               'seo.published',     'seo',          70, 0, 30),
  ('Author content published', 'Author published documentation.',           'seo.published',     'author',       70, 0, 20),
  ('Creator content published','Creator published a produced asset.',       'seo.published',     'creator',      70, 0, 20),
  -- Service and reach
  ('Support resolution',       'Support resolved a ticket.',                'support.resolved',  'support',      55, 0, 40),
  ('Influencer campaign',      'Influencer campaign delivered.',            'campaign.delivered','influencer',  120, 0, 10),
  ('Manager campaign',         'Campaign delivered under a manager.',       'campaign.delivered','manager',      90, 0, 10)
) as v(name, description, source_slug, role, xp, cooldown, per_day)
join public.xp_sources s on s.slug = v.source_slug
where not exists (
  select 1 from public.xp_rules r
  where r.name = v.name
);

-- ---------------------------------------------------------------------------
-- Achievements — section 11.
-- ---------------------------------------------------------------------------
-- One achievement per role stage, carrying the curated stage title so the
-- vocabulary a person sees in their vault matches the trophy they hold.

insert into public.achievement_categories (name, slug, description, sort_order, status)
values ('Career Progression', 'career-progression',
        'Stage achievements earned by advancing through a role''s ten stages.', 1, 'active'::entity_status)
on conflict (slug) do nothing;

insert into public.achievements
  (name, slug, description, category_id, rarity, xp_reward, conditions, status)
select
  st.title,
  st.role || '-stage-' || lpad(st.stage::text, 2, '0'),
  'Reached stage ' || st.stage || ' of the ' || initcap(st.role) || ' career path.',
  (select id from public.achievement_categories where slug = 'career-progression'),
  case
    when st.stage <= 2 then 'common'
    when st.stage =  3 then 'uncommon'
    when st.stage =  4 then 'rare'
    when st.stage =  5 then 'epic'
    when st.stage =  6 then 'elite'
    when st.stage <= 8 then 'legendary'
    when st.stage =  9 then 'mythic'
    else 'founder'
  end::rarity_tier,
  0,  -- Stage achievements recognise XP already earned; they do not pay again.
  jsonb_build_object('role', st.role, 'stage', st.stage),
  'active'::entity_status
from public.ams_role_stages st
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Badges — section 10.
-- ---------------------------------------------------------------------------
insert into public.badge_collections (name, slug, description, status)
values ('Role Progression', 'role-progression',
        'Stage badges, one per role stage.', 'active'::entity_status)
on conflict (slug) do nothing;

insert into public.badges
  (name, slug, description, collection_id, rarity, conditions, status)
select
  st.title,
  st.role || '-badge-' || lpad(st.stage::text, 2, '0'),
  initcap(st.role) || ' stage ' || st.stage || ' badge.',
  (select id from public.badge_collections where slug = 'role-progression'),
  case
    when st.stage <= 2 then 'common'
    when st.stage =  3 then 'uncommon'
    when st.stage =  4 then 'rare'
    when st.stage =  5 then 'epic'
    when st.stage =  6 then 'elite'
    when st.stage <= 8 then 'legendary'
    when st.stage =  9 then 'mythic'
    else 'founder'
  end::rarity_tier,
  jsonb_build_object('role', st.role, 'stage', st.stage),
  'active'::entity_status
from public.ams_role_stages st
on conflict (slug) do nothing;
