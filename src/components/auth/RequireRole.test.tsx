// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RequireRole } from "./RequireRole";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    auth: {
      onAuthStateChange: vi.fn(),
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/lib/i18n/use-translation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function roleQuery(result: { data: Array<{ role: string }> | null; error: Error | null }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockResolvedValue(result);
  supabaseMock.from.mockReturnValue(query);
}

function renderGate(children: ReactNode = <p>Private workspace</p>) {
  return render(<RequireRole role="finance">{children}</RequireRole>);
}

describe("RequireRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    supabaseMock.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders protected content only after the account role is verified", async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    roleQuery({ data: [{ role: "boss" }], error: null });

    renderGate();

    expect(await screen.findByText("Private workspace")).toBeTruthy();
    expect(supabaseMock.from).toHaveBeenCalledWith("user_roles");
  });

  it("shows a retryable verification error if the auth client is unavailable", async () => {
    supabaseMock.auth.onAuthStateChange
      .mockImplementationOnce(() => {
        throw new Error("Supabase environment is missing");
      })
      .mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      });
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    renderGate();

    expect(
      await screen.findByRole("heading", { name: "auth.access.verification_failed" }),
    ).toBeTruthy();
    expect(screen.queryByText("Private workspace")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "auth.access.retry" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "auth.access.restricted" })).toBeTruthy();
    });
    expect(screen.queryByText("Private workspace")).toBeNull();
  });

  it("does not treat role lookup failures as a verified denial or grant", async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    roleQuery({ data: null, error: new Error("Role service unavailable") });

    renderGate();

    expect(
      await screen.findByRole("heading", { name: "auth.access.verification_failed" }),
    ).toBeTruthy();
    expect(screen.queryByText("Private workspace")).toBeNull();
  });
});
