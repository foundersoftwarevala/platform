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
  it("derives run counts and success rates from VPS ai_agent_runs", async () => {
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
              model_display: "Rule-based / no LLM",
              status: "active",
              tools: [],
              runs_30d: 2304,
              success_rate: 100,
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
        successRate: 100,
        modelId: null,
        modelDisplay: "Rule-based / no LLM",
        tools: [],
      }),
    ]);
    expect(mocks.query).toContain("left join public.ai_models m on m.id = a.model_id");
    expect(mocks.query).toContain("from public.ai_agent_runs");
    expect(mocks.query).toContain("interval '30 days'");
    expect(mocks.query).not.toContain("a.runs_30d");
    expect(mocks.query).not.toContain("a.success_rate");
    expect(mocks.query).toContain("state = 'COMPLETED'");
    expect(mocks.query).toContain("state in ('COMPLETED', 'FAILED')");
    expect(degraded).toEqual([]);
  });

  it("returns the registered runtime name instead of exposing a model UUID", async () => {
    mocks.withVpsPublicDatabase.mockImplementation(
      async (run: (tx: TransactionSql) => Promise<unknown>) => {
        const tx = (async (strings: TemplateStringsArray) => {
          mocks.query = strings.join(" ");
          return [
            {
              id: "10000000-0000-4000-8000-000000000002",
              name: "Research Agent",
              purpose: "Summarizes verified research",
              model_id: "20000000-0000-4000-8000-000000000002",
              model_display: "Qwen 2.5 3B (qwen2.5:3b)",
              status: "active",
              tools: [],
              runs_30d: 2,
              success_rate: 100,
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
        modelId: "20000000-0000-4000-8000-000000000002",
        modelDisplay: "Qwen 2.5 3B (qwen2.5:3b)",
      }),
    ]);
    expect(degraded).toEqual([]);
  });

  it("reports degraded VPS data reads without inventing agent rows", async () => {
    mocks.withVpsPublicDatabase.mockRejectedValue(new Error("VPS unavailable"));
    const degraded: string[] = [];
    await expect(loadAgents(degraded)).resolves.toEqual([]);
    expect(degraded).toEqual(["ai_agents"]);
  });
});
