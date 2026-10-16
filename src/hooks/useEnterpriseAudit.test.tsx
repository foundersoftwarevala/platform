// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { AuthSessionMissingError, createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireJsonObject } from "@/lib/json";

const mocks = vi.hoisted(() => ({
  userId: "10000000-0000-4000-8000-000000000001" as string | null,
  failPrimary: false,
  writes: [] as { table: string; row: Record<string, unknown> }[],
}));
vi.mock("@/integrations/supabase/client", () => {
  const client = createClient("https://audit-fixture.invalid", "fixture-only", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const table = new URL(request.url).pathname.split("/").at(-1) ?? "";
        const rows: unknown = await request.json();
        if (!Array.isArray(rows)) throw new Error("Expected audit rows");
        mocks.writes.push({ table, row: requireJsonObject(rows[0], "Fixture audit row") });
        return table === "audit_logs" && mocks.failPrimary
          ? Response.json({ message: "Fixture audit refused", code: "42501" }, { status: 403 })
          : new Response(null, { status: 204 });
      },
    },
  });
  client.auth.getUser = vi.fn(async () => {
    if (!mocks.userId) return { data: { user: null }, error: new AuthSessionMissingError() };
    return {
      data: {
        user: {
          id: mocks.userId,
          app_metadata: {},
          user_metadata: {},
          aud: "authenticated",
          created_at: "2026-10-14T00:00:00Z",
        },
      },
      error: null,
    };
  });
  return { supabase: client };
});
import { useEnterpriseAudit } from "./useEnterpriseAudit";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => {
  mocks.writes = [];
  mocks.failPrimary = false;
  mocks.userId = "10000000-0000-4000-8000-000000000001";
});

describe("enterprise audit schema contract", () => {
  it("writes actual actor/entity/severity/metadata fields without losing audit context", async () => {
    const { result } = renderHook(useEnterpriseAudit);
    let accepted = false;
    await act(async () => {
      accepted = await result.current.logAction({
        action: "Fixture update",
        module: "server_manager",
        severity: "medium",
        target_id: "10000000-0000-4000-8000-000000000002",
        target_type: "server",
        old_values: { online: false },
        new_values: { online: true },
        reason: "Verified",
        metadata: { source: "fixture", user_id: "spoofed", severity: "low" },
      });
    });
    expect(accepted).toBe(true);
    expect(mocks.writes[0].row).toMatchObject({
      actor: mocks.userId,
      entity_type: "server_manager",
      severity: "medium",
      entity_id: "10000000-0000-4000-8000-000000000002",
      metadata: {
        user_id: mocks.userId,
        severity: "medium",
        target_type: "server",
        old_values: { online: false },
        new_values: { online: true },
        reason: "Verified",
        source: "fixture",
      },
    });
    expect(mocks.writes[0].row).not.toHaveProperty("module");
    expect(mocks.writes[0].row).not.toHaveProperty("meta_json");
    expect(mocks.writes[0].row).not.toHaveProperty("user_id");
  });

  it("preserves system-event identity and high/critical blackbox logging", async () => {
    mocks.userId = null;
    const { result } = renderHook(useEnterpriseAudit);
    await act(async () => {
      await result.current.logAction({
        action: "Fixture critical",
        module: "system",
        severity: "critical",
      });
    });
    expect(mocks.writes.map((write) => write.table)).toEqual(["audit_logs", "blackbox_events"]);
    expect(mocks.writes[0].row).toMatchObject({
      actor: "system",
      entity_id: null,
      metadata: { user_id: null },
    });
    expect(mocks.writes[1].row).toMatchObject({ risk_score: 90, user_id: null });
  });

  it("returns false and logs explicit primary refusals; does not silently succeed", async () => {
    mocks.failPrimary = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(useEnterpriseAudit);
    await act(async () => {
      expect(
        await result.current.logAction({
          action: "Fixture denied",
          module: "system",
          severity: "high",
        }),
      ).toBe(false);
    });
    expect(error).toHaveBeenCalledWith(
      "[AUDIT] Primary log failed:",
      expect.objectContaining({ message: "Fixture audit refused" }),
    );
    expect(mocks.writes).toHaveLength(1);
  });
});
