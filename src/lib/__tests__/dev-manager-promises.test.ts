import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database, Tables } from "@/integrations/supabase/types";
import { loadDeliveryOverview, loadTaskPromiseIds } from "../dev-manager.server";

const NOW = "2026-10-16T00:00:00Z";
const uuid = (n: number, prefix = "10000000") =>
  `${prefix}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const CANONICAL = uuid(1, "20000000");
const P1 = uuid(1, "30000000");
const P2 = uuid(2, "30000000");
const P3 = uuid(3, "30000000");
type Link = Pick<Tables<"promise_links">, "id" | "module" | "record_id" | "promise_id">;
type Primary = Pick<Tables<"promises">, "id" | "linked_module" | "linked_record_id">;

function task(): Tables<"developer_tasks"> {
  return {
    id: uuid(1),
    title: "Isolated promise contract fixture",
    description: null,
    category: "general",
    requirements: [],
    links: [],
    attachments: [],
    progress_percent: 0,
    progress_note: null,
    priority: "medium",
    status: "assigned",
    developer_id: null,
    assigned_by: null,
    client_id: null,
    deadline: "2026-10-16T03:00:00Z",
    estimated_hours: null,
    task_amount: null,
    tech_stack: [],
    delivery_notes: null,
    accepted_at: null,
    started_at: null,
    actual_delivery_at: null,
    completed_at: null,
    pause_reason: null,
    paused_at: null,
    total_paused_minutes: 0,
    created_at: NOW,
    updated_at: NOW,
    tm_task_id: CANONICAL,
  };
}
const link = (promiseId: string, recordId = CANONICAL, module = "task_manager"): Link => ({
  id: promiseId,
  module,
  record_id: recordId,
  promise_id: promiseId,
});
const primary = (
  id: string,
  recordId: string | null = CANONICAL,
  module = "task_manager",
): Primary => ({
  id,
  linked_module: module,
  linked_record_id: recordId,
});

function fixture(links: Link[] = [], primaries: Primary[] = []) {
  const requests: { url: URL; method: string }[] = [];
  const state = {
    cap: 500,
    refuse: "",
    missingCount: "",
    emptyFrom: -1,
    changing: false,
    undercount: false,
    unexpectedReference: false,
    overdue: false,
  };
  const db = createClient<Database>("https://promise-contract-fixture.invalid", "fixture-only", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        const table = url.pathname.split("/").at(-1) ?? "";
        requests.push({ url, method: request.method });
        if (request.method !== "GET")
          throw Error("Promise reads must not write or auto-escalate on read failure");
        if (table === "developer_tasks") {
          const row = task();
          if (state.overdue) row.deadline = "2026-10-15T00:00:00Z";
          return Response.json([{ ...row, tm_tasks: null }]);
        }
        if (
          ["developers", "developer_task_escalations", "developer_task_internal_notes"].includes(
            table,
          )
        )
          return Response.json([]);
        if (table !== "promise_links" && table !== "promises")
          throw Error("Unexpected fixture relation");
        if (state.refuse === table)
          return Response.json(
            { message: "Fixture promise read refused", code: "42501" },
            { status: 403 },
          );
        const column = table === "promise_links" ? "record_id" : "linked_record_id";
        const moduleColumn = table === "promise_links" ? "module" : "linked_module";
        expect(url.searchParams.get(moduleColumn)).toBe("eq.task_manager");
        expect(url.searchParams.get("order")).toBe("id.asc");
        expect(request.headers.get("prefer")).toContain("count=exact");
        const filter = url.searchParams.get(column);
        if (!filter?.startsWith("in.(")) throw Error("Expected bounded canonical task filter");
        const ids = filter.slice(4, -1).split(",");
        expect(ids.length).toBeLessThanOrEqual(50);
        const matching =
          table === "promise_links"
            ? links
                .filter((row) => row.module === "task_manager" && ids.includes(row.record_id))
                .map(({ id, record_id, promise_id }) => ({ id, record_id, promise_id }))
            : primaries
                .filter(
                  (row) =>
                    row.linked_module === "task_manager" &&
                    row.linked_record_id !== null &&
                    ids.includes(row.linked_record_id),
                )
                .map(({ id, linked_record_id }) => ({ id, linked_record_id }));
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 500), state.cap);
        let rows = matching.slice(offset, offset + limit);
        if (state.emptyFrom >= 0 && offset >= state.emptyFrom) rows = [];
        if (state.unexpectedReference && table === "promises")
          rows = [{ id: P1, linked_record_id: null }];
        let total = state.unexpectedReference && table === "promises" ? 1 : matching.length;
        if (state.changing && offset > 0) total++;
        if (state.undercount && total > 0) total--;
        return Response.json(rows, {
          headers:
            state.missingCount === table
              ? {}
              : {
                  "content-range": rows.length
                    ? `${offset}-${offset + rows.length - 1}/${total}`
                    : `*/${total}`,
                },
        });
      },
    },
  });
  return { db, requests, state };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});
afterEach(() => vi.useRealTimers());

describe("Developer Manager canonical plural promise contract", () => {
  it("unions primary and secondary links, deduplicates and returns ALL IDs in stable order", async () => {
    const f = fixture([link(P2), link(P1)], [primary(P1), primary(P3)]);
    const result = await loadTaskPromiseIds(f.db, [{ tm_task_id: CANONICAL }]);
    expect(result.get(CANONICAL)).toEqual([P1, P2, P3]);
    expect(f.requests).toHaveLength(2);
    expect(f.requests.map((r) => r.method)).toEqual(["GET", "GET"]);
  });

  it("projects the same plural IDs onto active tasks and SLA risks without the fictitious singular property", async () => {
    const f = fixture([link(P2)], [primary(P1)]);
    const result = await loadDeliveryOverview(f.db, null);
    expect(result.tasks[0].promiseIds).toEqual([P1, P2]);
    expect(result.risks[0].promiseIds).toEqual([P1, P2]);
    expect(result.tasks[0]).not.toHaveProperty("promiseId");
    expect(result.risks[0]).not.toHaveProperty("promiseId");
    expect(result.autoEscalated).toBe(0);
    expect(f.requests.filter((r) => r.url.pathname.endsWith("/promise_links"))).toHaveLength(1);
  });

  it("uses the canonical UUID, not the developer-task ID, task code or another module", async () => {
    const f = fixture(
      [link(P1), link(P2, uuid(1)), link(P3, CANONICAL, "CRM")],
      [primary(P2, CANONICAL, "Engineering")],
    );
    const result = await loadTaskPromiseIds(f.db, [task()]);
    expect(result.get(CANONICAL)).toEqual([P1]);
    expect(f.requests.every((r) => r.url.search.includes(CANONICAL))).toBe(true);
  });

  it("returns genuine empty arrays for zero stored links and skips unbridged tasks", async () => {
    const f = fixture();
    expect((await loadTaskPromiseIds(f.db, [{ tm_task_id: CANONICAL }])).get(CANONICAL)).toEqual(
      [],
    );
    const empty = fixture();
    expect((await loadTaskPromiseIds(empty.db, [{ tm_task_id: null }])).size).toBe(0);
    expect(empty.requests).toHaveLength(0);
    expect((await loadTaskPromiseIds(empty.db, [])).size).toBe(0);
  });

  it("pages both real sources completely even under a smaller server-side row cap", async () => {
    const f = fixture([link(P1), link(P2), link(P3)], [primary(P1), primary(P2), primary(P3)]);
    f.state.cap = 1;
    expect((await loadTaskPromiseIds(f.db, [{ tm_task_id: CANONICAL }])).get(CANONICAL)).toEqual([
      P1,
      P2,
      P3,
    ]);
    expect(f.requests).toHaveLength(6);
    expect(
      f.requests
        .filter((r) => r.url.pathname.endsWith("/promises"))
        .map((r) => r.url.searchParams.get("offset")),
    ).toEqual(["0", "1", "2"]);
  });

  it("batches 101 unique canonical UUIDs in groups of at most 50 and deduplicates task references", async () => {
    const tasks = Array.from({ length: 101 }, (_, n) => ({ tm_task_id: uuid(n + 1, "20000000") }));
    const last = tasks[100].tm_task_id;
    const f = fixture([link(P1, last)]);
    const result = await loadTaskPromiseIds(f.db, [...tasks, tasks[0]]);
    expect(result.size).toBe(101);
    expect(result.get(last)).toEqual([P1]);
    expect(f.requests).toHaveLength(6);
  });

  it.each(["promise_links", "promises"])(
    "surfaces %s failures instead of reporting an empty success",
    async (table) => {
      const f = fixture();
      f.state.refuse = table;
      await expect(loadTaskPromiseIds(f.db, [{ tm_task_id: CANONICAL }])).rejects.toThrow(
        "read failed: Fixture promise read refused",
      );
    },
  );

  it("does not auto-escalate overdue work after a promise read failure", async () => {
    const f = fixture();
    f.state.refuse = "promise_links";
    f.state.overdue = true;
    await expect(loadDeliveryOverview(f.db, null)).rejects.toThrow("Promise links read failed");
    expect(f.requests.every((r) => r.method === "GET")).toBe(true);
  });

  it.each(["promise_links", "promises"])("rejects missing exact count for %s", async (table) => {
    const f = fixture();
    f.state.missingCount = table;
    await expect(loadTaskPromiseIds(f.db, [{ tm_task_id: CANONICAL }])).rejects.toThrow(
      "incomplete or changing result set",
    );
  });

  it("rejects incomplete pagination instead of silently omitting later IDs", async () => {
    const f = fixture([link(P1), link(P2)]);
    f.state.cap = 1;
    f.state.emptyFrom = 1;
    await expect(loadTaskPromiseIds(f.db, [{ tm_task_id: CANONICAL }])).rejects.toThrow(
      "incomplete or changing result set",
    );
  });

  it("rejects a result-count change during pagination", async () => {
    const f = fixture([link(P1), link(P2)]);
    f.state.cap = 1;
    f.state.changing = true;
    await expect(loadTaskPromiseIds(f.db, [{ tm_task_id: CANONICAL }])).rejects.toThrow(
      "incomplete or changing result set",
    );
  });

  it("rejects more rows than the exact count reports", async () => {
    const f = fixture([link(P1), link(P2)]);
    f.state.undercount = true;
    await expect(loadTaskPromiseIds(f.db, [{ tm_task_id: CANONICAL }])).rejects.toThrow(
      "incomplete or changing result set",
    );
  });

  it("rejects an unexpected/null canonical reference", async () => {
    const f = fixture();
    f.state.unexpectedReference = true;
    await expect(loadTaskPromiseIds(f.db, [{ tm_task_id: CANONICAL }])).rejects.toThrow(
      "unexpected task reference",
    );
  });
});
