import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  allowed: true,
  userListener: null as ((announcement: { event: string | null }) => void) | null,
  managerListener: null as ((announcement: { event: string | null }) => void) | null,
  managerUnsubscribe: vi.fn(),
}));

vi.mock("@/lib/realtime/notification-hub.server", () => ({
  ensureListening: vi.fn(async () => true),
  subscribe: vi.fn((_userId: string, listener: typeof state.userListener) => {
    state.userListener = listener;
    return vi.fn();
  }),
  subscribeChatManager: vi.fn(async (listener: typeof state.managerListener) => {
    state.managerListener = listener;
    return state.managerUnsubscribe;
  }),
}));

vi.mock("@/lib/chat/manager-db.server", () => ({
  withChatPlatformDatabase: async (
    run: (
      query: (strings: TemplateStringsArray) => Promise<Array<{ allowed: boolean }>>,
    ) => unknown,
  ) => run(async () => [{ allowed: state.allowed }]),
}));

import { Route } from "./stream";

type Get = (context: { request: Request }) => Promise<Response>;
type RouteOptions = { server: { handlers: { GET: Get } } };
const getStream = (Route.options as typeof Route.options & RouteOptions).server.handlers.GET;

function makeRequest() {
  return new Request("https://softwarevala.net/api/notifications/stream", {
    headers: { Authorization: "Bearer test-token" },
  });
}

beforeEach(() => {
  state.allowed = true;
  state.userListener = null;
  state.managerListener = null;
  state.managerUnsubscribe.mockClear();
  vi.stubEnv("SUPABASE_URL", "https://auth.test");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ id: "user-1" }, { status: 200 })),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Chat Manager stream authorization", () => {
  it("closes the stream after periodic permission revocation", async () => {
    vi.useFakeTimers();
    const response = await getStream({ request: makeRequest() });
    const reader = response.body!.getReader();
    const initial = await reader.read();
    expect(new TextDecoder().decode(initial.value)).toContain("event: ready");

    state.allowed = false;
    await vi.advanceTimersByTimeAsync(60_000);

    let result = await reader.read();
    while (!result.done) result = await reader.read();
    expect(state.managerUnsubscribe).toHaveBeenCalledOnce();
  });

  it("checks access before forwarding every manager event", async () => {
    const response = await getStream({ request: makeRequest() });
    const reader = response.body!.getReader();
    await reader.read();
    await Promise.resolve();

    state.allowed = false;
    state.managerListener?.({ event: "chat.message" });
    await Promise.resolve();
    await Promise.resolve();

    expect((await reader.read()).done).toBe(true);
    expect(state.managerUnsubscribe).toHaveBeenCalledOnce();
  });

  it("signals clients to catch up when PostgreSQL restores LISTEN", async () => {
    const response = await getStream({ request: makeRequest() });
    const reader = response.body!.getReader();
    await reader.read();
    state.userListener?.({ event: "__reconnect__" });

    const reconnect = await reader.read();
    expect(new TextDecoder().decode(reconnect.value)).toContain("event: ready");
    await reader.cancel();
  });
});
