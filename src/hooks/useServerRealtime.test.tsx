// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ responses: [] as unknown[] }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "neq", "eq", "order", "limit"]) {
        builder[method] = () => builder;
      }
      builder.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve(state.responses.shift()).then(resolve, reject);
      return builder;
    },
    channel: () => {
      const channel = {
        on: () => channel,
        subscribe: (callback?: (status: string) => void) => {
          callback?.("SUBSCRIBED");
          return channel;
        },
      };
      return channel;
    },
    removeChannel: vi.fn(),
  },
}));

import { useServerRealtime } from "./useServerRealtime";

beforeEach(() => {
  state.responses = [];
});

afterEach(cleanup);

describe("useServerRealtime refresh failures", () => {
  it("exposes the Supabase error and does not represent a failed read as empty data", async () => {
    state.responses = [{ data: null, error: { message: "Metrics access denied" } }];
    const { result } = renderHook(() => useServerRealtime());

    await waitFor(() => expect(result.current.error).toBe("Metrics access denied"));
    expect(result.current.metrics).toEqual({});
    expect(result.current.alerts).toEqual([]);
    expect(result.current.lastUpdate).toBeNull();
  });

  it("clears stale values after a later failed read and preserves the last successful timestamp", async () => {
    state.responses = [
      {
        data: [{
          id: "server-1",
          server_name: "Server 1",
          cpu_usage: 17,
          ram_usage: 20,
          disk_usage: 30,
          network_in_mbps: 1,
          network_out_mbps: 2,
          health_score: 90,
          status: "active",
          updated_at: "2026-10-25T00:00:00Z",
        }],
        error: null,
      },
      { data: [], error: null },
    ];
    const { result } = renderHook(() => useServerRealtime());
    await waitFor(() => expect(result.current.lastUpdate).toBeInstanceOf(Date));
    expect(result.current.metrics["server-1"]?.cpu_percent).toBe(17);
    const lastSuccess = result.current.lastUpdate;
    state.responses = [{ data: null, error: { message: "Metrics unavailable" } }];

    await act(async () => result.current.refreshMetrics());

    expect(result.current.error).toBe("Metrics unavailable");
    expect(result.current.metrics).toEqual({});
    expect(result.current.alerts).toEqual([]);
    expect(result.current.lastUpdate).toBe(lastSuccess);
  });
});
