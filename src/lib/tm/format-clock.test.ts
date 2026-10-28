import { describe, expect, it } from "vitest";

import { computeSLAAt } from "./format";

describe("computeSLAAt", () => {
  it("updates the SLA state when the deadline passes without task changes", () => {
    const deadline = Date.parse("2026-10-28T00:01:00.000Z");
    const task = {
      status: "in_progress",
      created_at: new Date(deadline - 120_000).toISOString(),
      promised_at: null,
      deadline: new Date(deadline).toISOString(),
      completed_at: null,
      sla_hours: 1,
    } as const;

    expect(computeSLAAt(task, 75, deadline - 120_000).state).toBe("on_track");
    expect(computeSLAAt(task, 75, deadline - 30_000).state).toBe("at_risk");
  });
});
