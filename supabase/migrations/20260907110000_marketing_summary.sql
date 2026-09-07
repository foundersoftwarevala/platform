-- Marketing at a glance, with seed and real kept apart.
--
-- Built on marketing_seed_summary(), which already exists and already counts
-- the split, plus the module counts the overview panel needs. Nothing here
-- blends a seeded figure into a real one.
create or replace function public.mm_marketing_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_seed jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  v_seed := public.marketing_seed_summary();

  return jsonb_build_object(
    'ok', true,
    'real_campaigns',    coalesce((v_seed->>'real_campaigns')::int, 0),
    'seed_campaigns',    coalesce((v_seed->>'seed_campaigns')::int, 0),
    'seed_revenue',      coalesce((v_seed->>'seed_revenue')::numeric, 0),
    'real_revenue',      coalesce((v_seed->>'real_revenue')::numeric, 0),
    'seed_leads',        coalesce((v_seed->>'seed_leads')::int, 0),
    'lead_records',      coalesce((v_seed->>'lead_records')::int, 0),
    'templates',         (select count(*) from public.marketing_templates),
    'automations',       (select count(*) from public.marketing_automations),
    'approvals_pending', (select count(*) from public.marketing_approvals
                           where coalesce(status,'') in ('pending','submitted','review')),
    'creatives',         (select count(*) from public.marketing_creatives),
    'messages',          (select count(*) from public.marketing_messages),
    -- Nothing has been delivered, because nothing can be: no provider is
    -- configured. Counted from the queue rather than asserted.
    'email_queued',      (select count(*) from public.email_queue));
end;
$$;
