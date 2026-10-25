// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./useAuth";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { getClient: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    return supabaseMock.getClient();
  },
}));

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps the app renderable and logs a setup error when auth is not configured", () => {
    const missingConfig = new Error("Missing Supabase environment variables");
    supabaseMock.getClient.mockImplementation(() => {
      throw missingConfig;
    });

    render(
      <AuthProvider>
        <p>Protected routes decide access separately</p>
      </AuthProvider>,
    );

    expect(screen.getByText("Protected routes decide access separately")).toBeTruthy();
    expect(console.error).toHaveBeenCalledWith(
      "[auth] authentication client is unavailable",
      missingConfig,
    );
  });
});
