import type { TransactionSql } from "postgres";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withVpsPublicDatabase: vi.fn(),
  query: "",
}));

vi.mock("@/lib/marketplace-manager/vps-rpc.server", () => ({
  withVpsPublicDatabase: mocks.withVpsPublicDatabase,
}));

import { loadAgents } from "./ops.server";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query = "";
});

describe("AI CEO agent directory metrics", () => {
  it("counts runs from VPS ai_agent_runs instead of stale ai_agents.runs_30d values", async () => {
    mocks.withVpsPublicDatabase.mockImplementation(
      async (run: (tx: TransactionSql) => Promise<unknown>) => {
        const tx = (async (strings: TemplateStringsArray) => {
          mocks.query = strings.join(" ");
          return [
            {
              id: "10000000-0000-4000-8000-000000000001",
              name: "Demo Health Worker",
              purpose: "Checks demo health",
              model_id: null,
              status: "active",
              tools: [],
              runs_30d: 2304,
              success_rate: null,
              max_tokens: 1024,
              created_at: "2026-10-28T00:00:00Z",
            },
          ];
        }) as unknown as TransactionSql;
        return run(tx);
      },
    );

    const degraded: string[] = [];
    await expect(loadAgents(degraded)).resolves.toEqual([
      expect.objectContaining({
        name: "Demo Health Worker",
        runs30d: 2304,
        modelId: null,
        tools: [],
      }),
    ]);
    expect(mocks.query).toContain("from public.ai_agent_runs");
    expect(mocks.query).toContain("interval '30 days'");
    expect(mocks.query).not.toContain("a.runs_30d");
    expect(degraded).toEqual([]);
  });

  it("reports degraded VPS data reads without inventing agent rows", async () => {
    mocks.withVpsPublicDatabase.mockRejectedValue(new Error("VPS unavailable"));
    const degraded: string[] = [];
    await expect(loadAgents(degraded)).resolves.toEqual([]);
    expect(degraded).toEqual(["ai_agents"]);
  });
});
