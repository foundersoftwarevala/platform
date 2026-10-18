// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";

const state = vi.hoisted(() => ({
  fail: false,
  empty: false,
  requests: [] as { url: URL; key: string | null; method: string }[],
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: createClient<Database>("https://accessibility-fixture.invalid", "fixture-only", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        state.requests.push({ url, key: request.headers.get("apikey"), method: request.method });
        if (!url.pathname.endsWith("/accessibility_compliance") || request.method !== "GET") {
          throw new Error("Accessibility fixture only permits the existing read");
        }
        if (state.fail) {
          return Response.json(
            { message: "Accessibility relation unavailable", code: "PGRST205" },
            { status: 404 },
          );
        }
        return Response.json(
          state.empty
            ? []
            : [
                {
                  id: "10000000-0000-4000-8000-000000000001",
                  page_url: "https://demo.example.invalid/",
                  wcag_level: "AA",
                  status: "partial",
                  score: 75,
                  issues: [{ code: "contrast" }],
                  checked_at: null,
                  created_at: "2026-10-15T00:00:00Z",
                },
              ],
        );
      },
    },
  }),
}));
import { useOpsAccessibility } from "./useDemoOps";

let client: QueryClient;
beforeEach(() => {
  state.fail = false;
  state.empty = false;
  state.requests = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
});
function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
}

describe("migration-backed accessibility read", () => {
  it("uses the original authenticated client and typed real columns", async () => {
    const { result } = renderHook(useOpsAccessibility, { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({
      wcag_level: "AA",
      score: 75,
      status: "partial",
    });
    expect(state.requests).toHaveLength(1);
    expect(state.requests[0].key).toBe("fixture-only");
    expect(state.requests[0].url.searchParams.get("select")).toBe("*");
    expect(state.requests[0].url.searchParams.get("limit")).toBe("300");
  });

  it("preserves a successful empty result without inventing a check", async () => {
    state.empty = true;
    const { result } = renderHook(useOpsAccessibility, { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("surfaces an absent backend relation instead of returning empty success", async () => {
    state.fail = true;
    const { result } = renderHook(useOpsAccessibility, { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ message: "Accessibility relation unavailable" });
    expect(result.current.data).toBeUndefined();
  });
});
