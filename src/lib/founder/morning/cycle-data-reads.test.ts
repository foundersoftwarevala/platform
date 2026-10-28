import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadEligibleAgents, pendingDecisions } from "./cycle.server";

const agent = {
  id: "agent-1",
  agent_key: "worker-one",
  name: "Worker One",
  specialization: "operations",
  lifecycle: "ACTIVE",
  permissions: [],
  max_concurrent: 1,
  blocked_reason: null,
};

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:3010");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-test-key");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("morning-cycle data source failures", () => {
  it("reports approval-read failure instead of treating the queue as empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("database unavailable", { status: 503 })),
    );
    const degraded: string[] = [];

    await expect(pendingDecisions(degraded)).resolves.toEqual([]);
    expect(degraded).toEqual(["founder_decisions"]);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("[morning] founder_decisions unavailable:"),
    );
  });

  it("does not offer agents when current workload cannot be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json([agent]))
        .mockResolvedValueOnce(new Response("database unavailable", { status: 503 })),
    );
    const degraded: string[] = [];

    await expect(loadEligibleAgents(degraded)).resolves.toEqual([]);
    expect(degraded).toEqual(["ai_agent_runs"]);
  });

  it("keeps successful empty reads distinct from failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));
    const degraded: string[] = [];

    await expect(pendingDecisions(degraded)).resolves.toEqual([]);
    expect(degraded).toEqual([]);
  });
});
