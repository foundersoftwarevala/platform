import type { TransactionSql } from "postgres";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withVpsPublicDatabase: vi.fn(),
  query: "",
}));

vi.mock("@/lib/marketplace-manager/vps-rpc.server", () => ({
  withVpsPublicDatabase: mocks.withVpsPublicDatabase,
}));

import { loadAgents, loadUsage } from "./ops.server";

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

  describe("AI CEO usage and spend", () => {
    it("reads exact VPS usage_events aggregates and includes agent attribution", async () => {
      mocks.withVpsPublicDatabase.mockImplementation(
        async (run: (tx: TransactionSql) => Promise<unknown>) => {
          const tx = (async (strings: TemplateStringsArray) => {
            mocks.query = strings.join(" ");
            return [
              {
                service_id: "service-1",
                provider: "Ollama Local",
                service: "Ollama Local",
                agent_id: "agent-1",
                agent_name: "Support Reply Drafter",
                source: "ai-agent-runner",
                requests: "3",
                tokens: "1200",
                cost_usd: "0",
                cost_unpriced: false,
                first_at: "2026-10-28T10:00:00Z",
                last_at: "2026-10-29T10:00:00Z",
              },
            ];
          }) as unknown as TransactionSql;
          return run(tx);
        },
      );

      const degraded: string[] = [];
      await expect(loadUsage(degraded)).resolves.toEqual([
        {
          id: "service-1:agent-1:ai-agent-runner",
          day: "Last 30 days",
          provider: "Ollama Local",
          service: "Support Reply Drafter · Ollama Local",
          requests: 3,
          tokens: 1200,
          costUsd: 0,
          source: "ai-agent-runner · agent agent-1",
        },
      ]);
      expect(mocks.query).toContain("from public.usage_events e");
      expect(mocks.query).toContain("left join public.ai_agents a on a.id = e.ai_agent_id");
      expect(mocks.query).toContain("interval '30 days'");
      expect(degraded).toEqual([]);
    });
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
