import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database, Tables } from "@/integrations/supabase/types";
import { loadDeliveryOverview } from "../dev-manager.server";

const NOW = "2026-10-16T00:00:00Z";
const TASK = "10000000-0000-4000-8000-000000000001";
const CANONICAL = "20000000-0000-4000-8000-000000000002";
const CALLER = "30000000-0000-4000-8000-000000000003";
type DeliveryTask = Tables<"developer_tasks"> & {
  tm_tasks: Pick<Tables<"tm_tasks">, "quality_score" | "blocked_reason" | "status"> | null;
};
type Event = Pick<Tables<"tm_activity">, "id" | "created_at" | "from_value" | "to_value">;

function task(patch: Partial<DeliveryTask> = {}): DeliveryTask {
  return {
    id: TASK,
    title: "Isolated blocked fixture",
    description: null,
    category: "general",
    requirements: [],
    links: [],
    attachments: [],
    progress_percent: 0,
    progress_note: null,
    priority: "medium",
    status: "blocked",
    developer_id: null,
    assigned_by: null,
    client_id: null,
    deadline: null,
    estimated_hours: null,
    task_amount: null,
    tech_stack: [],
    delivery_notes: null,
    accepted_at: null,
    started_at: null,
    actual_delivery_at: null,
    completed_at: null,
    pause_reason: "Not the blocked reason",
    paused_at: "2026-01-01T00:00:00Z",
    total_paused_minutes: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: NOW,
    tm_task_id: CANONICAL,
    tm_tasks: {
      quality_score: null,
      blocked_reason: "Waiting for approved access",
      status: "blocked",
    },
    ...patch,
  };
}

function event(at: string, from = "in_progress", to = "blocked", id = at): Event {
  return { id, created_at: at, from_value: from, to_value: to };
}

function fixture(tasks = [task()], history: Event[] = []) {
  const escalations: Tables<"developer_task_escalations">[] = [];
  const requests: { url: URL; method: string; body: unknown }[] = [];
  const state = { failure: "", pageCap: 500 };
  const db = createClient<Database>("https://escalation-fixture.invalid", "fixture-only", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        const relation = url.pathname.split("/").at(-1) ?? "";
        const body: unknown = request.method === "GET" ? null : await request.json();
        requests.push({ url, method: request.method, body });
        if (state.failure === relation) {
          return Response.json(
            { message: `Fixture ${relation} refused`, code: "42501" },
            { status: 403 },
          );
        }
        if (request.method === "GET") {
          if (relation === "developers" || relation === "developer_task_internal_notes")
            return Response.json([]);
          if (relation === "developer_tasks") return Response.json(tasks);
          if (relation === "developer_task_escalations") return Response.json(escalations);
          if (relation === "tm_activity") {
            expect(url.searchParams.get("task_id")).toBe(`eq.${CANONICAL}`);
            expect(url.searchParams.get("action_type")).toBe("eq.status");
            expect(url.searchParams.get("order")).toBe("created_at.asc,id.asc");
            const offset = Number(url.searchParams.get("offset") ?? 0);
            const limit = Math.min(Number(url.searchParams.get("limit") ?? 500), state.pageCap);
            return Response.json(history.slice(offset, offset + limit), {
              headers: { "content-range": `${offset}-${offset + limit - 1}/${history.length}` },
            });
          }
        }
        if (request.method === "POST" && relation === "developer_task_escalations") {
          if (!Array.isArray(body)) throw new Error("Expected escalation batch");
          for (const row of body) {
            escalations.push({
              ...row,
              id: `40000000-0000-4000-8000-${String(escalations.length + 1).padStart(12, "0")}`,
              status: "pending",
              created_at: NOW,
              updated_at: NOW,
              resolved_at: null,
              resolution: null,
            });
          }
          return Response.json(escalations.map(({ id, task_id }) => ({ id, task_id })));
        }
        if (request.method === "POST" && relation === "audit_logs")
          return new Response(null, { status: 201 });
        throw new Error(`Unexpected fixture request: ${request.method} ${url.pathname}`);
      },
    },
  });
  return { db, escalations, requests, state };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});
afterEach(() => vi.useRealTimers());

describe("Developer Manager blocked escalation contract", () => {
  it("escalates exactly at 24 verified hours, records caller and audit, and skips an existing open escalation on refresh", async () => {
    const f = fixture(undefined, [event("2026-10-15T00:00:00Z")]);
    const result = await loadDeliveryOverview(f.db, CALLER);
    expect(result.autoEscalated).toBe(1);
    expect(result.blocked[0]).toMatchObject({
      blockedHours: 24,
      blockedSince: "2026-10-15T00:00:00Z",
      blockedReason: "Waiting for approved access",
      autoEscalateThreshold: 24,
      escalated: true,
    });
    expect(f.escalations[0]).toMatchObject({
      task_id: TASK,
      escalated_by: CALLER,
      escalated_to: "AREA-MANAGER",
      auto_escalated: true,
      reason: "Auto: blocked 24h (threshold 24h) — Waiting for approved access",
    });
    const audit = f.requests.find((request) => request.url.pathname.endsWith("/audit_logs"));
    expect(audit?.body).toEqual([
      expect.objectContaining({
        actor: CALLER,
        action: "AUTO_ESCALATE",
        metadata: expect.objectContaining({ task_id: TASK }),
      }),
    ]);
    expect((await loadDeliveryOverview(f.db, CALLER)).autoEscalated).toBe(0);
    expect(f.escalations).toHaveLength(1);
  });

  it("does not escalate one second before the 24-hour threshold", async () => {
    const f = fixture(undefined, [event("2026-10-15T00:00:01Z")]);
    const result = await loadDeliveryOverview(f.db, CALLER);
    expect(result.autoEscalated).toBe(0);
    expect(result.blocked[0].blockedHours).toBe(23);
  });

  it("restarts after unblock/reblock but does not reset for duplicate trigger/service status events", async () => {
    const f = fixture(undefined, [
      event("2026-10-10T00:00:00Z"),
      event("2026-10-10T00:00:01Z"),
      event("2026-10-14T00:00:00Z", "blocked", "in_progress"),
      event("2026-10-15T23:00:00Z"),
      event("2026-10-15T23:00:01Z"),
      event("2026-10-15T23:50:00Z", "blocked", "blocked"),
    ]);
    const result = await loadDeliveryOverview(f.db, CALLER);
    expect(result.blocked[0]).toMatchObject({
      blockedSince: "2026-10-15T23:00:00Z",
      blockedHours: 1,
    });
    expect(result.autoEscalated).toBe(0);
  });

  it("pages the complete status history even when the server applies a smaller row cap", async () => {
    const f = fixture(undefined, [
      event("2026-10-10T00:00:00Z"),
      event("2026-10-14T00:00:00Z", "blocked", "in_progress"),
      event("2026-10-15T23:00:00Z"),
    ]);
    f.state.pageCap = 1;
    expect((await loadDeliveryOverview(f.db, CALLER)).blocked[0].blockedHours).toBe(1);
    expect(
      f.requests.filter((request) => request.url.pathname.endsWith("/tm_activity")),
    ).toHaveLength(3);
  });

  it.each([
    ["unlinked", task({ tm_task_id: null, tm_tasks: null }), []],
    ["legacy missing history", task(), []],
    [
      "canonical status mismatch",
      task({ tm_tasks: { quality_score: null, blocked_reason: null, status: "in_progress" } }),
      [event("2026-10-10T00:00:00Z")],
    ],
    ["future history", task(), [event("2026-10-17T00:00:00Z")]],
    ["invalid history", task(), [event("not-a-timestamp")]],
    [
      "latest transition is not blocked",
      task(),
      [event("2026-10-10T00:00:00Z"), event("2026-10-14T00:00:00Z", "blocked", "in_progress")],
    ],
  ] as const)(
    "keeps %s tasks visible with unknown age and no invented timer",
    async (_name, row, history) => {
      const f = fixture([row], [...history]);
      const result = await loadDeliveryOverview(f.db, CALLER);
      expect(result.blocked).toHaveLength(1);
      expect(result.stats.blocked).toBe(1);
      expect(result.blocked[0]).toMatchObject({
        blockedSince: null,
        blockedHours: null,
        escalated: false,
      });
      expect(result.autoEscalated).toBe(0);
      expect(f.requests.every((request) => request.method === "GET")).toBe(true);
    },
  );

  it("preserves deadline-breach escalation even when blocked history is unavailable", async () => {
    const f = fixture([
      task({ tm_task_id: null, tm_tasks: null, deadline: "2026-10-15T23:00:00Z" }),
    ]);
    const result = await loadDeliveryOverview(f.db, CALLER);
    expect(result.autoEscalated).toBe(1);
    expect(f.escalations[0].reason).toBe("Auto: SLA breached — deadline passed 1h ago");
    expect(result.blocked[0]).toMatchObject({ blockedHours: null, escalated: true });
  });

  it.each(["completed", "cancelled"])("does not escalate terminal %s tasks", async (status) => {
    const f = fixture([task({ status, deadline: "2026-10-01T00:00:00Z" })]);
    expect((await loadDeliveryOverview(f.db, CALLER)).autoEscalated).toBe(0);
    expect(f.requests).toHaveLength(4);
  });

  it.each(["tm_activity", "developer_task_escalations", "audit_logs"])(
    "surfaces %s failures, never a successful-looking escalation",
    async (relation) => {
      const f = fixture(undefined, [event("2026-10-14T00:00:00Z")]);
      f.state.failure = relation;
      await expect(loadDeliveryOverview(f.db, CALLER)).rejects.toThrow(
        `Fixture ${relation} refused`,
      );
    },
  );
});
