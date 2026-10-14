import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { loadDeliveryOverview } from "../dev-manager.server";

type Task = Database["public"]["Tables"]["developer_tasks"]["Row"];
type Developer = Database["public"]["Tables"]["developers"]["Row"];
type WireRow = Record<string, unknown>;
const NOW = Date.parse("2026-10-14T18:00:00Z");
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "dev-task1",
    title: "Fixture delivery",
    status: "blocked",
    tm_task_id: "tm1",
    developer_id: "developer1",
    priority: "medium",
    category: "general",
    created_at: ago(48),
    updated_at: ago(1),
    accepted_at: null,
    actual_delivery_at: null,
    assigned_by: null,
    attachments: [],
    client_id: null,
    completed_at: null,
    deadline: null,
    delivery_notes: null,
    description: null,
    estimated_hours: null,
    links: [],
    pause_reason: null,
    paused_at: null,
    progress_note: null,
    progress_percent: 0,
    requirements: [],
    started_at: null,
    task_amount: null,
    tech_stack: null,
    total_paused_minutes: null,
    ...overrides,
  };
}

const developer: Developer = {
  id: "developer1",
  user_id: "user1",
  vala_id: "DEV-1",
  full_name: "Fixture Developer",
  email: "fixture@invalid.test",
  availability_status: "available",
  created_at: ago(100),
  updated_at: ago(1),
  current_task_id: null,
  is_frozen: false,
  joined_at: ago(100),
  max_capacity: 5,
  onboarding_completed: true,
  phone: null,
  skill_tags: [],
  status: "active",
};
const linked = (overrides: WireRow = {}): WireRow => ({
  id: "tm1",
  status: "blocked",
  paused_at: ago(1),
  blocked_reason: "Waiting for fixture review",
  quality_score: null,
  ...overrides,
});

function database() {
  const tables: Record<string, WireRow[]> = {
    developers: [developer],
    developer_tasks: [task()],
    developer_task_escalations: [],
    developer_task_internal_notes: [],
    tm_tasks: [linked()],
    promise_links: [],
    promises: [],
  };
  const failures: Record<string, string> = {};
  const requests: { table: string; method: string; url: URL; body: unknown }[] = [];
  const options = { pageCap: 1000, omitCountFor: "", changeCountFor: "" };
  const fetch: typeof globalThis.fetch = vi.fn(async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const table = url.pathname.split("/").pop() ?? "";
    const body: unknown = request.method === "POST" ? await request.json() : null;
    requests.push({ table, method: request.method, url, body });
    const failure = failures[`${request.method}:${table}`] ?? failures[table];
    if (failure) return Response.json({ message: failure, code: "42501" }, { status: 400 });
    if (request.method === "POST") {
      if (table === "audit_logs") return new Response(null, { status: 201 });
      if (table !== "developer_task_escalations" || !Array.isArray(body))
        throw new Error(`Unexpected fixture write: ${table}`);
      const created = body.map((row, index) => ({
        ...row,
        id: `escalation-${index}`,
        status: "pending",
        created_at: new Date(NOW).toISOString(),
        resolved_at: null,
        resolution: null,
      }));
      tables.developer_task_escalations.push(...created);
      return Response.json(created, { status: 201 });
    }
    if (request.method !== "GET" || !(table in tables))
      throw new Error(`Unexpected fixture read: ${table}`);
    let rows = [...tables[table]];
    for (const [key, filter] of url.searchParams) {
      if (filter.startsWith("eq."))
        rows = rows.filter((row) => String(row[key]) === filter.slice(3));
      if (filter.startsWith("in.(")) {
        const ids = filter.slice(4, -1).split(",");
        rows = rows.filter((row) => ids.includes(String(row[key])));
      }
    }
    if (url.searchParams.get("order")?.startsWith("id.")) {
      rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    }
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 1000);
    const count = rows.length + (options.changeCountFor === table && offset > 0 ? 1 : 0);
    rows = rows.slice(offset, offset + Math.min(limit, options.pageCap));
    const selection = url.searchParams.get("select") ?? "*";
    if (selection !== "*") {
      rows = rows.map((row) =>
        Object.fromEntries(selection.split(",").map((column) => [column, row[column]])),
      );
    }
    const headers = new Headers();
    if (options.omitCountFor !== table)
      headers.set(
        "content-range",
        rows.length ? `${offset}-${offset + rows.length - 1}/${count}` : `*/${count}`,
      );
    return Response.json(rows, { headers });
  });
  const db = createClient<Database>("https://delivery-fixture.invalid", "fixture-only", {
    global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    db,
    tables,
    failures,
    requests,
    options,
    writes: () => requests.filter((request) => request.method === "POST"),
  };
}

beforeEach(() => vi.spyOn(Date, "now").mockReturnValue(NOW));
afterEach(() => vi.restoreAllMocks());

describe("Developer Manager schema-backed delivery", () => {
  it.each([
    { milliseconds: 24 * 3_600_000 - 1, expected: 0 },
    { milliseconds: 24 * 3_600_000, expected: 1 },
    { milliseconds: 25 * 3_600_000, expected: 1 },
  ])(
    "preserves the exact 24-hour threshold: $milliseconds ms",
    async ({ milliseconds, expected }) => {
      const fixture = database();
      fixture.tables.tm_tasks = [linked({ paused_at: new Date(NOW - milliseconds).toISOString() })];
      const overview = await loadDeliveryOverview(fixture.db, null);
      expect(overview.autoEscalated).toBe(expected);
      expect(overview.blocked[0]).toMatchObject({
        blockedReason: "Waiting for fixture review",
        autoEscalateThreshold: 24,
        blockedSince: new Date(NOW - milliseconds).toISOString(),
        escalated: Boolean(expected),
      });
      expect(fixture.writes()).toHaveLength(expected * 2);
      if (expected) {
        expect(overview.escalations[0].reason).toContain("(threshold 24h)");
        expect(overview.escalations[0].reason).toContain("Waiting for fixture review");
      }
    },
  );

  it("keeps unknown blocked duration visible without inventing a timer or escalation", async () => {
    const fixture = database();
    fixture.tables.developer_tasks = [task({ tm_task_id: null })];
    const overview = await loadDeliveryOverview(fixture.db, null);
    expect(overview.stats.blocked).toBe(1);
    expect(overview.blocked[0]).toMatchObject({ blockedSince: null, blockedHours: null });
    expect(overview.tasks[0]).toMatchObject({ promiseId: null, promiseIds: [] });
    expect(fixture.writes()).toHaveLength(0);
    expect(fixture.requests.some((request) => request.table === "tm_tasks")).toBe(false);
  });

  it("does not use a paused/on-hold timer as a blocked timestamp", async () => {
    const fixture = database();
    fixture.tables.tm_tasks = [linked({ status: "on_hold", paused_at: ago(30) })];
    const overview = await loadDeliveryOverview(fixture.db, null);
    expect(overview.blocked[0]).toMatchObject({
      blockedSince: null,
      blockedHours: null,
      blockedReason: "No reason recorded",
    });
    expect(fixture.writes()).toHaveLength(0);
  });

  it("still escalates a passed deadline when the blocked timer is unknown", async () => {
    const fixture = database();
    fixture.tables.developer_tasks = [task({ tm_task_id: null, deadline: ago(1) })];
    const overview = await loadDeliveryOverview(fixture.db, null);
    expect(overview.autoEscalated).toBe(1);
    expect(overview.escalations[0].reason).toContain("SLA breached");
  });

  it("does not repeat an already-open automatic escalation", async () => {
    const fixture = database();
    fixture.tables.tm_tasks = [linked({ paused_at: ago(30) })];
    await loadDeliveryOverview(fixture.db, null);
    const repeated = await loadDeliveryOverview(fixture.db, null);
    expect(repeated.autoEscalated).toBe(0);
    expect(fixture.writes()).toHaveLength(2);
  });

  it("uses real linked review scores, includes zero and excludes unscored work", async () => {
    const fixture = database();
    fixture.tables.developer_tasks = [0, 1, 2].map((index) =>
      task({
        id: `dev-${index}`,
        tm_task_id: `tm${index}`,
        status: "completed",
        completed_at: ago(2),
        started_at: ago(3),
        deadline: ago(1),
      }),
    );
    fixture.tables.tm_tasks = [0, null, 100].map((quality_score, index) =>
      linked({ id: `tm${index}`, status: "completed", quality_score }),
    );
    const overview = await loadDeliveryOverview(fixture.db, null);
    expect(overview.performance[0]).toMatchObject({ completedTasks: 3, qualityScore: 50 });
    fixture.tables.tm_tasks.forEach((row) => {
      row.quality_score = null;
    });
    expect((await loadDeliveryOverview(fixture.db, null)).performance[0].qualityScore).toBeNull();
  });

  it("returns every canonical promise link, deduplicating the primary link", async () => {
    const fixture = database();
    fixture.tables.promise_links = [
      { id: "link1", module: "task_manager", record_id: "tm1", promise_id: "promise1" },
      { id: "link2", module: "task_manager", record_id: "tm1", promise_id: "promise2" },
      { id: "other", module: "other_module", record_id: "tm1", promise_id: "not-related" },
    ];
    fixture.tables.promises = [
      { id: "promise1", linked_module: "task_manager", linked_record_id: "tm1" },
    ];
    fixture.tables.developer_tasks[0].deadline = new Date(NOW + 3_600_000).toISOString();
    const overview = await loadDeliveryOverview(fixture.db, null);
    expect(overview.tasks[0]).toMatchObject({
      promiseId: null,
      promiseIds: ["promise1", "promise2"],
    });
    expect(overview.risks[0].promiseIds).toEqual(["promise1", "promise2"]);
    fixture.tables.promise_links = [];
    expect((await loadDeliveryOverview(fixture.db, null)).tasks[0].promiseId).toBe("promise1");
  });

  it("paginates below a server-side cap instead of truncating related data", async () => {
    const fixture = database();
    fixture.options.pageCap = 1;
    fixture.tables.promise_links = [1, 2, 3].map((index) => ({
      id: `link${index}`,
      module: "task_manager",
      record_id: "tm1",
      promise_id: `promise${index}`,
    }));
    const overview = await loadDeliveryOverview(fixture.db, null);
    expect(overview.tasks[0].promiseIds).toEqual(["promise1", "promise2", "promise3"]);
    expect(
      fixture.requests
        .filter((request) => request.table === "promise_links")
        .map((request) => request.url.searchParams.get("offset")),
    ).toEqual(["0", "1", "2"]);
  });

  it("batches related IDs in groups of at most fifty", async () => {
    const fixture = database();
    fixture.tables.developer_tasks = Array.from({ length: 51 }, (_, index) =>
      task({ id: `dev-${index}`, tm_task_id: `tm-${index}` }),
    );
    fixture.tables.tm_tasks = Array.from({ length: 51 }, (_, index) =>
      linked({ id: `tm-${index}` }),
    );
    const overview = await loadDeliveryOverview(fixture.db, null);
    expect(overview.blocked).toHaveLength(51);
    const reads = fixture.requests.filter((request) => request.table === "tm_tasks");
    expect(reads).toHaveLength(2);
    expect(
      reads.map((request) => request.url.searchParams.get("id")?.slice(4, -1).split(",").length),
    ).toEqual([50, 1]);
  });

  it.each(["tm_tasks", "promise_links", "promises"])(
    "surfaces %s read failures before auto-escalation writes",
    async (table) => {
      const fixture = database();
      fixture.failures[table] = "Fixture related read refused";
      await expect(loadDeliveryOverview(fixture.db, null)).rejects.toThrow(
        "Fixture related read refused",
      );
      expect(fixture.writes()).toHaveLength(0);
    },
  );

  it.each(["malformed-time", new Date(NOW + 1000).toISOString()])(
    "rejects invalid blocked time %s",
    async (paused_at) => {
      const fixture = database();
      fixture.tables.tm_tasks = [linked({ paused_at })];
      await expect(loadDeliveryOverview(fixture.db, null)).rejects.toThrow(
        "Invalid blocked timestamp",
      );
      expect(fixture.writes()).toHaveLength(0);
    },
  );

  it("rejects a missing pagination count instead of claiming completeness", async () => {
    const fixture = database();
    fixture.options.omitCountFor = "promise_links";
    await expect(loadDeliveryOverview(fixture.db, null)).rejects.toThrow("total count missing");
    expect(fixture.writes()).toHaveLength(0);
  });

  it("rejects a changed related-data inventory between pages", async () => {
    const fixture = database();
    fixture.options.pageCap = 1;
    fixture.options.changeCountFor = "promise_links";
    fixture.tables.promise_links = [1, 2].map((index) => ({
      id: `link${index}`,
      module: "task_manager",
      record_id: "tm1",
      promise_id: `promise${index}`,
    }));
    await expect(loadDeliveryOverview(fixture.db, null)).rejects.toThrow("changed during read");
    expect(fixture.writes()).toHaveLength(0);
  });

  it.each(["developer_task_escalations", "audit_logs"])(
    "surfaces %s write failures",
    async (table) => {
      const fixture = database();
      fixture.tables.tm_tasks = [linked({ paused_at: ago(30) })];
      fixture.failures[`POST:${table}`] = "Fixture write refused";
      await expect(loadDeliveryOverview(fixture.db, null)).rejects.toThrow("Fixture write refused");
    },
  );
});
