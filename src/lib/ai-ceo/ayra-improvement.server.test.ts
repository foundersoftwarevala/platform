import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryCall = { sql: string; values: unknown[] };
type MockTx = <Rows extends unknown[]>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Rows>;

const state = vi.hoisted(() => ({
  calls: [] as QueryCall[],
  candidates: [] as Record<string, unknown>[],
  proposals: [] as Record<string, unknown>[],
  agents: [] as Record<string, unknown>[],
  emptyRows: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/marketplace-manager/vps-rpc.server", () => ({
  withVpsPublicDatabase: async <T>(run: (tx: MockTx) => Promise<T>) => {
    const tx: MockTx = async <Rows extends unknown[]>(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => {
      const sql = strings.join("?");
      state.calls.push({ sql, values });
      if (sql.includes("select a.id::text, a.name")) return state.candidates as Rows;
      if (sql.includes("select id::text, agent_id::text, proposal_kind")) {
        return state.proposals.splice(0, 1) as Rows;
      }
      if (sql.includes("select system_prompt from public.ai_agents"))
        return state.agents.splice(0, 1) as Rows;
      return state.emptyRows as Rows;
    };
    return run(tx);
  },
}));
const ollama = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/founder/local-ollama.server", () => ({ generateLocalJson: ollama.generate }));

import {
  createLowSuccessPromptProposals,
  reviewAyraImprovementProposal,
} from "./ayra-improvement.server";

const ACTOR = "00000000-0000-4000-8000-000000000001";
const AGENT = "00000000-0000-4000-8000-000000000002";
const PROPOSAL = "00000000-0000-4000-8000-000000000003";

beforeEach(() => {
  state.calls = [];
  state.candidates = [];
  state.proposals = [];
  state.agents = [];
  ollama.generate.mockResolvedValue({
    model: "local-test-model",
    value: {
      reason: "Verified outcomes show this agent needs clearer task boundaries.",
      proposedPrompt: "You are a careful Software Vala agent. Verify before acting.",
    },
  });
});

describe("AYRA human-reviewed self-improvement", () => {
  it("bases proposals only on verified outcomes and enforces the five-run under-50% threshold", async () => {
    state.candidates = [
      {
        id: AGENT,
        name: "Demo Scanner",
        system_prompt: "Inspect demos carefully.",
        verified_runs: 2,
        failed_runs: 3,
        success_rate: 40,
      },
    ];

    const result = await createLowSuccessPromptProposals(ACTOR);
    expect(result).toEqual({ created: 0, candidates: 1 });
    expect(state.calls[0]?.sql).toContain("r.verification = 'VERIFIED'");
    expect(state.calls[0]?.sql).toContain("r.verification = 'FAILED'");
    expect(state.calls[0]?.sql).toContain(">= 5");
    expect(state.calls[0]?.sql).toContain("< 50");
    expect(ollama.generate).toHaveBeenCalledOnce();
  });

  it("does not overwrite an agent prompt changed after proposal creation", async () => {
    state.proposals = [
      {
        id: PROPOSAL,
        agent_id: AGENT,
        proposal_kind: "prompt",
        proposed_prompt: "A proposed careful prompt.",
        base_prompt_hash: "stale-hash",
        status: "pending_review",
      },
    ];
    state.agents = [{ system_prompt: "The agent prompt changed later." }];

    await expect(reviewAyraImprovementProposal(PROPOSAL, ACTOR, "approved")).rejects.toThrow(
      "prompt changed after this proposal was generated",
    );
    expect(state.calls.some((call) => call.sql.includes("update public.ai_agents"))).toBe(false);
  });

  it("updates a prompt only after explicit approval against its base hash", async () => {
    const basePrompt = "Current verified agent prompt.";
    const baseHash = createHash("sha256").update(basePrompt).digest("hex");
    state.proposals = [
      {
        id: PROPOSAL,
        agent_id: AGENT,
        proposal_kind: "prompt",
        proposed_prompt: "Approved replacement prompt.",
        base_prompt_hash: baseHash,
        status: "pending_review",
      },
    ];
    state.agents = [{ system_prompt: basePrompt }];

    await expect(
      reviewAyraImprovementProposal(PROPOSAL, ACTOR, "approved"),
    ).resolves.toBeUndefined();
    const promptUpdate = state.calls.find((call) => call.sql.includes("update public.ai_agents"));
    expect(promptUpdate?.values).toContain("Approved replacement prompt.");
    expect(
      state.calls.some((call) =>
        call.sql.includes("update public.ayra_agent_improvement_proposals"),
      ),
    ).toBe(true);
  });
});
