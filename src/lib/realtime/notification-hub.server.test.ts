import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  onListen: {} as Record<string, () => void>,
  notification: null as ((payload: string) => void) | null,
}));

vi.mock("@/lib/seo/seo-store.server", () => ({
  deploymentSetting: () => "postgres://localhost/sv_platform",
}));

vi.mock("postgres", () => {
  const sql = Object.assign(() => Promise.resolve([{ announces: true, db: "sv_platform" }]), {
    listen: vi.fn(
      async (channel: string, callback: (payload: string) => void, onlisten?: () => void) => {
        if (channel === "sv_user_notification") state.notification = callback;
        if (onlisten) state.onListen[channel] = onlisten;
        onlisten?.();
        return { unsubscribe: vi.fn() };
      },
    ),
    end: vi.fn(async () => {}),
  });
  return { default: vi.fn(() => sql) };
});

describe("notification hub reconnect catch-up", () => {
  beforeEach(() => {
    vi.resetModules();
    state.onListen = {};
    state.notification = null;
  });

  it("signals active streams after PostgreSQL restores the LISTEN subscription", async () => {
    const { ensureListening, subscribe, subscribeChatManager } =
      await import("./notification-hub.server");
    const listener = vi.fn();
    const managerListener = vi.fn();
    expect(await ensureListening()).toBe(true);
    subscribe("user-1", listener);
    await subscribeChatManager(managerListener);

    state.onListen.sv_user_notification?.();
    expect(listener).not.toHaveBeenCalled();
    expect(managerListener).not.toHaveBeenCalled();

    state.onListen.sv_chat_manager?.();

    expect(listener).toHaveBeenCalledWith({
      id: null,
      user_id: null,
      event: "__reconnect__",
    });
    expect(managerListener).toHaveBeenCalledWith({
      id: null,
      user_id: null,
      event: "__reconnect__",
    });
    expect(state.notification).toBeTypeOf("function");
  });
});
