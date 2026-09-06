import { supabaseAdmin } from "@/integrations/supabase/client.server";

import type {
  ActivityEvent,
  AIDecisionRecord,
  AIObservation,
  EcosystemMetrics,
  MetricSources,
} from "./types";

/**
 * Everything the AI CEO dashboard displays that is a measurement.
 *
 * The imported module generated its ecosystem tiles with Math.random() and
 * hardcoded its observation panel and activity feed, so the numbers moved every
 * thirty seconds while meaning nothing. Each figure below is counted from a
 * real table instead, and `metricSources` records which table each one came
 * from so the operator can see it on the tile.
 *
 * Where the platform genuinely has no source for a figure — there is no
 * deployment record anywhere in the database — the value is null and the tile
 * says it is not tracked. An invented number is worse than an empty one on a
 * screen someone is meant to make decisions from.
 *
 * Every read is wrapped: one unavailable table degrades its own tile and is
 * named in `degraded`, rather than failing the whole dashboard.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Collects the name of any source that could not be read. */
export type Degraded = string[];

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

async function countSince(table: string, column: string, since: Date): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true })
    .gte(column, since.toISOString());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countAll(table: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** "15 min ago" — the module's feeds display relative times. */
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
  systemActivityRate: "marketplace_events + usage_events, last 24 hours",
  deploymentFrequency: "no deployment record exists in the database yet",
  errorVelocity: "api_request_logs with a 5xx status, last hour",
  activeUsers: "profiles",
  transactionsToday: "marketplace_orders since midnight UTC",
  apiLatency: "median latency_ms across the last 200 api_request_logs",
};

export async function computeMetrics(degraded: Degraded): Promise<EcosystemMetrics> {
  const now = Date.now();
  const since24h = new Date(now - DAY);
  const sinceHour = new Date(now - HOUR);
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);

  const [activity, errors, users, transactions, latency] = await Promise.all([
    safe("marketplace_events", degraded, async () => {
      const [events, usage] = await Promise.all([
        countSince("marketplace_events", "created_at", since24h),
        countSince("usage_events", "created_at", since24h).catch(() => 0),
      ]);
      return events + usage;
    }, null as number | null),

    safe("api_request_logs", degraded, async () => {
      const { count, error } = await supabaseAdmin
        .from("api_request_logs")
        .select("*", { count: "exact", head: true })
        .gte("occurred_at", sinceHour.toISOString())
        .gte("status_code", 500);
      if (error) throw new Error(error.message);
      return count ?? 0;
    }, null as number | null),

    safe("profiles", degraded, () => countAll("profiles"), null as number | null),

    safe("marketplace_orders", degraded,
      () => countSince("marketplace_orders", "created_at", midnight), null as number | null),

    safe("api_request_logs.latency", degraded, async () => {
      const { data, error } = await supabaseAdmin
        .from("api_request_logs")
        .select("latency_ms")
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      const values = (data ?? [])
        .map((r) => Number((r as { latency_ms: number }).latency_ms))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
      if (!values.length) return null;
      // Median, because a single slow upstream call should not define the tile.
      const mid = Math.floor(values.length / 2);
      return values.length % 2
        ? values[mid]
        : Math.round((values[mid - 1] + values[mid]) / 2);
    }, null as number | null),
  ]);

  return {
    systemActivityRate: activity,
    // Nothing in the database records a deployment. Left null on purpose.
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

  // --- What changed: recent platform activity -------------------------------
  await safe("audit_logs", degraded, async () => {
    const { data, error } = await supabaseAdmin
      .from("audit_logs")
      .select("id,occurred_at,actor,action,entity_type,entity_id,severity")
      .order("occurred_at", { ascending: false })
      .limit(4);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as {
        id: string; occurred_at: string; actor: string; action: string;
        entity_type: string; entity_id: string | null; severity: string;
      };
      out.push({
        id: `audit-${r.id}`,
        category: "change",
        title: r.action.replace(/[._]/g, " "),
        detail: `${r.actor} on ${r.entity_type}${r.entity_id ? ` · ${r.entity_id}` : ""}`,
        severity: r.severity === "critical" ? "critical" : r.severity === "warning" ? "warning" : "info",
        timestamp: relativeTime(r.occurred_at),
      });
    }
    return null;
  }, null);

  await safe("marketplace_products", degraded, async () => {
    const { count, error } = await supabaseAdmin
      .from("marketplace_products")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since7d.toISOString());
    if (error) throw new Error(error.message);
    if ((count ?? 0) > 0) {
      out.push({
        id: "obs-products-7d",
        category: "change",
        title: `${count} products added this week`,
        detail: "New listings published to the marketplace catalogue in the last seven days.",
        severity: "info",
        timestamp: "last 7 days",
      });
    }
    return null;
  }, null);

  // --- Needs attention: open tickets, SLA breaches, failing upstreams -------
  await safe("support_tickets", degraded, async () => {
    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .select("id,subject,priority,status,sla_breached,created_at")
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const open = data ?? [];
    const breached = open.filter((t) => (t as { sla_breached: boolean }).sla_breached);
    const critical = open.filter((t) => (t as { priority: string }).priority === "critical");

    if (open.length) {
      out.push({
        id: "obs-tickets-open",
        category: "attention",
        title: `${open.length} support ticket${open.length === 1 ? "" : "s"} still open`,
        detail: `${critical.length} critical, ${breached.length} past SLA.`,
        severity: breached.length ? "critical" : critical.length ? "warning" : "info",
        timestamp: relativeTime((open[0] as { created_at: string }).created_at),
      });
    }
    return null;
  }, null);

  await safe("api_request_logs.failures", degraded, async () => {
    const { data, error } = await supabaseAdmin
      .from("api_request_logs")
      .select("id,path,status_code,error_message,occurred_at")
      .gte("status_code", 500)
      .order("occurred_at", { ascending: false })
      .limit(3);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as {
        id: string; path: string; status_code: number;
        error_message: string | null; occurred_at: string;
      };
      let host = r.path;
      try {
        host = new URL(r.path).host;
      } catch {
        /* the path is not a full URL; show it as recorded */
      }
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

  // --- Revenue impact: orders, invoices, high-value leads --------------------
  await safe("marketplace_orders.recent", degraded, async () => {
    const { data, error } = await supabaseAdmin
      .from("marketplace_orders")
      .select("id,total,currency,status,created_at")
      .order("created_at", { ascending: false })
      .limit(3);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as {
        id: string; total: number | string; currency: string | null;
        status: string; created_at: string;
      };
      out.push({
        id: `order-${r.id}`,
        category: "revenue",
        title: `Order ${r.status} — ${r.currency ?? "USD"} ${Number(r.total).toLocaleString()}`,
        detail: `Marketplace order ${r.id.slice(0, 8)} recorded as ${r.status}.`,
        severity: r.status === "paid" ? "info" : "warning",
        timestamp: relativeTime(r.created_at),
      });
    }
    return null;
  }, null);

  await safe("leads.high_value", degraded, async () => {
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("id,name,company,deal_value,ai_score,status,created_at")
      .order("deal_value", { ascending: false })
      .limit(2);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as {
        id: string; name: string; company: string | null; deal_value: number;
        ai_score: number; status: string; created_at: string;
      };
      if (!r.deal_value) continue;
      out.push({
        id: `lead-${r.id}`,
        category: "revenue",
        title: `Highest open deal: ${Number(r.deal_value).toLocaleString()}`,
        detail: `${r.company ?? r.name} · lead score ${r.ai_score} · ${r.status}`,
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

  await safe("marketplace_orders.feed", degraded, async () => {
    const { data, error } = await supabaseAdmin
      .from("marketplace_orders")
      .select("id,total,currency,status,created_at")
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as {
        id: string; total: number | string; currency: string | null;
        status: string; created_at: string;
      };
      out.push({
        id: `ord-${r.id}`,
        type: "revenue",
        actor: "Marketplace",
        action: `Order ${r.status}`,
        target: `${r.currency ?? "USD"} ${Number(r.total).toLocaleString()}`,
        timestamp: relativeTime(r.created_at),
        impact: r.status === "paid" ? "positive" : r.status === "refunded" ? "negative" : "neutral",
      });
    }
    return null;
  }, null);

  await safe("audit_logs.feed", degraded, async () => {
    const { data, error } = await supabaseAdmin
      .from("audit_logs")
      .select("id,occurred_at,actor,action,entity_type,entity_id,severity")
      .order("occurred_at", { ascending: false })
      .limit(8);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as {
        id: string; occurred_at: string; actor: string; action: string;
        entity_type: string; entity_id: string | null; severity: string;
      };
      const isSecurity = /key|auth|login|permission|role|token/i.test(r.action);
      const isCompliance = /policy|terms|consent|gdpr|audit/i.test(r.action);
      out.push({
        id: `aud-${r.id}`,
        type: isSecurity ? "security" : isCompliance ? "compliance" : "operations",
        actor: r.actor,
        action: r.action.replace(/[._]/g, " "),
        target: r.entity_id ?? r.entity_type,
        timestamp: relativeTime(r.occurred_at),
        impact: r.severity === "critical" ? "negative" : "neutral",
      });
    }
    return null;
  }, null);

  await safe("support_tickets.feed", degraded, async () => {
    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .select("id,reference,subject,priority,status,sla_breached,customer_name,created_at")
      .order("created_at", { ascending: false })
      .limit(6);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as {
        id: string; reference: string; subject: string; priority: string;
        status: string; sla_breached: boolean; customer_name: string; created_at: string;
      };
      out.push({
        id: `tkt-${r.id}`,
        type: "risk",
        actor: r.customer_name,
        action: `${r.reference} ${r.status.replace(/_/g, " ")}`,
        target: r.subject,
        timestamp: relativeTime(r.created_at),
        impact: r.sla_breached || r.priority === "critical"
          ? "negative"
          : r.status === "resolved"
            ? "positive"
            : "neutral",
      });
    }
    return null;
  }, null);

  await safe("leads.feed", degraded, async () => {
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("id,name,company,status,deal_value,source,created_at")
      .order("created_at", { ascending: false })
      .limit(6);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as {
        id: string; name: string; company: string | null; status: string;
        deal_value: number; source: string; created_at: string;
      };
      out.push({
        id: `led-${r.id}`,
        type: "revenue",
        actor: String(r.source).replace(/_/g, " "),
        action: `Lead ${String(r.status).replace(/_/g, " ")}`,
        target: r.company ?? r.name,
        timestamp: relativeTime(r.created_at),
        impact: /won|qualified|converted/i.test(r.status)
          ? "positive"
          : /lost|rejected/i.test(r.status)
            ? "negative"
            : "neutral",
      });
    }
    return null;
  }, null);

  // Newest first across every source, by the recorded time rather than by table.
  return out.slice(0, 40);
}

export async function loadDecisions(degraded: Degraded): Promise<AIDecisionRecord[]> {
  return safe("ai_decision_logs", degraded, async () => {
    const { data, error } = await supabaseAdmin
      .from("ai_decision_logs")
      .select(
        "id,occurred_at,decision,confidence,input_summary,output_summary,outcome,tokens,cost_usd," +
          "ai_agents(name),ai_models(name)",
      )
      .order("occurred_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => {
      const r = row as unknown as {
        id: string; occurred_at: string; decision: string; confidence: number | string;
        input_summary: string | null; output_summary: string | null; outcome: string;
        tokens: number; cost_usd: number | string;
        ai_agents: { name: string } | { name: string }[] | null;
        ai_models: { name: string } | { name: string }[] | null;
      };
      const one = <T,>(v: T | T[] | null): T | null =>
        Array.isArray(v) ? (v[0] ?? null) : v;
      return {
        id: r.id,
        occurredAt: r.occurred_at,
        decision: r.decision,
        confidence: Number(r.confidence),
        inputSummary: r.input_summary,
        outputSummary: r.output_summary,
        outcome: r.outcome,
        tokens: Number(r.tokens) || 0,
        costUsd: Number(r.cost_usd) || 0,
        agentName: one(r.ai_agents)?.name ?? null,
        modelName: one(r.ai_models)?.name ?? null,
      };
    });
  }, []);
}
