import { describe, expect, it } from "vitest";

import {
  eligibleResellerAiServiceId,
  RESELLER_AI_TOOLS,
  resellerAiInstructions,
} from "./reseller-dashboard.functions";

describe("Reseller AI tool instructions", () => {
  it("defines distinct, actionable guidance for each available tool", () => {
    const instructions = RESELLER_AI_TOOLS.map(resellerAiInstructions);

    expect(instructions).toHaveLength(8);
    expect(instructions.every((instruction) => instruction.trim().length > 40)).toBe(true);
    expect(new Set(instructions).size).toBe(RESELLER_AI_TOOLS.length);
    expect(resellerAiInstructions("lead-scoring")).toContain("0-100");
    expect(resellerAiInstructions("email")).toContain("subject");
    expect(resellerAiInstructions("forecast")).toContain("assumptions");
  });

  it("selects only active, approved local or free AI services", () => {
    const service = {
      id: "a28285fe-1740-4e49-a56b-12d3a6bfa101",
      category: "ai",
      status: "active",
      approval_status: "approved",
      pricing_tier: "free-tier",
    };

    expect(eligibleResellerAiServiceId(service)).toBe(service.id);
    expect(eligibleResellerAiServiceId({ ...service, pricing_tier: "paid" })).toBeNull();
    expect(eligibleResellerAiServiceId({ ...service, approval_status: "pending" })).toBeNull();
    expect(eligibleResellerAiServiceId({ ...service, category: "storage" })).toBeNull();
    expect(eligibleResellerAiServiceId({ ...service, pricing_tier: "unknown" })).toBeNull();
  });
});
