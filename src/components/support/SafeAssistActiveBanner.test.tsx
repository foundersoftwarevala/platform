// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireJsonObject } from "@/lib/json";

const mocks = vi.hoisted(() => ({
  auditFailure: false,
  stopFailure: false,
  writes: [] as {
    table: string;
    method: string;
    body: Record<string, unknown>;
    filter: string | null;
  }[],
  errorToast: vi.fn(),
  successToast: vi.fn(),
  removeChannel: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-fixture" } }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.errorToast, success: mocks.successToast } }));
vi.mock("@/integrations/supabase/client", () => {
  const client = createClient("https://assist-fixture.invalid", "fixture-only", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        const table = url.pathname.split("/").at(-1) ?? "";
        if (request.method === "GET")
          return Response.json({
            id: "session-fixture",
            status: "active",
            ai_risk_score: 0,
            started_at: new Date().toISOString(),
          });
        const body = requireJsonObject(await request.json(), "Fixture assist write");
        mocks.writes.push({
          table,
          method: request.method,
          body,
          filter: url.searchParams.get("id"),
        });
        if (
          (table === "audit_logs" && mocks.auditFailure) ||
          (table === "safe_assist_sessions" && mocks.stopFailure)
        ) {
          return Response.json(
            { message: "Fixture write refused", code: "42501" },
            { status: 403 },
          );
        }
        return new Response(null, { status: 204 });
      },
    },
  });
  const subscription = { on: () => subscription, subscribe: () => subscription };
  return {
    supabase: {
      from: client.from.bind(client),
      channel: () => subscription,
      removeChannel: mocks.removeChannel,
    },
  };
});
import { SafeAssistActiveBanner } from "./SafeAssistActiveBanner";

beforeEach(() => {
  mocks.auditFailure = false;
  mocks.stopFailure = false;
  mocks.writes = [];
  mocks.errorToast.mockClear();
  mocks.successToast.mockClear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Safe Assist audit schema and stop behavior", () => {
  it("stops the actual selected session and writes real audit columns", async () => {
    render(<SafeAssistActiveBanner />);
    fireEvent.click(await screen.findByRole("button", { name: /stop/i }));
    await waitFor(() =>
      expect(mocks.successToast).toHaveBeenCalledWith("Safe Assist session ended"),
    );
    expect(mocks.writes[0]).toMatchObject({
      table: "safe_assist_sessions",
      method: "PATCH",
      filter: "eq.session-fixture",
      body: { status: "ended", ended_by: "user-fixture" },
    });
    expect(mocks.writes[1]).toMatchObject({
      table: "audit_logs",
      body: {
        actor: "user-fixture",
        entity_type: "safe_assist",
        entity_id: "session-fixture",
        metadata: { user_id: "user-fixture", session_id: "session-fixture" },
      },
    });
    expect(mocks.writes[1].body).not.toHaveProperty("meta_json");
    expect(screen.queryByRole("button", { name: /stop/i })).toBeNull();
  });

  it("hides the ended session and explicitly reports audit failure rather than false success", async () => {
    mocks.auditFailure = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<SafeAssistActiveBanner />);
    fireEvent.click(await screen.findByRole("button", { name: /stop/i }));
    await waitFor(() =>
      expect(mocks.errorToast).toHaveBeenCalledWith(
        "Session ended, but its audit log could not be saved.",
      ),
    );
    expect(error).toHaveBeenCalledWith(
      "Safe Assist session ended, but audit logging failed:",
      expect.objectContaining({ message: "Fixture write refused" }),
    );
    expect(mocks.successToast).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("button", { name: /stop/i })).toBeNull());
  });

  it("keeps a session visible and does not audit a failed stop", async () => {
    mocks.stopFailure = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<SafeAssistActiveBanner />);
    fireEvent.click(await screen.findByRole("button", { name: /stop/i }));
    await waitFor(() =>
      expect(mocks.errorToast).toHaveBeenCalledWith("Failed to end session. Try again."),
    );
    expect(mocks.writes).toHaveLength(1);
    expect(screen.getByRole("button", { name: /stop/i })).toBeTruthy();
    expect(mocks.successToast).not.toHaveBeenCalled();
  });
});
