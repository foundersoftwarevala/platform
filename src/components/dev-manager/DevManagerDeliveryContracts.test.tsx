// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeliveryOverviewDTO, TaskDTO } from "@/lib/dev-manager.types";
import DevManagerActiveTasksView from "./DevManagerActiveTasksView";
import DevManagerSLARiskAlerts from "./DevManagerSLARiskAlerts";
import DevManagerBlockedTasks from "./DevManagerBlockedTasks";
import DevManagerPerformanceSnapshot from "./DevManagerPerformanceSnapshot";

const mocks = vi.hoisted(() => {
  const state: { overview: DeliveryOverviewDTO | null } = { overview: null };
  return { state, escalate: vi.fn(), reassign: vi.fn(), csv: vi.fn() };
});
vi.mock("@/hooks/useDevManagerData", () => ({
  useDeliveryOverview: () => ({ data: mocks.state.overview, isLoading: false, error: null }),
  useEscalateTask: () => ({ mutate: mocks.escalate, isPending: false }),
  useReassignTask: () => ({ mutate: mocks.reassign, isPending: false }),
}));
vi.mock("@/lib/export-csv", () => ({ downloadCsv: mocks.csv }));

function overview(): DeliveryOverviewDTO {
  return {
    generatedAt: "2026-10-14T18:00:00Z",
    developers: [],
    tasks: [],
    risks: [],
    blocked: [],
    escalations: [],
    notes: [],
    performance: [],
    taskOptions: [],
    stats: { developers: 0, activeTasks: 0, atRisk: 0, blocked: 0, escalations: 0 },
    autoEscalated: 0,
  };
}
const task: TaskDTO = {
  id: "task1",
  code: "TSK-1",
  title: "Fixture task",
  developerId: null,
  assignedTo: "UNASSIGNED",
  priority: "medium",
  status: "blocked",
  dueDate: null,
  slaHoursRemaining: 1,
  promiseId: null,
  promiseIds: ["PROMISE-FIXTURE-1", "PROMISE-FIXTURE-2"],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.overview = overview();
});
afterEach(cleanup);

describe("Developer Manager delivery view contracts", () => {
  it.each([
    { name: "active tasks", Component: DevManagerActiveTasksView },
    { name: "SLA risks", Component: DevManagerSLARiskAlerts },
  ])("shows every linked promise in $name", ({ Component }) => {
    const data = overview();
    data.tasks = [task];
    data.risks = [
      {
        taskId: task.id,
        code: task.code,
        title: task.title,
        assignee: task.assignedTo,
        promiseId: null,
        promiseIds: task.promiseIds,
        hoursRemaining: 1,
        riskLevel: "critical",
        escalatedAt: null,
      },
    ];
    mocks.state.overview = data;
    render(<Component />);
    expect(screen.getByText("PROMISE-FIXTURE-1")).toBeTruthy();
    expect(screen.getByText("PROMISE-FIXTURE-2")).toBeTruthy();
  });

  it("exports every promise ID rather than choosing an arbitrary one", () => {
    const data = overview();
    data.tasks = [task];
    mocks.state.overview = data;
    render(<DevManagerActiveTasksView />);
    fireEvent.click(screen.getByRole("button", { name: /export|csv/i }));
    expect(mocks.csv).toHaveBeenCalledWith(
      "active-tasks",
      expect.arrayContaining([expect.objectContaining({ promiseIds: task.promiseIds })]),
      expect.arrayContaining([{ key: "promiseIds", label: "Promise IDs" }]),
    );
  });

  it("keeps unknown blocked duration explicit and allows honest manual escalation", () => {
    const data = overview();
    data.blocked = [
      {
        taskId: task.id,
        code: task.code,
        title: task.title,
        assignee: task.assignedTo,
        blockedReason: "No reason recorded",
        blockedSince: null,
        blockedHours: null,
        autoEscalateThreshold: 24,
        escalated: false,
      },
    ];
    mocks.state.overview = data;
    render(<DevManagerBlockedTasks />);
    expect(screen.getByText("Blocked duration not recorded")).toBeTruthy();
    expect(screen.getByText("Auto-escalation awaits a recorded blocked time")).toBeTruthy();
    expect(screen.queryByText("ESCALATED")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Manual Escalate" }));
    expect(mocks.escalate).toHaveBeenCalledWith({
      taskId: task.id,
      reason: "Manual escalation: TSK-1 blocked — No reason recorded",
    });
  });

  it("does not label a threshold crossing as a recorded escalation", () => {
    const data = overview();
    data.blocked = [
      {
        taskId: task.id,
        code: task.code,
        title: task.title,
        assignee: task.assignedTo,
        blockedReason: "Fixture blocker",
        blockedSince: "2026-10-13T17:00:00Z",
        blockedHours: 25,
        autoEscalateThreshold: 24,
        escalated: false,
      },
    ];
    mocks.state.overview = data;
    render(<DevManagerBlockedTasks />);
    expect(screen.getByText("Auto-escalation pending")).toBeTruthy();
    expect(screen.queryByText("ESCALATED")).toBeNull();
  });

  it("shows unscored quality instead of a fabricated zero", () => {
    const data = overview();
    data.performance = [
      {
        valaId: "DEV-FIXTURE",
        completedTasks: 1,
        onTimeRate: 100,
        avgCompletionTime: 2,
        qualityScore: null,
        trend: "stable",
      },
    ];
    mocks.state.overview = data;
    render(<DevManagerPerformanceSnapshot />);
    expect(screen.getAllByText("Not scored")).toHaveLength(2);
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
  });

  it("includes genuine zero scores and excludes unscored developers from the average", () => {
    const data = overview();
    data.performance = [0, 100, null].map((qualityScore, index) => ({
      valaId: `DEV-FIXTURE-${index}`,
      completedTasks: 1,
      onTimeRate: 100,
      avgCompletionTime: 2,
      qualityScore,
      trend: "stable",
    }));
    mocks.state.overview = data;
    render(<DevManagerPerformanceSnapshot />);
    expect(screen.getByText("50")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("Not scored")).toBeTruthy();
  });
});
