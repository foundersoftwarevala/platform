import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  failIncludes: "",
  calls: [] as { statement: string; parameters: unknown[] }[],
  responses: [] as { includes: string; rows: Record<string, unknown>[] }[],
}));
type TestTransaction = {
  unsafe: <T extends unknown[]>(statement: string, parameters?: unknown[]) => Promise<T>;
};
vi.mock("@/lib/marketplace-manager/vps-rpc.server", () => ({
  withVpsPublicDatabase: async <T>(run: (tx: TestTransaction) => Promise<T>) => {
    const tx: TestTransaction = {
      unsafe: async <Rows extends unknown[]>(statement: string, parameters: unknown[] = []) => {
        state.calls.push({ statement, parameters });
        if (state.failIncludes && statement.includes(state.failIncludes)) {
          throw new Error("Fixture VPS query failed");
        }
        const response = state.responses.find((entry) => statement.includes(entry.includes));
        return (response?.rows ?? []) as Rows;
      },
    };
    return run(tx);
  },
}));
import { computeActivity, computeDomainHealth, computeMetrics } from "./signals.server";

beforeEach(() => {
  state.failIncludes = "";
  state.calls = [];
  state.responses = [];
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("AI CEO VPS-backed signals", () => {
  it("counts metrics directly in Postgres with real rolling windows", async () => {
    state.responses = [
      { includes: "public.marketplace_events", rows: [{ count: 3 }] },
      { includes: "public.usage_events", rows: [{ count: 4 }] },
      { includes: "status_code >= 500", rows: [{ count: 2 }] },
      { includes: "from public.profiles", rows: [{ count: 12 }] },
      { includes: "public.marketplace_orders", rows: [{ count: 5 }] },
      { includes: "percentile_cont", rows: [{ median: 20 }] },
    ];
    const degraded: string[] = [];
    expect(await computeMetrics(degraded)).toEqual({
      systemActivityRate: 7,
      deploymentFrequency: null,
      errorVelocity: 2,
      activeUsers: 12,
      transactionsToday: 5,
      apiLatency: 20,
    });
    expect(degraded).toEqual([]);
    expect(state.calls).toHaveLength(6);
    expect(state.calls.every((call) => call.statement.includes("public."))).toBe(true);
    expect(state.calls.find((call) => call.statement.includes("public.usage_events"))?.parameters[0]).toEqual(
      new Date("2026-10-27T12:00:00.000Z"),
    );
    expect(state.calls.some((call) => call.statement.includes("/rest/v1"))).toBe(false);
  });

  it("keeps independent metrics and reports source failures instead of zero", async () => {
    state.responses = [
      { includes: "public.marketplace_events", rows: [{ count: 3 }] },
      { includes: "from public.profiles", rows: [{ count: 12 }] },
      { includes: "public.marketplace_orders", rows: [{ count: 5 }] },
      { includes: "status_code >= 500", rows: [{ count: 2 }] },
      { includes: "percentile_cont", rows: [{ median: 20 }] },
    ];
    state.failIncludes = "public.usage_events";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const degraded: string[] = [];
    const result = await computeMetrics(degraded);
    expect(result.systemActivityRate).toBe(3);
    expect(result.activeUsers).toBe(12);
    expect(degraded).toEqual(["usage_events"]);
    expect(log).toHaveBeenCalledWith("[ai-ceo] usage_events unavailable: Fixture VPS query failed");
  });

  it("groups repeated audit events and sorts all sources by actual timestamp", async () => {
    state.responses = [
      { includes: "from public.marketplace_orders", rows: [{ id: "order", total: 10, currency: "USD", status: "paid", created_at: "2026-10-28T09:00:00Z" }] },
      { includes: "lower(regexp_replace(action", rows: [{ actor: "AYRA", action: "ayra inspection", entity_type: "agent", has_critical: "false", event_count: 8, latest_at: "2026-10-28T11:00:00Z" }] },
      { includes: "from public.support_tickets where created_at", rows: [{ id: "ticket", reference: "T-1", subject: "Help", priority: "normal", status: "open", sla_breached: false, customer_name: "Customer", created_at: "2026-10-28T08:00:00Z" }] },
      { includes: "from public.leads where created_at", rows: [{ id: "lead", name: "Lead", company: null, status: "new", source: "web", created_at: "2026-10-28T10:00:00Z" }] },
      { includes: "from public.ai_agent_runs", rows: [{ agent_id: "agent-1", agent_name: "Worker One", action: "scan", state: "COMPLETED", run_count: 12, latest_started_at: "2026-10-28T11:30:00Z" }] },
    ];
    const degraded: string[] = [];
    const events = await computeActivity(degraded);
    expect(degraded).toEqual([]);
    expect(events.map((event) => event.occurredAt)).toEqual([
      "2026-10-28T11:30:00Z",
      "2026-10-28T11:00:00Z",
      "2026-10-28T10:00:00Z",
      "2026-10-28T09:00:00Z",
      "2026-10-28T08:00:00Z",
    ]);
    expect(events[1]?.action).toBe("8x ayra inspection");
    expect(state.calls.filter((call) => call.statement.includes("public.audit_logs"))[0]?.parameters[0]).toEqual(
      new Date("2026-10-27T12:00:00.000Z"),
    );
  });

  it("maps company domains to live VPS source tables and computes open/critical counts", async () => {
    state.responses = [{
      includes: "select * from (select 'EXECUTIVE'",
      rows: [
        { domain: "SALES_OPERATIONS", open_items: 314, critical_items: 20, source_tables: "leads" },
        { domain: "SUPPORT_OPERATIONS", open_items: 2, critical_items: 1, source_tables: "reseller_support_tickets" },
        { domain: "EXECUTIVE", open_items: 0, critical_items: 0, source_tables: "founder_attention, founder_decisions" },
      ],
    }];
    const degraded: string[] = [];
    const health = await computeDomainHealth(degraded);
    expect(health).toEqual([
      { domain: "SALES_OPERATIONS", health: "CRITICAL", reason: "314 open items; 20 high/critical. Source: leads.", openAttention: 314, criticalAttention: 20, kpisAtRisk: 0 },
      { domain: "SUPPORT_OPERATIONS", health: "CRITICAL", reason: "2 open items; 1 high/critical. Source: reseller_support_tickets.", openAttention: 2, criticalAttention: 1, kpisAtRisk: 0 },
      { domain: "EXECUTIVE", health: "HEALTHY", reason: "0 open items; 0 high/critical. Source: founder_attention, founder_decisions.", openAttention: 0, criticalAttention: 0, kpisAtRisk: 0 },
    ]);
    expect(degraded).toEqual([]);
  });
});
