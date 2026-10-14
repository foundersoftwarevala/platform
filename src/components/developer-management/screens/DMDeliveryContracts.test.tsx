// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeliveryOverviewDTO, RegistryDeveloperDTO, TaskDTO } from "@/lib/dev-manager.types";
import DMAlertsEscalation from "./DMAlertsEscalation";
import DMDeveloperDashboard from "./DMDeveloperDashboard";
import DMPerformanceKPI from "./DMPerformanceKPI";
import DMSprintMilestone from "./DMSprintMilestone";
import DMTaskManagement from "./DMTaskManagement";

const mocks = vi.hoisted(() => {
  const state: { overview: DeliveryOverviewDTO | null; registry: RegistryDeveloperDTO[] } = {
    overview: null,
    registry: [],
  };
  return { state };
});
vi.mock("@/hooks/useDevManagerData", () => ({
  useDeliveryOverview: () => ({ data: mocks.state.overview, isLoading: false, isError: false }),
  useDeveloperRegistry: () => ({ data: mocks.state.registry, isLoading: false, error: null }),
  useAllDeveloperTasks: () => ({ data: [], isLoading: false, error: null }),
  useCodeSubmissions: () => ({ data: [], isLoading: false, isError: false }),
  useDeveloperActivity: () => ({ data: [], isLoading: false, isError: false }),
  useUpdateEscalation: () => ({ mutate: vi.fn(), isPending: false }),
  useEscalateTask: () => ({ mutate: vi.fn(), isPending: false }),
  useReassignTask: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/language-catalog", async () => {
  const { DEVMANAGER_MESSAGES } = await import("@/lib/i18n/messages/devmanager");
  const { formatMessage } = await import("@/lib/i18n/format");
  const messages = new Map<string, string>(
    Object.entries(DEVMANAGER_MESSAGES).map(([key, value]) => [
      key,
      typeof value === "string" ? value : value[0],
    ]),
  );
  return {
    useLanguage: () => ({
      language: "en",
      translate: (key: string, values: Record<string, unknown> = {}) => {
        const message = messages.get(key);
        if (message == null) throw new Error(`Missing fixture message: ${key}`);
        return formatMessage(message, values, "en");
      },
    }),
  };
});

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
function performance(scores: (number | null)[]): DeliveryOverviewDTO["performance"] {
  return scores.map((qualityScore, index) => ({
    valaId: `DEV-FIXTURE-${index}`,
    completedTasks: 1,
    onTimeRate: 100,
    avgCompletionTime: 2,
    qualityScore,
    trend: "down",
  }));
}
function blockers(): DeliveryOverviewDTO["blocked"] {
  return [null, 12].map((blockedHours, index) => ({
    taskId: `task-${index}`,
    code: `TSK-${index}`,
    title: `Fixture blocker ${index}`,
    assignee: "DEV-FIXTURE",
    blockedReason: "Fixture reason",
    blockedSince: blockedHours == null ? null : "2026-10-14T06:00:00Z",
    blockedHours,
    autoEscalateThreshold: 24,
    escalated: false,
  }));
}
beforeEach(() => {
  mocks.state.overview = overview();
  mocks.state.registry = [];
});
afterEach(cleanup);

describe("Localized Developer Manager delivery contracts", () => {
  it("includes genuine zero and excludes unscored quality in the dashboard average", () => {
    const data = overview();
    data.performance = performance([0, 100, null]);
    mocks.state.overview = data;
    render(<DMDeveloperDashboard onNavigate={vi.fn()} />);
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("leaves the dashboard quality unknown when no developer has a score", () => {
    const data = overview();
    data.performance = performance([null]);
    mocks.state.overview = data;
    render(<DMDeveloperDashboard onNavigate={vi.fn()} />);
    expect(screen.getByRole("button", { name: /AI Quality Score.*—/ }).textContent).toContain("—");
  });

  it("preserves zero quality and omits an unscored quality progress bar", () => {
    const data = overview();
    data.performance = performance([0, 100, null]);
    mocks.state.overview = data;
    mocks.state.registry = data.performance.map((row, index) => ({
      id: `developer-${index}`,
      valaId: row.valaId,
      fullName: row.valaId,
      email: `developer-${index}@fixture.invalid`,
      status: "active",
      availability: "available",
      skillTags: [],
      maxCapacity: 3,
      activeTasks: 0,
      onboardingCompleted: true,
      joinedAt: null,
    }));
    render(<DMPerformanceKPI />);
    expect(screen.getByText("50%")).toBeTruthy();
    const zeroRow = screen.getByText("DEV-FIXTURE-0").closest(".space-y-3");
    const unscoredRow = screen.getByText("DEV-FIXTURE-2").closest(".space-y-3");
    if (!(zeroRow instanceof HTMLElement) || !(unscoredRow instanceof HTMLElement)) {
      throw new Error("Missing individual performance rows");
    }
    expect(within(zeroRow).getByRole("progressbar", { name: "AI Score" })).toBeTruthy();
    expect(within(unscoredRow).queryByRole("progressbar", { name: "AI Score" })).toBeNull();
    expect(within(zeroRow).getByText("0%")).toBeTruthy();
  });

  it("does not turn missing alert quality or blocker duration into zero", () => {
    const data = overview();
    data.performance = performance([0, null]);
    data.blocked = blockers();
    mocks.state.overview = data;
    render(<DMAlertsEscalation />);
    expect(screen.getByText("Blocked duration not recorded")).toBeTruthy();
    expect(screen.getByText("blocked 12 h")).toBeTruthy();
    expect(screen.getByText("On-time rate 100%, quality 0%, trending down")).toBeTruthy();
    expect(screen.getByText("On-time rate 100%, quality not scored, trending down")).toBeTruthy();
    expect(screen.queryByText("blocked 0 h")).toBeNull();
  });

  it("keeps unknown and recorded blocker durations distinct in sprint risks", () => {
    const data = overview();
    data.blocked = blockers();
    mocks.state.overview = data;
    render(<DMSprintMilestone />);
    expect(screen.getByText(/Blocked duration not recorded/)).toBeTruthy();
    expect(screen.getByText(/12 h blocked/)).toBeTruthy();
    expect(screen.queryByText(/0 h blocked/)).toBeNull();
  });

  it("retains the promise module for tasks with multiple linked promises", () => {
    const data = overview();
    const task: TaskDTO = {
      id: "task-fixture",
      code: "TSK-FIXTURE",
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
    data.tasks = [task];
    mocks.state.overview = data;
    render(<DMTaskManagement />);
    expect(screen.getByText(/Fixture task.*promise/i)).toBeTruthy();
  });
});
