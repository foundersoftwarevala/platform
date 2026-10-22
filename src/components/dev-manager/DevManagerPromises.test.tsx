// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SLARiskDTO, TaskDTO } from "@/lib/dev-manager.types";
import type { CanonicalTaskDTO } from "@/lib/tasks/types";

const mocks = vi.hoisted(() => ({
  tasks: [] as TaskDTO[],
  canonicalTasks: [] as CanonicalTaskDTO[],
  risks: [] as SLARiskDTO[],
  mutate: vi.fn(),
  downloadCsv:
    vi.fn<
      (
        name: string,
        rows: Record<string, unknown>[],
        columns: { key: string; label: string }[],
      ) => void
    >(),
}));
vi.mock("@/hooks/useDevManagerData", () => ({
  useDeliveryOverview: () => ({
    data: { tasks: mocks.tasks, risks: mocks.risks, developers: [] },
    isLoading: false,
    error: null,
  }),
  useReassignTask: () => ({ mutate: mocks.mutate, isPending: false }),
  useEscalateTask: () => ({ mutate: mocks.mutate, isPending: false }),
  useAllDeveloperTasks: () => ({ data: [], isLoading: false, error: null }),
  useCanonicalTasks: () => ({ data: mocks.canonicalTasks, isLoading: false, error: null }),
  useCanonicalTaskAssignees: () => ({ data: [], isLoading: false, error: null }),
  useCreateCanonicalTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelCanonicalTask: () => ({ mutate: mocks.mutate, isPending: false }),
  useReopenCanonicalTask: () => ({ mutate: mocks.mutate, isPending: false }),
}));
vi.mock("@/components/developer-management/DMPromptDialog", () => ({
  useDMPrompt: () => ({ ask: vi.fn() }),
}));
vi.mock("@/lib/i18n/use-translation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/use-translation")>()),
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      key === "devmanager.tasks.line_module"
        ? `Promise-linked: ${values?.project}`
        : key === "devmanager.tasks.line"
          ? (values?.project ?? key)
          : key,
    formatDate: String,
  }),
}));
vi.mock("@/lib/export-csv", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/export-csv")>()),
  downloadCsv: mocks.downloadCsv,
}));
import { toCsv } from "@/lib/export-csv";
import DevManagerActiveTasksView from "./DevManagerActiveTasksView";
import DevManagerSLARiskAlerts from "./DevManagerSLARiskAlerts";
import { DMTaskManagement } from "@/components/developer-management/screens/DMTaskManagement";

const P1 = "30000000-0000-4000-8000-000000000001";
const P2 = "30000000-0000-4000-8000-000000000002";
beforeEach(() => {
  mocks.downloadCsv.mockReset();
  mocks.tasks = [
    {
      id: "10000000-0000-4000-8000-000000000001",
      code: "TSK-FIXTURE",
      title: "Isolated promise UI fixture",
      developerId: null,
      assignedTo: "UNASSIGNED",
      priority: "medium",
      status: "pending",
      dueDate: "2026-10-16T03:00:00Z",
      slaHoursRemaining: 3,
      promiseIds: [P1, P2],
    },
  ];
  mocks.canonicalTasks = [
    {
      id: "20000000-0000-4000-8000-000000000001",
      developerId: "30000000-0000-4000-8000-000000000003",
      developerRecordId: null,
      developerLabel: "Isolated developer fixture",
      title: "Canonical task fixture",
      description: null,
      status: "assigned",
      paymentStatus: "pending",
      dueAt: null,
      deadlineAt: null,
      verifiedAt: null,
      paidAt: null,
      priority: "medium",
      artifacts: null,
      submissionNotes: null,
      managerNotes: null,
      createdAt: "2026-10-16T00:00:00.000Z",
      updatedAt: "2026-10-16T00:00:00.000Z",
    },
  ];
  mocks.risks = [
    {
      taskId: mocks.tasks[0].id,
      code: "TSK-FIXTURE",
      title: mocks.tasks[0].title,
      assignee: "UNASSIGNED",
      promiseIds: [P1, P2],
      hoursRemaining: 3,
      riskLevel: "high",
      escalatedAt: null,
    },
  ];
});
afterEach(cleanup);

describe("Developer Manager plural promise consumers", () => {
  it("renders tasks from the canonical manager task query", () => {
    render(<DMTaskManagement />);
    expect(screen.getByText("Canonical task fixture")).toBeTruthy();
  });

  it("does not fabricate promise links on canonical tasks", () => {
    render(<DMTaskManagement />);
    expect(screen.getByText("Canonical task fixture")).toBeTruthy();
    expect(screen.queryByText(/^Promise-linked:/)).toBeNull();
  });

  it("renders every linked promise ID on an active task", () => {
    render(<DevManagerActiveTasksView />);
    expect(screen.getByText(P1)).toBeTruthy();
    expect(screen.getByText(P2)).toBeTruthy();
  });

  it("renders every linked promise ID on its SLA risk", () => {
    render(<DevManagerSLARiskAlerts />);
    expect(screen.getByText(P1)).toBeTruthy();
    expect(screen.getByText(P2)).toBeTruthy();
  });

  it("exports all IDs through the real CSV serializer under a plural column", () => {
    render(<DevManagerActiveTasksView />);
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    expect(mocks.downloadCsv).toHaveBeenCalledOnce();
    const [name, rows, columns] = mocks.downloadCsv.mock.calls[0];
    expect(name).toBe("active-tasks");
    expect(rows[0].promiseIds).toBe(`${P1}; ${P2}`);
    expect(columns).toContainEqual({ key: "promiseIds", label: "Promise IDs" });
    const csv = toCsv(rows, columns);
    expect(csv.split("\n")[0]).toContain("Promise IDs");
    expect(csv.split("\n")[1]).toContain(`${P1}; ${P2}`);
    expect(mocks.tasks[0].promiseIds).toEqual([P1, P2]);
  });

  it("keeps no-link tasks visible and exports an empty cell without a fake promise", () => {
    mocks.tasks[0].promiseIds = [];
    render(<DevManagerActiveTasksView />);
    expect(screen.getByText("Isolated promise UI fixture")).toBeTruthy();
    expect(screen.queryByText(P1)).toBeNull();
    expect(screen.queryByText(P2)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    expect(mocks.downloadCsv.mock.calls[0][1][0].promiseIds).toBe("");
  });

  it("keeps no-link SLA risks visible without fabricating a primary promise", () => {
    mocks.risks[0].promiseIds = [];
    render(<DevManagerSLARiskAlerts />);
    expect(screen.getByText("Isolated promise UI fixture")).toBeTruthy();
    expect(screen.queryByText(P1)).toBeNull();
    expect(screen.queryByText(P2)).toBeNull();
  });
});
