-- The Control Panel cockpit's figures, counted from the tables that hold them.
--
-- Every one of the cockpit's forty tiles was a number typed into the page -
-- "₹42.5L" revenue, "2,847" users, "99.97%" uptime - that never changed and
-- described nothing. This function counts each figure from the table the
-- matching Manager already reads, in one round trip, so the cockpit and the
-- Managers can never disagree.
--
-- Where the platform keeps no record of a thing - there is no clone log, no
-- regional risk score, no product update request - the cockpit leaves the
-- figure out and says it is not tracked. An invented number is worse than none.
--
-- Money is summed per currency and never converted: the orders carry their own
-- currency and no exchange rate is stored beside them.
--
-- "Today" and "this month" are Indian Standard Time, the business day.
--
-- Only the service role may call it. The API in front of it checks the caller's
-- role first; the function reads across every module and must not be reachable
-- by a signed-in customer.

create or replace function public.control_panel_cockpit()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz constant text := 'Asia/Kolkata';
  day_start timestamptz := date_trunc('day', now() at time zone tz) at time zone tz;
  month_start timestamptz := date_trunc('month', now() at time zone tz) at time zone tz;
  last_month_start timestamptz := (date_trunc('month', now() at time zone tz) - interval '1 month') at time zone tz;
  result jsonb := '{}'::jsonb;
begin
  -- Paid orders: revenue, by currency.
  result := result || jsonb_build_object(
    'revenue_total', (select coalesce(jsonb_object_agg(currency, amount), '{}'::jsonb) from (
        select currency, sum(total) amount from marketplace_orders
         where status = 'paid' and coalesce(soft_delete_flag, false) = false group by currency) t),
    'revenue_month', (select coalesce(jsonb_object_agg(currency, amount), '{}'::jsonb) from (
        select currency, sum(total) amount from marketplace_orders
         where status = 'paid' and coalesce(soft_delete_flag, false) = false
           and created_at >= month_start group by currency) t),
    'revenue_last_month', (select coalesce(jsonb_object_agg(currency, amount), '{}'::jsonb) from (
        select currency, sum(total) amount from marketplace_orders
         where status = 'paid' and coalesce(soft_delete_flag, false) = false
           and created_at >= last_month_start and created_at < month_start group by currency) t),
    'revenue_today', (select coalesce(jsonb_object_agg(currency, amount), '{}'::jsonb) from (
        select currency, sum(total) amount from marketplace_orders
         where status = 'paid' and coalesce(soft_delete_flag, false) = false
           and created_at >= day_start group by currency) t),
    'paid_orders', (select count(*) from marketplace_orders
        where status = 'paid' and coalesce(soft_delete_flag, false) = false),
    'paid_orders_series', (select coalesce(jsonb_agg(n order by d), '[]'::jsonb) from (
        select d, (select count(*) from marketplace_orders o
                    where o.status = 'paid' and coalesce(o.soft_delete_flag, false) = false
                      and o.created_at >= d and o.created_at < d + interval '1 day') n
          from generate_series(day_start - interval '13 days', day_start, interval '1 day') d) s)
  );

  -- Accounts.
  result := result || jsonb_build_object(
    'accounts', (select count(*) from profiles),
    'accounts_seen_30d', (select count(*) from profiles where last_seen_at >= now() - interval '30 days')
  );

  -- Franchises, and where they are.
  result := result || jsonb_build_object(
    'franchises_total', (select count(*) from franchises),
    'franchises_active', (select count(*) from franchises where status = 'active'),
    'franchises_pending', (select count(*) from franchises where status = 'pending'),
    'franchise_countries', (select count(distinct lower(trim(country))) from franchises
        where nullif(trim(country), '') is not null),
    'franchise_continents', (select count(distinct c.region) from franchises f
        join registry_countries c on lower(c.name) = lower(trim(f.country)) or upper(c.code) = upper(trim(f.country))),
    'franchise_top_continent', (select c.region from franchises f
        join registry_countries c on lower(c.name) = lower(trim(f.country)) or upper(c.code) = upper(trim(f.country))
        group by c.region order by count(*) desc, c.region limit 1),
    'royalty_due', (select coalesce(sum(royalty_due), 0) from franchise_royalties),
    'royalty_records', (select count(*) from franchise_royalties)
  );

  -- Servers: the registered instances and each one's latest reading.
  result := result || jsonb_build_object(
    'servers_total', (select count(*) from server_instances),
    'servers_up', (select count(*) from server_instances where status in ('active', 'running', 'online')),
    'servers_healthy', (select count(*) from server_instances where health_status = 'healthy'),
    'uptime_avg', (select round(avg(uptime_percent), 2) from server_instances where uptime_percent is not null),
    'storage_gb', (select sum(storage_gb) from server_instances),
    'latest_metrics', (select jsonb_build_object(
        'cpu', round(avg(m.cpu_usage), 1), 'ram', round(avg(m.ram_usage), 1),
        'disk', round(avg(m.disk_usage), 1), 'recorded_at', max(m.recorded_at))
        from server_instances s
        cross join lateral (select h.cpu_usage, h.ram_usage, h.disk_usage, h.recorded_at
                              from server_metrics_history h where h.server_id = s.id
                             order by h.recorded_at desc limit 1) m),
    'cpu_series', (select coalesce(jsonb_agg(cpu order by recorded_at), '[]'::jsonb) from (
        select recorded_at, round(avg(cpu_usage), 1) cpu from server_metrics_history
         group by recorded_at order by recorded_at desc limit 14) t),
    'ram_series', (select coalesce(jsonb_agg(ram order by recorded_at), '[]'::jsonb) from (
        select recorded_at, round(avg(ram_usage), 1) ram from server_metrics_history
         group by recorded_at order by recorded_at desc limit 14) t),
    'server_alerts_open', (select count(*) from server_alerts
        where coalesce(is_resolved, false) = false and resolved_at is null)
  );

  -- Activity on the marketplace.
  result := result || jsonb_build_object(
    'events_hour', (select count(*) from marketplace_events where created_at >= now() - interval '1 hour'),
    'events_series', (select coalesce(jsonb_agg(n order by h), '[]'::jsonb) from (
        select h, (select count(*) from marketplace_events e
                    where e.created_at >= h and e.created_at < h + interval '1 hour') n
          from generate_series(date_trunc('hour', now()) - interval '13 hours', date_trunc('hour', now()), interval '1 hour') h) s),
    'demo_clicks_30d', (select count(*) from marketplace_events
        where event_type = 'demo_click' and created_at >= now() - interval '30 days')
  );

  -- Approvals waiting on someone. Role applications are counted by the API from
  -- the application registry, which owns the rule for what counts as one.
  result := result || jsonb_build_object(
    'deploy_requests', (select count(*) from server_deployments
        where status in ('pending', 'queued', 'requested', 'awaiting_approval')),
    'legal_approvals', (select count(*) from legal_records
        where category = 'approval' and status in ('pending', 'in_review', 'awaiting_approval')),
    'latest_deployment', (select jsonb_build_object('status', status, 'at', coalesce(deployed_at, created_at))
        from server_deployments order by coalesce(deployed_at, created_at) desc limit 1)
  );

  -- Work in the Task Manager.
  result := result || jsonb_build_object(
    'tasks_open', (select count(*) from tm_tasks
        where status not in ('approved', 'rejected', 'completed', 'cancelled', 'failed', 'closed')),
    'tasks_completed_today', (select count(*) from tm_tasks where completed_at >= day_start),
    'tasks_due_today', (select count(*) from tm_tasks
        where status not in ('approved', 'rejected', 'completed', 'cancelled', 'failed', 'closed')
          and deadline >= day_start and deadline < day_start + interval '1 day'),
    'tasks_due_week', (select count(*) from tm_tasks
        where status not in ('approved', 'rejected', 'completed', 'cancelled', 'failed', 'closed')
          and deadline >= day_start and deadline < day_start + interval '7 days'),
    'tasks_due_done', (select count(*) from tm_tasks where completed_at is not null and deadline is not null),
    'tasks_on_time', (select count(*) from tm_tasks
        where completed_at is not null and deadline is not null and completed_at <= deadline)
  );

  -- The job queue behind the AI workers.
  result := result || jsonb_build_object(
    'jobs_running', (select count(*) from fa_jobs where status = 'running'),
    'jobs_queued', (select count(*) from fa_jobs where status in ('queued', 'retrying')),
    'jobs_oldest_queued', (select min(created_at) from fa_jobs where status in ('queued', 'retrying')),
    'jobs_dead', (select count(*) from fa_jobs where status = 'dead_letter')
  );

  -- Support.
  result := result || jsonb_build_object(
    'tickets_open', (select count(*) from support_tickets where status not in ('resolved', 'closed')),
    'tickets_resolved_today', (select count(*) from support_tickets where resolved_at >= day_start),
    'csat_avg', (select round(avg(csat)::numeric, 1) from support_tickets where csat is not null),
    'csat_count', (select count(*) from support_tickets where csat is not null)
  );

  -- Catalogue and demos.
  result := result || jsonb_build_object(
    'products_total', (select count(*) from marketplace_products where deleted_at is null),
    'products_live', (select count(*) from marketplace_products where deleted_at is null and visible
        and content_status = 'published' and moderation_status = 'approved'),
    'demos_active', (select count(*) from product_demo_urls where status = 'active'),
    'demos_reachable', (select count(*) from product_demo_urls
        where status = 'active' and last_http_status between 200 and 399),
    'demos_checked', (select count(*) from product_demo_urls where status = 'active' and last_checked_at is not null),
    'demo_requests', (select count(*) from demo_requests),
    'demo_requests_pending', (select count(*) from demo_requests where status = 'pending'),
    'demo_requests_approved', (select count(*) from demo_requests where status = 'approved')
  );

  -- Finance.
  result := result || jsonb_build_object(
    'master_wallet', (select jsonb_build_object('balance', balance, 'currency', currency)
        from finance_wallets where owner_type = 'master' order by created_at limit 1),
    'inflow_month', (select coalesce(sum(amount), 0) from finance_transactions
        where direction = 'credit' and status = 'completed' and occurred_at >= month_start),
    'outflow_month', (select coalesce(sum(amount), 0) from finance_transactions
        where direction = 'debit' and status = 'completed' and occurred_at >= month_start),
    'finance_last_txn', (select max(occurred_at) from finance_transactions)
  );

  -- Open alerts from every module that raises them, by severity.
  result := result || jsonb_build_object('alerts', (
    select jsonb_build_object(
      'critical', count(*) filter (where sev = 'critical'),
      'warning', count(*) filter (where sev in ('high', 'warning', 'medium')),
      'info', count(*) filter (where sev is null or sev not in ('critical', 'high', 'warning', 'medium')))
    from (
      select severity sev from server_alerts where coalesce(is_resolved, false) = false and resolved_at is null
      union all select severity from security_alerts
        where resolved_at is null and coalesce(status, '') not in ('resolved', 'closed', 'dismissed')
      union all select severity from finance_alerts where status not in ('resolved', 'actioned')
      union all select severity from legal_alerts where coalesce(status, '') not in ('resolved', 'dismissed', 'closed')
      union all select severity from marketing_alerts where resolved_at is null and not coalesce(is_seed, false)
      union all select severity from seo_alerts where not coalesce(acknowledged, false)
      union all select severity from lead_alerts where is_active
    ) a));

  return result || jsonb_build_object('computed_at', now());
end;
$$;

revoke all on function public.control_panel_cockpit() from public, anon, authenticated;
grant execute on function public.control_panel_cockpit() to service_role;

comment on function public.control_panel_cockpit() is
  'Every figure on the Control Panel cockpit, counted from the tables the Managers read. Service role only.';
