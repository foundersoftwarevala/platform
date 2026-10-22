// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
  run: vi.fn(),
}));

vi.mock("@/lib/reseller-reports.functions", () => ({
  listResellerReports: mocks.list,
  saveResellerReport: mocks.save,
  runResellerReport: mocks.run,
}));

import { ResellerReports } from "./ResellerReports";

function renderReports() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ResellerReports />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  mocks.list.mockReset();
  mocks.save.mockReset();
  mocks.run.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Reseller Manager Reports", () => {
  it("saves a report definition and runs it against the database endpoint", async () => {
    mocks.list
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "f6b45a11-29a0-4c2e-b3bb-234a0c89d168",
          name: "October sales",
          type: "sales",
          fromDate: "2026-10-01",
          toDate: "2026-10-19",
          lastRunAt: null,
          lastResult: null,
          updatedAt: "2026-10-19T00:00:00.000Z",
        },
      ])
      .mockResolvedValue([
        {
          id: "f6b45a11-29a0-4c2e-b3bb-234a0c89d168",
          name: "October sales",
          type: "sales",
          fromDate: "2026-10-01",
          toDate: "2026-10-19",
          lastRunAt: "2026-10-19T12:00:00.000Z",
          lastResult: {
            columns: ["date", "reseller", "grossAmount"],
            rows: [{ date: "2026-10-10", reseller: "Example Partner", grossAmount: 120 }],
            rowCount: 1,
            totalsByCurrency: [{ currency: "USD", grossAmount: 120, commissionAmount: 24 }],
          },
          updatedAt: "2026-10-19T12:00:00.000Z",
        },
      ]);
    mocks.save.mockResolvedValue({ id: "f6b45a11-29a0-4c2e-b3bb-234a0c89d168" });
    mocks.run.mockResolvedValue({
      id: "f6b45a11-29a0-4c2e-b3bb-234a0c89d168",
      lastRunAt: "2026-10-19T12:00:00.000Z",
      result: {
        columns: ["date", "reseller", "grossAmount"],
        rows: [{ date: "2026-10-10", reseller: "Example Partner", grossAmount: 120 }],
        rowCount: 1,
        totalsByCurrency: [{ currency: "USD", grossAmount: 120, commissionAmount: 24 }],
      },
    });
    renderReports();

    fireEvent.click(await screen.findByRole("button", { name: "New Report" }));
    fireEvent.change(screen.getByLabelText("Report name"), { target: { value: "October sales" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith({
        data: {
          name: "October sales",
          type: "sales",
          fromDate: expect.any(String),
          toDate: expect.any(String),
        },
      }),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Run Now" }));
    await waitFor(() =>
      expect(mocks.run).toHaveBeenCalledWith({
        data: { id: "f6b45a11-29a0-4c2e-b3bb-234a0c89d168" },
      }),
    );
    expect(await screen.findByText("1")).toBeTruthy();
  });

  it("exports the last saved result to CSV and disables export until a run exists", async () => {
    mocks.list.mockResolvedValue([
      {
        id: "f6b45a11-29a0-4c2e-b3bb-234a0c89d168",
        name: "Quarterly commissions",
        type: "commissions",
        fromDate: "2026-07-01",
        toDate: "2026-09-30",
        lastRunAt: null,
        lastResult: null,
        updatedAt: "2026-10-19T00:00:00.000Z",
      },
      {
        id: "f6b45a11-29a0-4c2e-b3bb-234a0c89d169",
        name: "Sales export",
        type: "sales",
        fromDate: "2026-10-01",
        toDate: "2026-10-19",
        lastRunAt: "2026-10-19T12:00:00.000Z",
        lastResult: {
          columns: ["reseller", "grossAmount"],
          rows: [{ reseller: "=1+1", grossAmount: 125 }],
          rowCount: 1,
          totalsByCurrency: [],
        },
        updatedAt: "2026-10-19T12:00:00.000Z",
      },
    ]);
    const createObjectURL = vi.fn<typeof URL.createObjectURL>(() => "blob:reseller-report");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderReports();

    const exportButtons = await screen.findAllByRole("button", { name: "Export" });
    expect((exportButtons[0] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(exportButtons[1]);

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    const exportedBlob = createObjectURL.mock.calls[0]?.[0];
    expect(exportedBlob).toBeInstanceOf(Blob);
    if (!(exportedBlob instanceof Blob)) throw new Error("Expected a CSV Blob.");
    expect(await exportedBlob.text()).toContain("'=1+1");
    expect(await exportedBlob.text()).toContain("grossAmount");
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:reseller-report");
  });
});
