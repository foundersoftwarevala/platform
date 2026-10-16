// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { BlockedTaskDTO } from "@/lib/dev-manager.types";

const mocks = vi.hoisted(() => ({
  blocked: {
    taskId: "10000000-0000-4000-8000-000000000001",
    code: "TSK-1000",
    title: "Blocked fixture",
    assignee: "DEV-FIXTURE",
    blockedReason: "Access needed",
    blockedSince: null,
    blockedHours: null,
    autoEscalateThreshold: 24,
    escalated: false,
  } as BlockedTaskDTO,
}));
vi.mock("@/hooks/useDevManagerData", () => ({
  useDeliveryOverview: () => ({
    data: { blocked: [mocks.blocked], risks: [], performance: [], escalations: [] },
    isLoading: false,
    isError: false,
  }),
  useUpdateEscalation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("../DMPromptDialog", () => ({ useDMPrompt: () => vi.fn() }));
vi.mock("@/lib/i18n/use-translation", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { hours?: string }) =>
      key === "devmanager.common.blocked_duration_unknown"
        ? "Blocked duration unavailable; no verified history"
        : key.endsWith("hours_blocked") || key.endsWith("blocked_for")
          ? `${values?.hours} h blocked`
          : key,
    formatNumber: String,
    formatDate: String,
  }),
  richText: (_template: string, values: Record<string, ReactNode>) => Object.values(values),
}));
import { DMAlertsEscalation } from "./DMAlertsEscalation";
import { DMSprintMilestone } from "./DMSprintMilestone";

afterEach(cleanup);

describe.each([
  ["alerts", DMAlertsEscalation],
  ["sprint risks", DMSprintMilestone],
] as const)("Blocked duration in %s", (_name, Component) => {
  it("shows unknown age instead of converting null to zero hours", () => {
    mocks.blocked.blockedHours = null;
    render(<Component />);
    expect(
      screen.getByText("Blocked duration unavailable; no verified history", { exact: false }),
    ).toBeTruthy();
    expect(screen.queryByText("0 h blocked")).toBeNull();
  });

  it("preserves known durations", () => {
    mocks.blocked.blockedHours = 7;
    render(<Component />);
    expect(screen.getByText("7 h blocked", { exact: false })).toBeTruthy();
  });
});
