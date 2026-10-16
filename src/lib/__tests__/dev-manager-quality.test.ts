import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { loadDeliveryOverview } from "../dev-manager.server";

type Task = Database["public"]["Tables"]["developer_tasks"]["Row"] & {
  tm_tasks: { quality_score: number | null } | null;
};
type Developer = Database["public"]["Tables"]["developers"]["Row"];
const now = "2026-10-15T00:00:00Z";
const developerId = "10000000-0000-4000-8000-000000000001";

function developer(id = developerId, valaId = "DEV-001"): Developer {
  return {
    id,
    user_id: id,
    vala_id: valaId,
    full_name: valaId,
    email: "quality-fixture@example.invalid",
    phone: null,
    status: "active",
    availability_status: "available",
    current_task_id: null,
    is_frozen: false,
    created_at: now,
    updated_at: now,
    joined_at: now,
    max_capacity: 5,
    onboarding_completed: true,
    skill_tags: [],
  };
}

function task(id: string, score: number | null, patch: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    description: null,
    category: "general",
    requirements: [],
    links: [],
    attachments: [],
    progress_percent: 100,
    progress_note: null,
    priority: "medium",
    status: "completed",
    developer_id: developerId,
    assigned_by: null,
    client_id: null,
    deadline: "2026-10-14T00:00:00Z",
    estimated_hours: 2,
    task_amount: null,
    tech_stack: [],
    delivery_notes: null,
    accepted_at: null,
    started_at: "2026-10-13T22:00:00Z",
    actual_delivery_at: null,
    completed_at: "2026-10-14T00:00:00Z",
    pause_reason: null,
    paused_at: null,
    total_paused_minutes: 0,
    created_at: "2026-10-13T00:00:00Z",
    updated_at: now,
    tm_task_id: `canonical-${id}`,
    tm_tasks: { quality_score: score },
    ...patch,
  };
}

function fixture(tasks: Task[], developers = [developer()], fail = false) {
  const requests: URL[] = [];
  const rows: Record<string, unknown[]> = {
    developers,
    developer_tasks: tasks,
    developer_task_escalations: [],
    developer_task_internal_notes: [],
  };
  const db = createClient<Database>("https://quality-fixture.invalid", "fixture-only", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        requests.push(url);
        if (request.method !== "GET") throw new Error("Quality fixture must be read-only");
        const table = url.pathname.split("/").at(-1) ?? "";
        if (!(table in rows)) throw new Error(`Unexpected fixture relation: ${table}`);
        if (fail && table === "developer_tasks") {
          return Response.json(
            { message: "Canonical quality lookup refused", code: "42501" },
            { status: 403 },
          );
        }
        return Response.json(rows[table]);
      },
    },
  });
  return { db, requests };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Developer Manager canonical review quality", () => {
  it("averages real linked review scores only for completed tasks in the current window", async () => {
    const { db, requests } = fixture([
      task("one", 80),
      task("two", 100),
      task("old", 10, { completed_at: "2026-08-01T00:00:00Z" }),
      task("open", 20, { status: "assigned", completed_at: null, deadline: null }),
    ]);
    const result = await loadDeliveryOverview(db, null);
    expect(result.performance[0]).toMatchObject({
      valaId: "DEV-001",
      completedTasks: 2,
      qualityScore: 90,
      onTimeRate: 100,
      avgCompletionTime: 2,
    });
    expect(result.tasks.map((row) => row.id)).toEqual(["open"]);
    const taskQueries = requests.filter((url) => url.pathname.endsWith("/developer_tasks"));
    expect(taskQueries).toHaveLength(1);
    expect(taskQueries[0].searchParams.get("select")).toBe("*,tm_tasks(quality_score)");
    expect(taskQueries[0].searchParams.get("order")).toBe("created_at.desc");
    expect(requests).toHaveLength(4);
  });

  it("retains unlinked tasks and the existing unscored result without inventing a score", async () => {
    const { db } = fixture([
      task("unlinked", null, { tm_task_id: null, tm_tasks: null }),
      task("unreviewed", null),
    ]);
    const result = await loadDeliveryOverview(db, null);
    expect(result.performance[0]).toMatchObject({
      completedTasks: 2,
      qualityScore: 0,
      onTimeRate: 100,
    });
    expect(result.autoEscalated).toBe(0);
  });

  it("does not attribute another developer's linked task score to the first developer", async () => {
    const secondId = "20000000-0000-4000-8000-000000000002";
    const { db } = fixture(
      [task("first", 30), task("second", 95, { developer_id: secondId })],
      [developer(), developer(secondId, "DEV-002")],
    );
    const result = await loadDeliveryOverview(db, null);
    expect(result.performance.map((row) => [row.valaId, row.qualityScore])).toEqual([
      ["DEV-001", 30],
      ["DEV-002", 95],
    ]);
  });

  it("preserves the existing exclusion of nonpositive and missing scores", async () => {
    const { db } = fixture([task("positive", 80), task("zero", 0), task("absent", null)]);
    const result = await loadDeliveryOverview(db, null);
    expect(result.performance[0]).toMatchObject({ completedTasks: 3, qualityScore: 80 });
  });

  it("surfaces failed relational reads rather than reporting an unscored success", async () => {
    const { db } = fixture([task("one", 80)], [developer()], true);
    await expect(loadDeliveryOverview(db, null)).rejects.toThrow(
      "Delivery data read failed: Canonical quality lookup refused",
    );
  });
});
