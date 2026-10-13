// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  operator: { id: "first", email: "first@example.invalid", name: "First", role: "owner" },
  plan: vi.fn(),
  step: vi.fn(),
  save: vi.fn(),
  load: vi.fn(),
}));
vi.mock("@/components/vala-ai/session", () => ({ useOperator: () => mocks.operator }));
vi.mock("./ai/agent.functions", () => ({
  planBuildFn: mocks.plan,
  buildStepFn: mocks.step,
}));
vi.mock("./agent-cloud.functions", () => ({
  saveBuildFn: mocks.save,
  loadBuildFn: mocks.load,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { startAgentBuild, useAgentBuild } from "./agent-store";

const plan = {
  out: {
    project: "local-fixture",
    summary: "Model double",
    steps: [{ title: "One", file: "one.ts", goal: "Fixture" }],
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  mocks.operator = { ...mocks.operator, id: "first" };
  mocks.plan.mockResolvedValue(plan);
  mocks.step.mockResolvedValue({ out: { code: "export const one = 1;", file: "one.ts" } });
  mocks.save.mockResolvedValue({ id: "saved-build" });
  mocks.load.mockResolvedValue(null);
  window.dispatchEvent(new Event("pageshow"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("operator-scoped imported agent builds", () => {
  it("loads only the signed-in operator's cache", () => {
    localStorage.setItem(
      "vala-studio-build:first",
      JSON.stringify({ project: "First private build", phase: "done", steps: [] }),
    );
    localStorage.setItem(
      "vala-studio-build:second",
      JSON.stringify({ project: "Second private build", phase: "done", steps: [] }),
    );
    const hook = renderHook(useAgentBuild);
    expect(hook.result.current.project).toBe("First private build");
    mocks.operator = { ...mocks.operator, id: "second" };
    hook.rerender();
    expect(hook.result.current.project).toBe("Second private build");
  });

  it("ignores a previous operator's delayed model response", async () => {
    let resolvePlan!: (value: typeof plan) => void;
    mocks.plan.mockImplementationOnce(
      () =>
        new Promise<typeof plan>((resolve) => {
          resolvePlan = resolve;
        }),
    );
    const hook = renderHook(useAgentBuild);
    let pending!: Promise<void>;
    act(() => {
      pending = startAgentBuild("First private requirement");
    });
    mocks.operator = { ...mocks.operator, id: "second" };
    hook.rerender();
    await act(async () => {
      resolvePlan(plan);
      await pending;
    });
    expect(hook.result.current.requirement).toBe("");
    expect(hook.result.current.project).toBe("");
    expect(mocks.step).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("persists resumable builds under the operator's keys", async () => {
    const hook = renderHook(useAgentBuild);
    await act(async () => {
      await startAgentBuild("Fixture requirement");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(hook.result.current.phase).toBe("done");
    expect(JSON.parse(localStorage.getItem("vala-studio-build:first")!).requirement).toBe(
      "Fixture requirement",
    );
    expect(localStorage.getItem("vala-studio-build-id:first")).toBe("saved-build");
    expect(localStorage.getItem("vala-studio-uninitialized")).toBeNull();
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });

  it("resumes saving after a back-forward-cache page restore", async () => {
    renderHook(useAgentBuild);
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("pageshow"));
    await act(async () => {
      await startAgentBuild("Restored page");
    });
    expect(JSON.parse(localStorage.getItem("vala-studio-build:first")!).requirement).toBe(
      "Restored page",
    );
  });
});
