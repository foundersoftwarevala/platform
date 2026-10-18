-- Functions that write were callable by anyone on the internet.
--
-- PostgREST at https://softwarevala.net/rest/v1 is public, and each function
-- below was SECURITY DEFINER, granted to PUBLIC/anon/authenticated, and did not
-- check who was calling. Anyone holding the public key could:
--   mm_notify                        put any text and link into any user's bell,
--                                    or every admin's (phishing inside the product)
--   reseller_commissions_reverse     reverse any reseller's earned commission
--   reseller_/influencer_commissions_for_order
--                                    create commission for an order that was never paid
--   mm_issue_for_order               trigger licence issuance
--   founder_memory_record / _retract rewrite Founder memory under any actor name
--   fa_agent_run_open / _close / _reap, founder_incident_claim,
--   founder_purge_check_healing, influencer_tier_evaluate
--                                    drive internal workers
-- Every legitimate caller is either a trigger (runs with the owner's rights) or
-- server code / a cron script using the service-role key, so execute is kept
-- for service_role only. Checked callers: src/lib/founder/memory/memory.server.ts,
-- src/lib/founder/healing/executor.server.ts, scripts/ops/self-healing-worker.mjs,
-- scripts/ops/vala-tv-youtube-sync.mjs, scripts/ops/sv-influencer-tiers.sh.
--
-- The commission creators also refuse an order that is not paid: they were only
-- guarded by the trigger that calls them on payment, not by themselves.
--
-- demo_intake_batches had row security off and full anon/authenticated grants;
-- it is only ever used through the service role (src/lib/demo/rest.server.ts).

begin;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('mm_notify', 'reseller_commissions_reverse', 'reseller_commissions_for_order',
                         'influencer_commissions_for_order', 'mm_issue_for_order',
                         'founder_memory_record', 'founder_memory_retract',
                         'fa_agent_run_open', 'fa_agent_run_close', 'fa_agent_run_reap',
                         'founder_incident_claim', 'founder_purge_check_healing',
                         'influencer_tier_evaluate')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

-- Refuse an unpaid order inside each commission creator.
do $$
declare
  fn text;
  def text;
  anchor text := 'select buyer_id into v_buyer from public.marketplace_orders where id = p_order;';
  guard text := E'\n  -- Commission exists only for a paid order.\n'
    || E'  if (select o.status from public.marketplace_orders o where o.id = p_order) is distinct from ''paid'' then\n'
    || E'    return jsonb_build_object(''ok'', false, ''created'', 0, ''reason'', ''order_not_paid'');\n'
    || E'  end if;';
begin
  foreach fn in array array['reseller_commissions_for_order', 'influencer_commissions_for_order'] loop
    def := pg_get_functiondef(('public.' || fn)::regproc);
    if position('order_not_paid' in def) > 0 then
      continue;
    end if;
    if position(anchor in def) = 0 then
      raise exception '% no longer has the expected shape; not edited', fn;
    end if;
    execute replace(def, anchor, anchor || guard);
  end loop;
end $$;

alter table public.demo_intake_batches enable row level security;
revoke all on public.demo_intake_batches from anon, authenticated;
grant all on public.demo_intake_batches to service_role;

commit;
