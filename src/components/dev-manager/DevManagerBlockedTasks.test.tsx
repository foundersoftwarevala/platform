// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BlockedTaskDTO } from "@/lib/dev-manager.types";

const mocks = vi.hoisted(() => ({ rows: [] as BlockedTaskDTO[], mutate: vi.fn() }));
vi.mock("@/hooks/useDevManagerData", () => ({
  useDeliveryOverview: () => ({ data: { blocked: mocks.rows }, isLoading: false, error: null }),
  useEscalateTask: () => ({ mutate: mocks.mutate, isPending: false }),
}));
import DevManagerBlockedTasks from "./DevManagerBlockedTasks";

beforeEach(() => {
  mocks.mutate.mockReset();
  mocks.rows = [
    {
      taskId: "10000000-0000-4000-8000-000000000001",
      code: "TSK-1000",
      title: "Isolated blocked fixture",
      assignee: "DEV-FIXTURE",
      blockedReason: "Waiting for access",
      blockedSince: null,
      blockedHours: null,
      autoEscalateThreshold: 24,
      escalated: false,
    },
  ];
});
afterEach(cleanup);

describe("Developer Manager honest blocked-task state", () => {
  it("shows legacy unknown age and retains manual escalation without fabricated hours", () => {
    render(<DevManagerBlockedTasks />);
    expect(screen.getByText("Blocked duration unavailable")).toBeTruthy();
    expect(screen.getByText("No verified blocked history; manual review required")).toBeTruthy();
    expect(screen.queryByText("ESCALATED")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Manual Escalate" }));
    expect(mocks.mutate).toHaveBeenCalledWith({
      taskId: mocks.rows[0].taskId,
      reason: "Manual escalation: TSK-1000 blocked (duration unavailable) — Waiting for access",
    });
  });

  it("does not label a threshold crossing as a persisted escalation", () => {
    mocks.rows[0] = { ...mocks.rows[0], blockedHours: 25, blockedSince: "2026-10-14T23:00:00Z" };
    render(<DevManagerBlockedTasks />);
    expect(screen.getByText("Escalation due; refresh to verify")).toBeTruthy();
    expect(screen.queryByText("ESCALATED")).toBeNull();
    expect(screen.getByRole("button", { name: "Manual Escalate" })).toBeTruthy();
  });

  it("labels only actual open escalations and does not call manual ones automatic", () => {
    mocks.rows[0] = { ...mocks.rows[0], escalated: true };
    render(<DevManagerBlockedTasks />);
    expect(screen.getByText("ESCALATED")).toBeTruthy();
    expect(screen.getByText("Open escalation recorded")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Manual Escalate" })).toBeNull();
    expect(screen.queryByText("Auto-escalation triggered")).toBeNull();
  });
});
