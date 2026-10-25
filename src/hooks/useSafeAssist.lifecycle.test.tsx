// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  channels: [] as Array<{
    name: string;
    handlers: Record<string, (payload: { payload?: unknown; new?: unknown }) => void>;
  }>,
  removeChannel: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: state.rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    }),
    channel: (name: string) => {
      const channel = {
        name,
        handlers: {} as Record<string, (payload: { payload?: unknown; new?: unknown }) => void>,
        on: (
          _type: string,
          options: { event: string },
          handler: (payload: { payload?: unknown; new?: unknown }) => void,
        ) => {
          channel.handlers[options.event] = handler;
          return channel;
        },
        subscribe: (callback?: (status: string) => void) => {
          callback?.("SUBSCRIBED");
          return channel;
        },
      };
      state.channels.push(channel);
      return channel;
    },
    removeChannel: state.removeChannel,
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import { useSafeAssist } from "./useSafeAssist";

beforeEach(() => {
  state.channels = [];
  state.removeChannel.mockClear();
  state.rpc.mockReset();
  state.rpc.mockResolvedValue({
    data: {
      id: "session-1",
      status: "active",
      dual_verified: false,
    },
    error: null,
  });
});

afterEach(cleanup);

async function startSession(result: { result: { current: ReturnType<typeof useSafeAssist> } }) {
  await result.result.current.createSession();
  await waitFor(() => expect(result.result.current.session).not.toBeNull());
}

describe("Safe Assist realtime lifecycle", () => {
  it("removes both session channels when the session ends", async () => {
    const hook = renderHook(() => useSafeAssist());
    await startSession(hook);

    expect(state.channels).toHaveLength(2);
    await hook.result.current.endSession();

    expect(state.removeChannel).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(hook.result.current.session).toBeNull());
  });

  it("removes both session channels when the session ends remotely", async () => {
    const hook = renderHook(() => useSafeAssist());
    await startSession(hook);

    act(() => {
      state.channels[0]?.handlers.session_update?.({ payload: { status: "ended" } });
    });

    expect(state.removeChannel).toHaveBeenCalledTimes(2);
    expect(hook.result.current.session).toBeNull();
  });

  it("removes both session channels when the database session is terminated", async () => {
    const hook = renderHook(() => useSafeAssist());
    await startSession(hook);

    act(() => {
      state.channels[0]?.handlers.UPDATE?.({ new: { status: "terminated" } });
    });

    expect(state.removeChannel).toHaveBeenCalledTimes(2);
    expect(hook.result.current.session).toBeNull();
  });

  it("removes both session channels when the hook unmounts", async () => {
    const hook = renderHook(() => useSafeAssist());
    await startSession(hook);
    hook.unmount();

    expect(state.removeChannel).toHaveBeenCalledTimes(2);
  });

  it("does not create session channels if session creation finishes after unmount", async () => {
    let resolveRpc: ((value: { data: unknown; error: null }) => void) | undefined;
    state.rpc.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRpc = resolve;
        }),
    );
    const hook = renderHook(() => useSafeAssist());
    const creation = hook.result.current.createSession();
    await waitFor(() => expect(state.rpc).toHaveBeenCalledOnce());
    hook.unmount();
    resolveRpc?.({
      data: { id: "session-1", status: "active", dual_verified: false },
      error: null,
    });
    await creation;

    expect(state.channels).toHaveLength(0);
  });
});
