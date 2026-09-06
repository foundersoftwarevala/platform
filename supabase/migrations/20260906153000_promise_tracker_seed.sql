-- The vocabulary the module needs to work, and nothing that pretends to be data.
--
-- Section 20 requires categories to be database-driven and lists the ones the
-- business uses; section 23 lists the settings. Those are configuration - the
-- module cannot file a promise without them - so they are seeded here, exactly
-- as the source defines them.
--
-- The source also seeds twenty-four promises, six AI insights and eight audit
-- entries describing invented clients, invented fines and invented escalations.
-- Section 29 forbids production mock data, and a fabricated fine sitting in a
-- finance table is worse than an empty screen: somebody will eventually read it
-- as real money owed. None of that is seeded. The screens will show honest empty
-- states until real promises are made.
--
-- Every statement is idempotent, so re-running this changes nothing.

insert into public.promise_categories (slug, label, accent, sort_order) values
  ('sales','Sales','sky',1),
  ('support','Support','emerald',2),
  ('delivery','Delivery','violet',3),
  ('payment','Payment','amber',4),
  ('legal','Legal','rose',5),
  ('partnership','Partnership','cyan',6),
  ('sla','SLA','indigo',7)
on conflict (slug) do nothing;

insert into public.promise_subcategories (category_id, slug, label, sort_order)
select c.id, s.slug, s.label, s.sort_order
from public.promise_categories c
join (values
  ('sales','price-lock','Price Lock',1),
  ('sales','discount-commitment','Discount Commitment',2),
  ('sales','demo-timeline','Demo Timeline',3),
  ('support','response-time','Response Time',1),
  ('support','resolution-time','Resolution Time',2),
  ('support','callback','Callback',3),
  ('delivery','go-live','Go-Live',1),
  ('delivery','feature-delivery','Feature Delivery',2),
  ('delivery','update-release','Update Release',3),
  ('payment','refund-promise','Refund Promise',1),
  ('payment','payout-date','Payout Date',2),
  ('payment','invoice-clearance','Invoice Clearance',3),
  ('legal','agreement-delivery','Agreement Delivery',1),
  ('legal','nda','NDA',2),
  ('legal','compliance','Compliance',3),
  ('partnership','revenue-share','Revenue Share',1),
  ('partnership','integration-timeline','Integration Timeline',2),
  ('partnership','support-level','Support Level',3),
  ('sla','uptime-commitment','Uptime Commitment',1),
  ('sla','response-sla','Response SLA',2),
  ('sla','resolution-sla','Resolution SLA',3)
) as s(cat, slug, label, sort_order) on s.cat = c.slug
on conflict (category_id, slug) do nothing;

-- Fine and tip rules are policy, not data: they say what the business will do,
-- and they apply to nothing until a real promise is delayed or delivered early.
insert into public.promise_rules (code, kind, name, rule_type, amount, auto_apply, is_active) values
  ('FR-001','fine','Delayed Promise Fine','fixed',500,true,true),
  ('FR-002','fine','Broken Promise Penalty','percentage',5,true,true),
  ('FR-003','fine','SLA Breach Fine','fixed',2000,false,true),
  ('FR-004','fine','Critical Deadline Miss','fixed',5000,true,false),
  ('TR-001','tip','Early Delivery Bonus','fixed',1000,false,true),
  ('TR-002','tip','Client Satisfaction Tip','percentage',2,false,true),
  ('TR-003','tip','Streak Bonus (5 on-time)','fixed',2500,true,true)
on conflict (code) do nothing;

insert into public.promise_settings (singleton) values (true)
on conflict (singleton) do nothing;
