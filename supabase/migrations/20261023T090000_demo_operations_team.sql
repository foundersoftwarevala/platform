-- The Demo Operations team, registered where Founder AI already keeps its agents.
--
-- ai_agents holds 134 of them, every one lifecycle CONFIGURED, and three
-- already concern demos: sales-demo-booking, sales-demo-followup and
-- mon-product-demo. None of those is this team — they book demos for customers
-- and watch product pages. So seven rows are added rather than a second
-- registry being invented.
--
-- Two things these rows are honest about, because a registry that flatters
-- itself is worse than no registry.
--
-- First, `lifecycle`. Every existing row says CONFIGURED and ai_agent_runs is
-- empty, so nothing here has ever executed. These seven say the same word and
-- mean it: described, not running. The one exception is the health worker,
-- which genuinely runs every fifteen minutes and has 954 rows of history to
-- show for it.
--
-- Second, `blocked_reason`. Where a member cannot run today, the row says why
-- in the column the platform already uses for exactly that, rather than
-- appearing ready and failing when called.
--
-- The split between worker and agent follows the rule that keeps this cheap:
-- anything deterministic is a worker, and AI is reserved for judgement. An
-- HTTP status, a certificate expiry, a canonical URL and a duplicate check are
-- facts, and asking a language model for a fact is both slower and less
-- reliable than computing it. Which product a demo belongs to, whether a
-- footer credit is business branding or technical attribution — those are
-- judgements, and that is what the three agents are for.

-- agent_key is the key this registry is addressed by — every function that
-- looks an agent up does it by agent_key — but nothing enforced it. All 134
-- rows are already distinct and none is null, so the promise is true and was
-- simply never written down. Writing it down is what makes an upsert possible
-- and stops a second row for an agent that already exists.
CREATE UNIQUE INDEX IF NOT EXISTS ai_agents_agent_key_key
  ON public.ai_agents (agent_key);

INSERT INTO public.ai_agents
  (agent_key, name, purpose, status, lifecycle, specialization, capability,
   permissions, max_concurrent, system_prompt, blocked_reason)
VALUES

-- ---------------------------------------------------------------- workers
('demo-intake',
 'Demo Intake Worker',
 'Normalises a submitted demo address, decides whether it is already known, and queues the scan. Deterministic: no model is involved in deciding that two addresses are the same demo.',
 'active', 'CONFIGURED', 'PRODUCT', 'FAST',
 ARRAY['READ','CREATE'], 4,
 '',
 'Runs inside investigateDemo today rather than off the queue. The canonical-identity half is live; the queued half needs a worker process pointed at the database holding fa_jobs.'),

('demo-scanner',
 'Demo Scanner Worker',
 'Fetches the demo through the SSRF-guarded client and extracts the evidence: status, certificate, redirects, title, favicons, logos, contact details, outside links and credits. Stores evidence separately from any conclusion drawn about it.',
 'active', 'CONFIGURED', 'PRODUCT', 'FAST',
 ARRAY['READ','CREATE'], 2,
 '',
 'Implemented and proven: investigateDemo ran end to end on the live demo. Not yet driven from the queue.'),

('demo-health',
 'Demo Health Worker',
 'Checks every active demo on a schedule: real HTTP status, real elapsed time against the 2,500 ms threshold, real certificate validity and days remaining. Appends history so uptime is counted rather than declared, and de-duplicates alerts so a demo that has been down for a week does not raise a new one every fifteen minutes.',
 'active', 'CONFIGURED', 'PRODUCT', 'FAST',
 ARRAY['READ','CREATE'], 8,
 '',
 NULL),

('demo-sync',
 'Demo Sync Worker',
 'Makes the verified demo relationship the one the marketplace serves, and confirms the public demo button resolves to it.',
 'active', 'CONFIGURED', 'PRODUCT', 'FAST',
 -- Not UPDATE: the registry permits READ, ANALYZE, RECOMMEND, CREATE and
 -- EXECUTE_LOW_RISK, and deliberately not arbitrary mutation. Pointing the
 -- marketplace at an already-verified demo row is the low-risk execution that
 -- vocabulary is for, so the guardrail stands rather than being widened.
 ARRAY['READ','EXECUTE_LOW_RISK'], 2,
 '',
 'Not built. The relationship it would synchronise is already canonical — demo-gateway reads product_demo_urls directly — so what is missing is the revalidation and the after-the-fact check, not the connection.'),

-- ----------------------------------------------------------------- agents
('demo-intelligence',
 'Demo Intelligence Agent',
 'Reads the scanner evidence against the real catalogue and says what the software is and which marketplace category it belongs to, with its confidence and the evidence behind it. Never invents a product: a category it names must exist, and a value it quotes must appear in the page.',
 'active', 'CONFIGURED', 'PRODUCT', 'STRUCTURED_OUTPUT',
 ARRAY['READ','ANALYZE','RECOMMEND'], 2,
 'You prepare third-party software demos for the Software Vala marketplace. Answer only from the evidence you are given, and copy every value exactly as it appears.',
 'Runs through the AI API Manager gateway and has produced a real answer: RouteMasterPT, category public-transport, confidence 0.9, nothing dropped as unfounded. Its weakness is that the product is supplied to it rather than searched for.'),

('demo-brand-compliance',
 'Brand Compliance Agent',
 'Separates the developer''s public business identity — their phone, e-mail, WhatsApp, site, social links, credits and logo — from the demo''s own working content and from legitimate technical attribution. Vercel, Lovable, React and the rest are infrastructure and stay.',
 'active', 'CONFIGURED', 'COMPLIANCE', 'STRUCTURED_OUTPUT',
 ARRAY['READ','ANALYZE','RECOMMEND'], 2,
 'Distinguish a developer''s business identity from application data and from technical infrastructure. When unsure, keep the value and say why.',
 'Implemented as part of the same investigation pass, and its verification is the stricter half: activateDemo refuses to publish a demo unless the Software Vala favicon is in place and none of the removed details survive.'),

('demo-marketplace-matching',
 'Marketplace Matching Agent',
 'Finds the existing product, category and card slot a verified demo belongs to, and the demo-less cards waiting for one. Never creates a product, a category or a card.',
 'active', 'CONFIGURED', 'PRODUCT', 'REASONING',
 ARRAY['READ','ANALYZE','RECOMMEND'], 2,
 'Match a demo to an existing marketplace product. If no existing product fits, say so rather than proposing a new one.',
 'Half present. mm_demoless_cards answers which cards are waiting — 7,279 of 7,280 — and the category match is real and recorded. Searching the catalogue for the right product from evidence alone is not built; today an operator names the product.')

ON CONFLICT (agent_key) DO UPDATE SET
  name            = EXCLUDED.name,
  purpose         = EXCLUDED.purpose,
  specialization  = EXCLUDED.specialization,
  capability      = EXCLUDED.capability,
  permissions     = EXCLUDED.permissions,
  max_concurrent  = EXCLUDED.max_concurrent,
  blocked_reason  = EXCLUDED.blocked_reason;

-- The concurrency ceilings on the queue and on the registry describe the same
-- thing and are kept in step deliberately: an operator raising one and not the
-- other would get whichever is lower, silently.
UPDATE public.fa_job_limits l
   SET max_concurrent = a.max_concurrent, updated_at = now()
  FROM public.ai_agents a
 WHERE (l.job_type, a.agent_key) IN
       (('demo.intake','demo-intake'), ('demo.scan','demo-scanner'),
        ('demo.health','demo-health'), ('demo.sync','demo-sync'))
   AND l.max_concurrent <> a.max_concurrent;
