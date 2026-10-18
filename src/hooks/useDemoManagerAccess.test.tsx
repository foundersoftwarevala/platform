// @vitest-environment jsdom
import { createClient } from "@supabase/supabase-js";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Constants } from "@/integrations/supabase/types";

const state = vi.hoisted(() => ({
  signedIn: true,
  role: null as string | null,
  fallback: null as string | null,
  fail: false,
  requests: [] as { url: URL; method: string }[],
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: state.signedIn ? { id: "fixture-user", email: "fixture@example.invalid" } : null,
    userRole: state.fallback,
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: createClient("https://role-fixture.invalid", "fixture-public-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init),
          url = new URL(request.url);
        state.requests.push({ url, method: request.method });
        if (!url.pathname.endsWith("/user_roles") || request.method !== "GET")
          throw new Error("Unexpected role fixture operation");
        if (state.fail) throw new Error("Fixture network unavailable");
        return Response.json({ role: state.role });
      },
    },
  }),
}));
import { useDemoManagerAccess } from "./useDemoManagerAccess";

beforeEach(() => {
  state.signedIn = true;
  state.role = null;
  state.fallback = null;
  state.fail = false;
  state.requests = [];
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function access() {
  const hook = renderHook(useDemoManagerAccess);
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

describe("unchanged demo access membership policy", () => {
  it("does not promote any current database role to the legacy action role", async () => {
    for (const role of Constants.public.Enums.app_role) {
      state.role = role;
      const hook = await access();
      expect(hook.result.current.isDemoManager).toBe(false);
      expect(hook.result.current.canAccessDemos).toBe(["admin", "super_admin"].includes(role));
      hook.unmount();
    }
    expect(
      state.requests.every(
        (request) =>
          request.method === "GET" && request.url.searchParams.get("user_id") === "eq.fixture-user",
      ),
    ).toBe(true);
  });

  it("retains legacy membership without granting other unknown roles access", async () => {
    state.role = "demo_manager";
    const manager = await access();
    expect(manager.result.current.isDemoManager).toBe(true);
    expect(manager.result.current.canAccessDemos).toBe(true);
    manager.unmount();
    state.role = "unrecognized";
    const unknown = await access();
    expect(unknown.result.current.isDemoManager).toBe(false);
    expect(unknown.result.current.canAccessDemos).toBe(false);
  });

  it("retains fallback precedence and view-only access without broadening mutation permission", async () => {
    state.fallback = "super_admin";
    const fallback = await access();
    expect(fallback.result.current.canAccessDemos).toBe(true);
    expect(fallback.result.current.isDemoManager).toBe(false);
    fallback.unmount();
    state.role = "vendor";
    const explicit = await access();
    expect(explicit.result.current.canAccessDemos).toBe(false);
    expect(explicit.result.current.isDemoManager).toBe(false);
  });

  it("denies unauthenticated access without querying roles", async () => {
    state.signedIn = false;
    const hook = await access();
    expect(hook.result.current.canAccessDemos).toBe(false);
    expect(hook.result.current.isDemoManager).toBe(false);
    expect(state.requests).toEqual([]);
  });
});
