// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ requests: [] as URL[], empty: false, userId: "user-a" }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: createClient("https://chat-fixture.invalid", "fixture-public-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init),
          url = new URL(request.url);
        if (request.method !== "GET") throw new Error("Chat fixture only permits reads");
        state.requests.push(url);
        const table = url.pathname.split("/").at(-1);
        if (table === "chat_sessions")
          return Response.json(
            state.empty
              ? []
              : [
                  {
                    id: "session",
                    visitor_name: "Ada Lovelace",
                    started_at: "2026-10-15T00:00:00Z",
                    handled_by: "human",
                  },
                ],
          );
        if (table === "bot_conversation_logs")
          return Response.json([
            {
              id: "log",
              session_id: "session",
              intent: "Support",
              outcome: "resolved",
              confidence: 90,
              message_count: 2,
              created_at: "2026-10-15T00:00:00Z",
            },
          ]);
        if (table === "chatbots") return Response.json([]);
        throw new Error(`Unexpected chat fixture relation: ${table}`);
      },
    },
  }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: state.userId } }),
}));
import { useChatSessions } from "./useSalesSupportData";
import { CBAnalyticsLogs } from "@/components/support-chatbot/screens/CBAnalyticsLogs";

let client: QueryClient;
beforeEach(() => {
  state.requests = [];
  state.empty = false;
  state.userId = "user-a";
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
});
function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
}

describe("schema-backed visitor name contract", () => {
  it("keeps the existing session query and exposes the actual string field", async () => {
    const { result } = renderHook(useChatSessions, { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryCache().findAll()[0]?.queryKey).toContain("user-a");
    const name: string | undefined = result.current.data?.[0].visitor_name;
    expect(
      name
        ?.split(" ")
        .map((part) => part[0])
        .join(""),
    ).toBe("AL");
    expect(state.requests[0].searchParams.get("select")).toBe("*");
    expect(state.requests[0].searchParams.get("order")).toBe("started_at.desc");
    expect(state.requests[0].searchParams.get("limit")).toBe("500");
  });

  it("renders the analytics visitor initials and human handler from real query results", async () => {
    render(createElement(CBAnalyticsLogs), { wrapper });
    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("AL")).toBeTruthy();
    expect(screen.getByText("human")).toBeTruthy();
  });

  it("preserves the analytics unknown-visitor fallback for an unlinked log", async () => {
    state.empty = true;
    render(createElement(CBAnalyticsLogs), { wrapper });
    expect(await screen.findByText("Unknown visitor")).toBeTruthy();
    expect(screen.getByText("N")).toBeTruthy();
  });
});
