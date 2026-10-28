import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";

const state = vi.hoisted(() => ({
  fail: "",
  requests: [] as { url: URL; method: string; prefer: string | null }[],
  activityRows: {} as Record<string, unknown[]>,
  agentActivityRows: [] as Record<string, unknown>[],
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: createClient<Database>("https://metrics-fixture.invalid", "fixture-only", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        const table = url.pathname.split("/").at(-1) ?? "";
        state.requests.push({ url, method: request.method, prefer: request.headers.get("prefer") });
        if (table === state.fail) {
          return Response.json(
            { message: "Fixture metrics refused", code: "42501" },
            { status: 403 },
          );
        }
        if (request.method === "HEAD") {
          const counts: Record<string, number> = {
            marketplace_events: 3,
            usage_events: 4,
            profiles: 12,
            marketplace_orders: 5,
            api_request_logs: 2,
          };
          if (!(table in counts)) throw new Error(`Unexpected metric relation: ${table}`);
          return new Response(null, { headers: { "content-range": `0-0/${counts[table]}` } });
        }
        if (table === "api_request_logs") {
          return Response.json([15, 5, 25, 35].map((latency_ms) => ({ latency_ms })));
        }
        if (table === "ai_agent_activity_24h") {
          return Response.json(state.agentActivityRows);
        }
        if (["marketplace_orders", "audit_logs", "support_tickets", "leads"].includes(table)) {
          return Response.json(state.activityRows[table] ?? []);
        }
        throw new Error(`Unexpected metric request: ${request.method} ${table}`);
      },
    },
  }),
}));
import { computeActivity, computeMetrics } from "./signals.server";

beforeEach(() => {
  state.fail = "";
  state.requests = [];
  state.activityRows = {};
  state.agentActivityRows = [];
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("AI CEO typed metric sources", () => {
  it("preserves exact counts, timestamp columns, UTC windows and median latency", async () => {
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
    const heads = state.requests.filter((request) => request.method === "HEAD");
    expect(heads).toHaveLength(5);
    expect(heads.every((request) => request.prefer?.includes("count=exact"))).toBe(true);
    const query = (table: string) =>
      heads.find((request) => request.url.pathname.endsWith(`/${table}`))?.url.searchParams;
    expect(query("marketplace_events")?.get("created_at")).toBe("gte.2026-10-14T12:00:00.000Z");
    expect(query("usage_events")?.get("occurred_at")).toBe("gte.2026-10-14T12:00:00.000Z");
    expect(query("usage_events")?.has("created_at")).toBe(false);
    expect(query("marketplace_orders")?.get("created_at")).toBe("gte.2026-10-15T00:00:00.000Z");
    expect(query("api_request_logs")?.get("status_code")).toBe("gte.500");
  });

  it("retains explicit degradation when the usage source fails", async () => {
    state.fail = "usage_events";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const degraded: string[] = [];
    expect((await computeMetrics(degraded)).systemActivityRate).toBe(3);
    expect(degraded).toEqual(["usage_events"]);
    expect(log).toHaveBeenCalledWith("[ai-ceo] usage_events unavailable: Fixture metrics refused");
  });

  it("does not report a failed profile count as zero", async () => {
    state.fail = "profiles";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const degraded: string[] = [];
    expect((await computeMetrics(degraded)).activeUsers).toBeNull();
    expect(degraded).toEqual(["profiles"]);
    expect(log).toHaveBeenCalledWith("[ai-ceo] profiles unavailable: Fixture metrics refused");
  });
});

describe("AI CEO activity feed ordering", () => {
  it("sorts events across sources newest-first and retains raw timestamps", async () => {
    state.activityRows = {
      marketplace_orders: [
        {
          id: "order",
          total: 10,
          currency: "USD",
          status: "paid",
          created_at: "2026-10-15T09:00:00Z",
        },
      ],
      audit_logs: [
        {
          id: "audit",
          occurred_at: "2026-10-15T11:00:00Z",
          actor: "Admin",
          action: "updated",
          entity_type: "role",
          entity_id: "r1",
          severity: "info",
        },
      ],
      support_tickets: [
        {
          id: "ticket",
          reference: "T-1",
          subject: "Help",
          priority: "normal",
          status: "open",
          sla_breached: false,
          customer_name: "Customer",
          created_at: "2026-10-15T08:00:00Z",
        },
      ],
      leads: [
        {
          id: "lead",
          name: "Lead",
          company: null,
          status: "new",
          deal_value: 100,
          source: "web",
          created_at: "2026-10-15T10:00:00Z",
        },
      ],
    };

    const events = await computeActivity([]);

    expect(events.map((event) => event.id)).toEqual([
      "aud-audit",
      "led-lead",
      "ord-order",
      "tkt-ticket",
    ]);
    expect(events.map((event) => event.occurredAt)).toEqual([
      "2026-10-15T11:00:00Z",
      "2026-10-15T10:00:00Z",
      "2026-10-15T09:00:00Z",
      "2026-10-15T08:00:00Z",
    ]);
  });

  describe("AI CEO worker-run activity", () => {
    it("adds grouped agent run counts from the fixed-horizon RPC", async () => {
      state.agentActivityRows = [
        {
          agent_id: "agent-1",
          agent_name: "Worker One",
          action: "scan",
          state: "COMPLETED",
          run_count: 12,
          latest_started_at: "2026-10-15T11:30:00Z",
        },
        {
          agent_id: "agent-2",
          agent_name: "Worker Two",
          action: "sync",
          state: "FAILED",
          run_count: 3,
          latest_started_at: "2026-10-15T11:00:00Z",
        },
      ];

      const degraded: string[] = [];
      const events = await computeActivity(degraded);

      expect(degraded).toEqual([]);
      expect(
        events.map(({ actor, action, target, impact }) => ({
          actor,
          action,
          target,
          impact,
        })),
      ).toEqual([
        { actor: "Worker One", action: "scan", target: "COMPLETED · 12 runs", impact: "positive" },
        { actor: "Worker Two", action: "sync", target: "FAILED · 3 runs", impact: "negative" },
      ]);
      expect(
        state.requests.some(
          ({ url, method }) =>
            url.pathname.endsWith("/rpc/ai_agent_activity_24h") && method === "POST",
        ),
      ).toBe(true);
    });

    it("marks the worker-run source degraded when its RPC fails", async () => {
      state.fail = "ai_agent_activity_24h";
      vi.spyOn(console, "error").mockImplementation(() => {});
      const degraded: string[] = [];

      const events = await computeActivity(degraded);

      expect(events).toEqual([]);
      expect(degraded).toContain("ai_agent_runs.feed");
    });
  });
});
