// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  const state: { domainError: Error | null } = { domainError: null };
  return { state, domain: vi.fn(), retry: vi.fn() };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "fixture-operator" } }) }));
vi.mock("@/hooks/useDemoOps", () => ({
  useOpsDemos: () => ({
    data: [
      {
        id: "demo1",
        title: "Fixture Demo",
        url: "https://demo.fixture.invalid",
        http_status: 200,
        last_health_check: null,
      },
    ],
    isLoading: false,
    error: null,
    refetch: mocks.retry,
  }),
  useOpsDeployments: () => ({
    data: [{ demo_id: "demo1", state: "deployed" }],
    isLoading: false,
    error: null,
    refetch: mocks.retry,
  }),
  useOpsDomain: (hostname: string) => {
    mocks.domain(hostname);
    return {
      data: { hostname, status: "live" },
      error: mocks.state.domainError,
      isFetching: false,
      refetch: mocks.retry,
    };
  },
  useOpsActions: vi.fn(),
}));
import { OpsDomainPanel } from "./OpsBrandingDomainPanels";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.domainError = null;
});
afterEach(cleanup);

describe("domain panel source wiring", () => {
  it("preserves the real deployment record and reads domain data by selected hostname", () => {
    render(<OpsDomainPanel />);
    expect(mocks.domain).toHaveBeenCalledWith("demo.fixture.invalid");
    expect(screen.getByText("deployed")).toBeTruthy();
    expect(screen.getByText("Mapped domain: demo.fixture.invalid (live)")).toBeTruthy();
    expect(screen.getByText("not recorded")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("surfaces a domain query failure instead of rendering a successful check", () => {
    mocks.state.domainError = new Error("Fixture domain lookup refused");
    render(<OpsDomainPanel />);
    expect(screen.getByText(/Fixture domain lookup refused/)).toBeTruthy();
    expect(screen.queryByText("Mapped domain: demo.fixture.invalid (live)")).toBeNull();
  });
});
