// @vitest-environment jsdom

import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userId: "user-a" as string | null,
  authListener: null as ((event: AuthChangeEvent, session: Session | null) => void) | null,
  rejectedTable: null as string | null,
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mocks.userId ? { id: mocks.userId } : null },
      })),
      onAuthStateChange: vi.fn(
        (listener: (event: AuthChangeEvent, session: Session | null) => void) => {
          mocks.authListener = listener;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        },
      ),
    },
    from: mocks.from,
  },
}));

import { FranchiseHome } from "@/components/dashboard/franchise/FranchiseHome";
import { reset, useFranchise } from "@/lib/franchise-store";

const seedDataByTable: Record<string, Record<string, unknown>[]> = {
  franchises: [{ id: "franchise-a" }],
  franchise_users: [],
  franchise_branches: [
    { id: "branch-a", name: "Old Account Branch", status: "active" },
    { id: "branch-b", name: "Second Branch", status: "active" },
  ],
  franchise_leads: [{ id: "lead-a", company: "Old Account Lead", stage: "new" }],
  franchise_employees: [{ id: "employee-a", full_name: "Old Account Employee", status: "active" }],
  franchise_royalties: [
    {
      id: "royalty-a",
      period: "2026-06",
      royalty_due: 100,
      paid_amount: 100,
      status: "paid",
    },
    {
      id: "royalty-b",
      period: "2026-07",
      royalty_due: 250,
      paid_amount: 50,
      status: "pending",
    },
  ],
  franchise_performance: [{ period: "2026-06", revenue: 1000 }],
};
const dataByTable: Record<string, Record<string, unknown>[]> = structuredClone(seedDataByTable);

function sessionFor(id: string): Session {
  return {
    access_token: "",
    refresh_token: "",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
    },
  };
}

function StoreProbe() {
  const {
    branches,
    leads,
    employees,
    payments,
    revenueByPeriod,
    error,
    totalBranches,
    totalLeads,
    totalEmployees,
    totalRoyaltyDue,
    totalPaidAmount,
  } = useFranchise();
  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "branch" }, branches.map((row) => row.name).join(",")),
    createElement(
      "span",
      { "data-testid": "counts" },
      [branches, leads, employees, payments, revenueByPeriod].map((rows) => rows.length).join(","),
    ),
    createElement(
      "span",
      { "data-testid": "totals" },
      [totalBranches, totalLeads, totalEmployees, totalRoyaltyDue, totalPaidAmount].join(","),
    ),
    error && createElement("span", { role: "alert" }, error),
  );
}

function notifyAuth(event: AuthChangeEvent, id: string | null) {
  act(() => {
    mocks.authListener?.(event, id ? sessionFor(id) : null);
  });
}

describe("franchise store session changes", () => {
  beforeEach(() => {
    mocks.userId = "user-a";
    mocks.rejectedTable = null;
    mocks.authListener?.("INITIAL_SESSION", sessionFor("user-a"));
    for (const table of Object.keys(seedDataByTable)) {
      dataByTable[table] = structuredClone(seedDataByTable[table] ?? []);
    }
    mocks.from.mockImplementation((table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        order: () => query,
        then: (
          resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown,
          reject?: (reason: Error) => unknown,
        ) =>
          Promise.resolve()
            .then(() => {
              if (mocks.rejectedTable === table) throw new Error(`Read failed: ${table}`);
              return { data: dataByTable[table] ?? [], error: null };
            })
            .then(resolve, reject),
      };
      return query;
    });
    reset();
  });

  afterEach(() => {
    cleanup();
    reset();
    vi.clearAllMocks();
  });

  it("clears all franchise rows when the signed-in user changes", async () => {
    render(createElement(StoreProbe));
    expect(await screen.findByTestId("branch")).toHaveTextContent("Old Account Branch");
    expect(screen.getByTestId("counts")).toHaveTextContent("2,1,1,2,1");
    expect(screen.getByTestId("totals")).toHaveTextContent("2,1,1,350,150");

    mocks.userId = "user-b";
    notifyAuth("SIGNED_IN", "user-b");

    expect(screen.getByTestId("branch")).not.toHaveTextContent("Old Account Branch");
    expect(screen.getByTestId("counts")).toHaveTextContent("0,0,0,0,0");
  });

  it("shows a retry-only error state after the new session read fails", async () => {
    render(createElement(FranchiseHome, { onOpen: vi.fn() }));
    expect(await screen.findByText("Old Account Branch")).toBeInTheDocument();

    mocks.userId = "user-b";
    mocks.rejectedTable = "franchises";
    notifyAuth("SIGNED_IN", "user-b");

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText("Old Account Branch")).not.toBeInTheDocument();
    expect(screen.queryByText("Network revenue")).not.toBeInTheDocument();
  });

  it("retries the failed read from the error state", async () => {
    mocks.userId = "user-b";
    mocks.rejectedTable = "franchises";
    render(createElement(FranchiseHome, { onOpen: vi.fn() }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load");

    mocks.rejectedTable = null;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText("Old Account Branch")).toBeInTheDocument());
  });

  it("aggregates the KPI values from franchise rows", async () => {
    render(createElement(FranchiseHome, { onOpen: vi.fn() }));

    expect(await screen.findByText("Old Account Branch")).toBeInTheDocument();
    expect(screen.getByTestId("franchise-kpi-branches")).toHaveTextContent("Branches2");
    expect(screen.getByTestId("franchise-kpi-royalty-due")).toHaveTextContent("Royalty due350");
    expect(screen.getByTestId("franchise-kpi-paid-amount")).toHaveTextContent("Paid amount150");
  });

  it("shows dashes instead of zero when KPI arrays are empty", async () => {
    dataByTable.franchise_branches = [];
    dataByTable.franchise_leads = [];
    dataByTable.franchise_employees = [];
    dataByTable.franchise_royalties = [];
    render(createElement(FranchiseHome, { onOpen: vi.fn() }));

    await waitFor(() => {
      expect(screen.getByTestId("franchise-kpi-branches")).toHaveTextContent("Branches—");
      expect(screen.getByTestId("franchise-kpi-royalty-due")).toHaveTextContent("Royalty due—");
      expect(screen.getByTestId("franchise-kpi-paid-amount")).toHaveTextContent("Paid amount—");
    });
  });

  it("renders KPI skeletons while the initial load is pending", () => {
    render(createElement(FranchiseHome, { onOpen: vi.fn() }));

    expect(screen.getByLabelText("Loading Branches")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading Royalty due")).toBeInTheDocument();
  });
});
