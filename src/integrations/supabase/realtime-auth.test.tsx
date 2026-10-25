// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRealtimeAuth } from "./realtime-auth";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { getClient: vi.fn() },
}));

vi.mock("./client", () => ({
  get supabase() {
    return supabaseMock.getClient();
  },
}));

function RealtimeAuthHarness() {
  useRealtimeAuth();
  return null;
}

describe("useRealtimeAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps the app mounted and logs an explicit error when local auth is not configured", async () => {
    const missingConfig = new Error("Missing Supabase environment variables");
    supabaseMock.getClient.mockImplementation(() => {
      throw missingConfig;
    });

    const { container } = render(<RealtimeAuthHarness />);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "[realtime] authentication client is unavailable",
        missingConfig,
      );
    });
    expect(container).toBeTruthy();
  });

  it("sets the signed-in token on realtime and unsubscribes on unmount", async () => {
    const unsubscribe = vi.fn();
    const setAuth = vi.fn();
    const onAuthStateChange = vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe } },
    });
    supabaseMock.getClient.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "session-token" } },
        }),
        onAuthStateChange,
      },
      realtime: { setAuth },
    });

    const { unmount } = render(<RealtimeAuthHarness />);

    await waitFor(() => expect(setAuth).toHaveBeenCalledWith("session-token"));
    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
