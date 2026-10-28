import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";
import { DOMAINS, type DomainHealth } from "@/lib/founder/state.types";
import type {
  ActivityEvent,
  AIDecisionRecord,
  AIObservation,
  EcosystemMetrics,
  MetricSources,
} from "./types";

export type Degraded = string[];
type SqlParameter = string | number | boolean | Date | null;
type SqlRow = Record<string, unknown>;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function rows<T extends SqlRow>(statement: string, parameters: SqlParameter[] = []): Promise<T[]> {
  return withVpsPublicDatabase((tx) => tx.unsafe<T[]>(statement, parameters));
}

async function safe<T>(label: string, degraded: Degraded, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ai-ceo] ${label} unavailable: ${message}`);
    degraded.push(label);
    return fallback;
  }
}

const COUNT_SQL = {
  marketplace_events: "select count(*)::int as count from public.marketplace_events where created_at >= $1::timestamptz",
  usage_events: "select count(*)::int as count from public.usage_events where occurred_at >= $1::timestamptz",
  marketplace_orders: "select count(*)::int as count from public.marketplace_orders where created_at >= $1::timestamptz",
} as const;

async function countSince(table: keyof typeof COUNT_SQL, since: Date): Promise<number> {
  const [row] = await rows<{ count: number | string }>(COUNT_SQL[table], [since]);
  return Number(row?.count ?? 0);
}

function number(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export const METRIC_SOURCES: MetricSources = {
  systemActivityRate: "VPS marketplace_events + usage_events, last 24 hours",
  deploymentFrequency: "no deployment record exists in the VPS database yet",
  errorVelocity: "VPS api_request_logs with a 5xx status, last hour",
  activeUsers: "VPS profiles",
  transactionsToday: "VPS marketplace_orders since midnight UTC",
  apiLatency: "median latency_ms across the last 200 VPS api_request_logs",
};

export async function computeMetrics(degraded: Degraded): Promise<EcosystemMetrics> {
  const now = Date.now();
  const since24h = new Date(now - DAY);
  const sinceHour = new Date(now - HOUR);
  const midnight = new Date(now);
  midnight.setUTCHours(0, 0, 0, 0);

  const [activity, errors, users, transactions, latency] = await Promise.all([
    safe("marketplace_events", degraded, async () => {
      const events = await countSince("marketplace_events", since24h);
      const usage = await safe("usage_events", degraded, () => countSince("usage_events", since24h), 0);
      return events + usage;
    }, null as number | null),
    safe("api_request_logs", degraded, async () => {
      const [row] = await rows<{ count: number | string }>(
        "select count(*)::int as count from public.api_request_logs where occurred_at >= $1::timestamptz and status_code >= 500",
        [sinceHour],
      );
      return number(row?.count);
    }, null as number | null),
    safe("profiles", degraded, async () => {
      const [row] = await rows<{ count: number | string }>("select count(*)::int as count from public.profiles");
      return number(row?.count);
    }, null as number | null),
    safe("marketplace_orders", degraded, () => countSince("marketplace_orders", midnight), null as number | null),
    safe("api_request_logs.latency", degraded, async () => {
      const [row] = await rows<{ median: number | string | null }>(
        `select percentile_cont(0.5) within group (order by latency_ms) as median
         from (select latency_ms from public.api_request_logs
               where occurred_at >= $1::timestamptz and latency_ms is not null
               order by occurred_at desc limit 200) recent`,
        [since24h],
      );
      return row?.median == null ? null : Math.round(number(row.median));
    }, null as number | null),
  ]);

  return {
    systemActivityRate: activity,
    deploymentFrequency: null,
    errorVelocity: errors,
    activeUsers: users,
    transactionsToday: transactions,
    apiLatency: latency,
  };
}

export async function computeObservations(degraded: Degraded): Promise<AIObservation[]> {
  const out: AIObservation[] = [];
  const since7d = new Date(Date.now() - 7 * DAY);

  await safe("audit_logs", degraded, async () => {
    const data = await rows<{
      id: string; occurred_at: string; actor: string | null; action: string;
      entity_type: string; entity_id: string | null; severity: string | null;
    }>(
      `select id, occurred_at, actor, action, entity_type, entity_id, severity
       from public.audit_logs where occurred_at >= $1::timestamptz
       order by occurred_at desc limit 4`,
      [since7d],
    );
    for (const r of data) {
      out.push({
        id: `audit-${r.id}`,
        category: "change",
        title: r.action.replace(/[._]/g, " "),
        detail: `${r.actor ?? "System"} on ${r.entity_type}${r.entity_id ? ` · ${r.entity_id}` : ""}`,
        severity: r.severity === "critical" ? "critical" : r.severity === "warning" ? "warning" : "info",
        timestamp: relativeTime(r.occurred_at),
      });
    }
    return null;
  }, null);

  await safe("marketplace_products", degraded, async () => {
    const [row] = await rows<{ count: number | string }>(
      "select count(*)::int as count from public.marketplace_products where created_at >= $1::timestamptz",
      [since7d],
    );
    const count = number(row?.count);
    if (count > 0) {
      out.push({
        id: "obs-products-7d",
        category: "change",
        title: `${count} products added this week`,
        detail: "New listings recorded in the VPS marketplace catalogue in the last seven days.",
        severity: "info",
        timestamp: "last 7 days",
      });
    }
    return null;
  }, null);

  await safe("support_tickets", degraded, async () => {
    const [summary] = await rows<{
      open: number | string; breached: number | string; critical: number | string; latest: string | null;
    }>(
      `select count(*) filter (where status not in ('resolved','closed'))::int as open,
              count(*) filter (where status not in ('resolved','closed') and sla_breached)::int as breached,
              count(*) filter (where status not in ('resolved','closed') and priority = 'critical')::int as critical,
              max(created_at)::text as latest
       from public.support_tickets`,
    );
    const open = number(summary?.open);
    const breached = number(summary?.breached);
    const critical = number(summary?.critical);
    if (open > 0) {
      out.push({
        id: "obs-tickets-open",
        category: "attention",
        title: `${open} support ticket${open === 1 ? "" : "s"} still open`,
        detail: `${critical} critical, ${breached} past SLA.`,
        severity: breached ? "critical" : critical ? "warning" : "info",
        timestamp: relativeTime(summary?.latest),
      });
    }
    return null;
  }, null);

  await safe("api_request_logs.failures", degraded, async () => {
    const data = await rows<{
      id: string; path: string; status_code: number; error_message: string | null; occurred_at: string;
    }>(
      `select id, path, status_code, error_message, occurred_at from public.api_request_logs
       where status_code >= 500 and occurred_at >= $1::timestamptz
       order by occurred_at desc limit 3`,
      [since7d],
    );
    for (const r of data) {
      let host = r.path;
      try { host = new URL(r.path).host; } catch { /* The path is not a full URL. */ }
      out.push({
        id: `err-${r.id}`,
        category: "attention",
        title: `Upstream ${r.status_code} from ${host}`,
        detail: r.error_message ?? "No error message was recorded for this call.",
        severity: "warning",
        timestamp: relativeTime(r.occurred_at),
      });
    }
    return null;
  }, null);

  await safe("marketplace_orders.recent", degraded, async () => {
    const data = await rows<{
      id: string; total: number | string; currency: string | null; status: string; created_at: string;
    }>(
      `select id, total, currency, status, created_at from public.marketplace_orders
       where created_at >= $1::timestamptz order by created_at desc limit 3`,
      [since7d],
    );
    for (const r of data) {
      out.push({
        id: `order-${r.id}`,
        category: "revenue",
        title: `Order ${r.status} — ${r.currency ?? "USD"} ${number(r.total).toLocaleString()}`,
        detail: `Marketplace order ${r.id.slice(0, 8)} recorded as ${r.status}.`,
        severity: r.status === "paid" ? "info" : "warning",
        timestamp: relativeTime(r.created_at),
      });
    }
    return null;
  }, null);

  await safe("leads.high_value", degraded, async () => {
    const data = await rows<{
      id: string; name: string; company: string | null; deal_value: number | string | null;
      ai_score: number | null; status: string; created_at: string;
    }>(
      `select id, name, company, deal_value, ai_score, status::text as status, created_at
       from public.leads where deal_value > 0 and status::text not in ('won','lost','spam')
       order by deal_value desc limit 2`,
    );
    for (const r of data) {
      out.push({
        id: `lead-${r.id}`,
        category: "revenue",
        title: `Highest open deal: ${number(r.deal_value).toLocaleString()}`,
        detail: `${r.company ?? r.name} · lead score ${number(r.ai_score)} · ${r.status}`,
        severity: "info",
        timestamp: relativeTime(r.created_at),
      });
    }
    return null;
  }, null);

  return out;
}

export async function computeActivity(degraded: Degraded): Promise<ActivityEvent[]> {
  const out: ActivityEvent[] = [];
  const since48h = new Date(Date.now() - 2 * DAY);

  await safe("marketplace_orders.feed", degraded, async () => {
    const data = await rows<{
      id: string; total: number | string; currency: string | null; status: string; created_at: string;
    }>(
      `select id, total, currency, status, created_at from public.marketplace_orders
       where created_at >= $1::timestamptz order by created_at desc limit 8`,
      [since48h],
    );
    for (const r of data) {
      out.push({ id: `ord-${r.id}`, type: "revenue", actor: "Marketplace", action: `Order ${r.status}`,
        target: `${r.currency ?? "USD"} ${number(r.total).toLocaleString()}`, occurredAt: r.created_at,
        timestamp: relativeTime(r.created_at), impact: r.status === "paid" ? "positive" : r.status === "refunded" ? "negative" : "neutral" });
    }
    return null;
  }, null);

  await safe("audit_logs.feed", degraded, async () => {
    const data = await rows<{
      actor: string; action: string; entity_type: string; severity: string | null;
      event_count: number | string; latest_at: string; has_critical: string;
    }>(
      `select coalesce(actor, 'System') as actor,
              lower(regexp_replace(action, '[._]+', ' ', 'g')) as action,
              entity_type, bool_or(severity = 'critical')::text as has_critical,
              count(*)::int as event_count, max(occurred_at)::text as latest_at
       from public.audit_logs where occurred_at >= $1::timestamptz
       group by coalesce(actor, 'System'), lower(regexp_replace(action, '[._]+', ' ', 'g')), entity_type
       order by max(occurred_at) desc limit 8`,
      [since48h],
    );
    for (const r of data) {
      const action = number(r.event_count) > 1 ? `${number(r.event_count)}x ${r.action}` : r.action;
      const isSecurity = /key|auth|login|permission|role|token/i.test(r.action);
      const isCompliance = /policy|terms|consent|gdpr|audit/i.test(r.action);
      out.push({
        id: `aud-${r.actor}-${r.entity_type}-${r.action}`,
        type: isSecurity ? "security" : isCompliance ? "compliance" : "operations",
        actor: r.actor, action, target: r.entity_type, occurredAt: r.latest_at,
        timestamp: relativeTime(r.latest_at), impact: r.has_critical === "true" ? "negative" : "neutral",
      });
    }
    return null;
  }, null);

  await safe("support_tickets.feed", degraded, async () => {
    const data = await rows<{
      id: string; reference: string; subject: string; priority: string; status: string;
      sla_breached: boolean; customer_name: string | null; created_at: string;
    }>(
      `select id, coalesce(reference, id::text) as reference, subject, priority, status, sla_breached, customer_name, created_at
       from public.support_tickets where created_at >= $1::timestamptz
       order by created_at desc limit 6`,
      [since48h],
    );
    for (const r of data) {
      out.push({ id: `tkt-${r.id}`, type: "risk", actor: r.customer_name ?? "Customer",
        action: `${r.reference} ${r.status.replace(/_/g, " ")}`, target: r.subject,
        occurredAt: r.created_at, timestamp: relativeTime(r.created_at),
        impact: r.sla_breached || r.priority === "critical" ? "negative" : r.status === "resolved" ? "positive" : "neutral" });
    }
    return null;
  }, null);

  await safe("leads.feed", degraded, async () => {
    const data = await rows<{
      id: string; name: string; company: string | null; status: string; source: string | null; created_at: string;
    }>(
      `select id, name, company, status::text as status, source::text as source, created_at
       from public.leads where created_at >= $1::timestamptz
       order by created_at desc limit 6`,
      [since48h],
    );
    for (const r of data) {
      out.push({ id: `led-${r.id}`, type: "revenue", actor: (r.source ?? "lead").replace(/_/g, " "),
        action: `Lead ${r.status.replace(/_/g, " ")}`, target: r.company ?? r.name,
        occurredAt: r.created_at, timestamp: relativeTime(r.created_at),
        impact: /won|qualified|converted/i.test(r.status) ? "positive" : /lost|rejected/i.test(r.status) ? "negative" : "neutral" });
    }
    return null;
  }, null);

  await safe("ai_agent_runs.feed", degraded, async () => {
    const data = await rows<{
      agent_id: string; agent_name: string; action: string; state: string;
      run_count: number | string; latest_started_at: string;
    }>(
      `select a.id as agent_id, a.name as agent_name, r.action, r.state,
              count(*)::int as run_count, max(r.started_at)::text as latest_started_at
       from public.ai_agent_runs r join public.ai_agents a on a.id = r.agent_id
       where r.started_at >= $1::timestamptz and r.started_at <= statement_timestamp()
       group by a.id, a.name, r.action, r.state order by max(r.started_at) desc limit 40`,
      [since48h],
    );
    for (const r of data) {
      const state = r.state.toUpperCase();
      out.push({ id: `agent-run-${r.agent_id}-${r.action}-${state}`, type: "operations",
        actor: r.agent_name, action: r.action,
        target: `${state} · ${number(r.run_count)} runs`, occurredAt: r.latest_started_at,
        timestamp: relativeTime(r.latest_started_at), impact: state === "FAILED" ? "negative" : state === "COMPLETED" ? "positive" : "neutral" });
    }
    return null;
  }, null);

  return out.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 40);
}

export async function computeDomainHealth(degraded: Degraded): Promise<DomainHealth[]> {
  return safe("company_domain_operational_sources", degraded, async () => {
    const data = await rows<{
      domain: string; open_items: number | string; critical_items: number | string;
      source_tables: string;
    }>(`select * from (select 'EXECUTIVE'::text domain,
        ((select count(*) from public.founder_attention where status in ('NEW','ACKNOWLEDGED','IN_PROGRESS')) +
         (select count(*) from public.founder_decisions where state in ('WAITING_APPROVAL','ESCALATED')))::int open_items,
        ((select count(*) from public.founder_attention where status in ('NEW','ACKNOWLEDGED','IN_PROGRESS') and severity = 'CRITICAL') +
         (select count(*) from public.founder_decisions where state = 'ESCALATED'))::int critical_items,
        'founder_attention, founder_decisions'::text source_tables
      union all select 'SALES_OPERATIONS',
        count(*) filter (where status::text not in ('won','lost','spam') and is_duplicate is not true)::int,
        count(*) filter (where status::text not in ('won','lost','spam') and is_duplicate is not true and priority::text = 'critical')::int,
        'leads' from public.leads
      union all select 'CUSTOMER_OPERATIONS',
        count(*) filter (where status not in ('resolved','closed'))::int,
        count(*) filter (where status not in ('resolved','closed') and priority in ('critical','high'))::int,
        'support_tickets' from public.support_tickets
      union all select 'PRODUCT_OPERATIONS',
        count(*) filter (where moderation_status in ('submitted','in_review','pending') or content_status in ('blocked','rejected'))::int,
        count(*) filter (where content_status in ('blocked','rejected'))::int,
        'marketplace_products' from public.marketplace_products where deleted_at is null
      union all select 'MARKETPLACE_OPERATIONS',
        count(*) filter (where status not in ('paid','refunded','cancelled','completed'))::int,
        count(*) filter (where status in ('failed','disputed'))::int,
        'marketplace_orders' from public.marketplace_orders where soft_delete_flag is not true
      union all select 'FINANCE_OPERATIONS',
        ((select count(*) from public.payments where deleted_at is null and (status = 'pending' or mismatch_flag)) +
         (select count(*) from public.finance_approvals where lower(status) in ('pending','requested','awaiting','failed')))::int,
        ((select count(*) from public.payments where deleted_at is null and mismatch_flag) +
         (select count(*) from public.finance_approvals where lower(status) = 'failed'))::int,
        'payments, finance_approvals'
      union all select 'MARKETING_OPERATIONS',
        count(*) filter (where lower(status) in ('pending','needs_review','failed','rejected'))::int,
        count(*) filter (where lower(status) in ('failed','rejected'))::int,
        'marketing_campaigns' from public.marketing_campaigns
      union all select 'SUPPORT_OPERATIONS',
        count(*) filter (where status::text not in ('resolved','closed'))::int,
        count(*) filter (where status::text not in ('resolved','closed') and priority::text in ('critical','high'))::int,
        'reseller_support_tickets' from public.reseller_support_tickets
      union all select 'SECURITY_RISK_OPERATIONS',
        count(*) filter (where lower(status) not in ('resolved','closed','dismissed'))::int,
        count(*) filter (where lower(status) not in ('resolved','closed','dismissed') and lower(severity) in ('critical','high'))::int,
        'security_alerts' from public.security_alerts
      union all select 'PEOPLE_OPERATIONS',
        count(*) filter (where status in ('blocked','on_hold') or severity in ('critical','high') or (deadline < now() and deadline is not null and status not in ('completed','approved','closed','cancelled')))::int,
        count(*) filter (where severity in ('critical','high') or status = 'blocked' or (deadline < now() and deadline is not null and status not in ('completed','approved','closed','cancelled')))::int,
        'tm_tasks' from public.tm_tasks
      union all select 'VENDOR_PARTNER_OPERATIONS',
        ((select count(*) from public.marketplace_sellers where lower(status) in ('pending','in_review','submitted')) +
         (select count(*) from public.affiliate_applications where lower(status) in ('pending','in_review','submitted') or risk_score >= 80) +
         (select count(*) from public.franchise_applications where lower(status) in ('pending','in_review','submitted') or lower(kyc_status) in ('failed','rejected')))::int,
        ((select count(*) from public.affiliate_applications where risk_score >= 80) +
         (select count(*) from public.franchise_applications where lower(kyc_status) in ('failed','rejected')))::int,
        'marketplace_sellers, affiliate_applications, franchise_applications'
      union all select 'RESEARCH_STRATEGY',
        count(*) filter (where lower(status) not in ('resolved','closed','accepted'))::int,
        count(*) filter (where lower(status) not in ('resolved','closed','accepted') and severity::text in ('CRITICAL','HIGH'))::int,
        'founder_risks' from public.founder_risks
    ) domain_counts order by domain`);

    return data.map((row) => {
      const openAttention = number(row.open_items);
      const criticalAttention = number(row.critical_items);
      const health: DomainHealth["health"] = criticalAttention > 0 ? "CRITICAL" : openAttention > 0 ? "WATCH" : "HEALTHY";
      const domain = DOMAINS.find((candidate) => candidate === row.domain);
      if (!domain) throw new Error(`Unknown company domain returned by the VPS query: ${row.domain}`);
      return {
        domain,
        health,
        reason: `${openAttention} open item${openAttention === 1 ? "" : "s"}; ${criticalAttention} high/critical. Source: ${row.source_tables}.`,
        openAttention,
        criticalAttention,
        kpisAtRisk: 0,
      };
    });
  }, []);
}

export async function loadDecisions(degraded: Degraded): Promise<AIDecisionRecord[]> {
  return safe("ai_decision_logs", degraded, async () => {
    const data = await rows<{
      id: string; occurred_at: string; decision: string; confidence: number | string;
      input_summary: string | null; output_summary: string | null; outcome: string;
      tokens: number | null; cost_usd: number | string | null;
      agent_name: string | null; model_name: string | null;
    }>(
      `select d.id, d.occurred_at, d.decision, d.confidence, d.input_summary,
              d.output_summary, d.outcome, d.tokens, d.cost_usd,
              a.name as agent_name, m.name as model_name
       from public.ai_decision_logs d
       left join public.ai_agents a on a.id = d.agent_id
       left join public.ai_models m on m.id = d.model_id
       order by d.occurred_at desc limit 60`,
    );
    return data.map((r) => ({
      id: r.id,
      occurredAt: r.occurred_at,
      decision: r.decision,
      confidence: number(r.confidence),
      inputSummary: r.input_summary,
      outputSummary: r.output_summary,
      outcome: r.outcome,
      tokens: number(r.tokens),
      costUsd: number(r.cost_usd),
      agentName: r.agent_name,
      modelName: r.model_name,
    }));
  }, []);
}
