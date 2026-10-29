// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  roles: vi.fn(),
  authListener: null as ((event: string, session: { user: { id: string } } | null) => void) | null,
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/lib/i18n/use-translation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.session,
      onAuthStateChange: (listener: typeof mocks.authListener) => {
        mocks.authListener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
    from: () => ({ select: () => ({ eq: mocks.roles }) }),
  },
}));

import { RequireRole } from "./RequireRole";

const savedSession = { data: { session: { user: { id: "user-1" } } }, error: null };

beforeEach(() => {
  mocks.session.mockReset();
  mocks.roles.mockReset();
  mocks.navigate.mockReset();
  mocks.authListener = null;
});
afterEach(cleanup);

describe("RequireRole session restoration", () => {
  it("uses the persisted session and allows its verified role", async () => {
    mocks.session.mockResolvedValue(savedSession);
    mocks.roles.mockResolvedValue({ data: [{ role: "vendor" }], error: null });

    render(
      <RequireRole role="vendor">
        <p>Vendor workspace</p>
      </RequireRole>,
    );

    expect(await screen.findByText("Vendor workspace")).toBeTruthy();
    expect(mocks.session).toHaveBeenCalledOnce();
    expect(mocks.roles).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("does not report a restriction when session or role verification temporarily fails", async () => {
    mocks.session.mockResolvedValue(savedSession);
    mocks.roles
      .mockResolvedValueOnce({ data: null, error: new Error("temporary role API outage") })
      .mockResolvedValueOnce({ data: [{ role: "vendor" }], error: null });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <RequireRole role="vendor">
        <p>Vendor workspace</p>
      </RequireRole>,
    );

    expect(await screen.findByText(/Your session has not been rejected/)).toBeTruthy();
    expect(screen.queryByText("auth.access.restricted")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Vendor workspace")).toBeTruthy();
  });

  it("shows access restricted only after session restoration confirms signed out", async () => {
    mocks.session.mockResolvedValue({ data: { session: null }, error: null });

    render(
      <RequireRole role="vendor">
        <p>Vendor workspace</p>
      </RequireRole>,
    );

    expect(await screen.findByText("auth.access.restricted")).toBeTruthy();
    expect(mocks.roles).not.toHaveBeenCalled();
  });
});
