// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authCallback: null as ((event: string, session: Session | null) => void) | null,
  getSessionFinished: false,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: typeof state.authCallback) => {
        state.authCallback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      getSession: async () => {
        state.getSessionFinished = true;
        return { data: { session: null } };
      },
      signOut: vi.fn(),
    },
    from: () => ({
      select: () => ({
        eq: async () => ({ data: [], error: null }),
      }),
    }),
  },
}));

import { AuthProvider } from "./useAuth";

let client: QueryClient;

beforeEach(() => {
  state.authCallback = null;
  state.getSessionFinished = false;
  client = new QueryClient();
});

afterEach(() => {
  cleanup();
  client.clear();
});

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client },
    createElement(AuthProvider, null, children),
  );
}

function sessionFor(id: string): Session {
  return {
    user: { id },
  } as Session;
}

describe("auth-scoped query cache", () => {
  it("clears cached data on logout and account changes", async () => {
    render(createElement("div"), { wrapper });
    await waitFor(() => {
      expect(state.getSessionFinished).toBe(true);
      expect(state.authCallback).toBeTypeOf("function");
    });

    act(() => state.authCallback?.("SIGNED_IN", sessionFor("user-a")));
    client.setQueryData(["account", "user-a"], { privateValue: "a" });
    expect(client.getQueryCache().getAll()).toHaveLength(1);

    act(() => state.authCallback?.("SIGNED_IN", sessionFor("user-b")));
    expect(client.getQueryCache().getAll()).toHaveLength(0);

    client.setQueryData(["account", "user-b"], { privateValue: "b" });
    act(() => state.authCallback?.("SIGNED_OUT", null));
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});
