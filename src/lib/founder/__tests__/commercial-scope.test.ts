import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  contextFor: vi.fn(),
  loadCommercialSummary: vi.fn(),
  askStructured: vi.fn(),
}));

vi.mock("../context.server", () => ({ contextFor: mocks.contextFor }));
vi.mock("../decisions.server", () => ({ loadDecision: vi.fn() }));
vi.mock("../intelligence/commercial-retrieval.server", () => ({
  loadCommercialSummary: mocks.loadCommercialSummary,
}));
vi.mock("../intelligence/structured.server", () => ({ askStructured: mocks.askStructured }));

import { answerQuestion } from "../intelligence/analyse.server";

describe("AYRA commercial answer scope", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.contextFor.mockResolvedValue({ included: {}, sources: {}, degraded: [] });
    mocks.loadCommercialSummary.mockResolvedValue({
      measured_at: "2026-10-25T03:00:00.000Z",
      sales_deals: [],
      sales_leads: [],
      lead_manager_leads: [],
      unavailable_sources: ["Sales and Lead records lack auth.users ownership mappings."],
      marketplace_orders: [],
      tasks: [],
    });
    mocks.askStructured.mockResolvedValue({
      ok: true,
      data: {
        answer: "Current data supports this operational answer.",
        evidence: [],
        unknowns: [],
        suspiciousContent: [],
      },
      notes: [],
    });
  });

  it("does not add commercial data to the general Founder AI scope", async () => {
    await answerQuestion({ question: "What needs attention today?" });

    expect(mocks.contextFor).toHaveBeenCalledOnce();
    expect(mocks.loadCommercialSummary).not.toHaveBeenCalled();
  });

  it("uses only the live commercial aggregates for AYRA", async () => {
    await answerQuestion({
      question: "How many tasks are overdue?",
      accessToken: "caller-token",
      scope: "commercial",
    });

    expect(mocks.contextFor).not.toHaveBeenCalled();
    expect(mocks.loadCommercialSummary).toHaveBeenCalledWith("caller-token");
    const request = mocks.askStructured.mock.calls[0]?.[0];
    expect(request.prompt.blocks).toHaveLength(2);
    expect(request.prompt.blocks[0].source).toBe("ayra_commercial_summary");
    expect(request.prompt.blocks[0].content).toContain(
      "Sales and Lead records lack auth.users ownership mappings.",
    );
    expect(request.prompt.blocks[1].trust).toBe("AUTHORIZED_USER_INPUT");
    expect(request.prompt.taskInstruction).toContain(
      "empty source arrays do not mean zero records",
    );
  });

  it("refuses commercial retrieval without the authenticated caller token", async () => {
    const result = await answerQuestion({
      question: "How many tasks are overdue?",
      scope: "commercial",
    });

    expect(result.ok).toBe(false);
    expect(mocks.loadCommercialSummary).not.toHaveBeenCalled();
    expect(mocks.askStructured).not.toHaveBeenCalled();
  });

  it("does not generate an answer when live commercial data cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.loadCommercialSummary.mockRejectedValue(new Error("database unavailable"));

    const result = await answerQuestion({
      question: "How many tasks are overdue?",
      accessToken: "caller-token",
      scope: "commercial",
    });

    expect(result.ok).toBe(false);
    expect(result.answer).toBeNull();
    expect(mocks.askStructured).not.toHaveBeenCalled();
  });
});
