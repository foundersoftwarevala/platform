import { describe, expect, it } from "vitest";

import { eligibility, match, rank, type AgentProfile, type LeadNeed } from "../leads/matching";

/**
 * Who a lead goes to, and why.
 *
 * The rule these exist to hold is "no random assignment". That is not tested
 * by checking an agent came back — it is tested by checking that the choice
 * carries its reasoning, that the people who could not take it are named with
 * the reason, and that the things the match could not know are stated rather
 * than papered over.
 */

function lead(over: Partial<LeadNeed> = {}): LeadNeed {
  return {
    leadId: "lead-1",
    language: "en",
    region: "India",
    interests: [],
    score: null,
    enterprise: false,
    ...over,
  };
}

function agent(over: Partial<AgentProfile> = {}): AgentProfile {
  return {
    agentId: "a1",
    name: "Agent One",
    status: "online",
    languages: ["en"],
    regions: ["India"],
    expertise: [],
    timezone: "Asia/Kolkata",
    openLeads: 5,
    maxOpenLeads: 25,
    conversionRate: 30,
    avgResponseMinutes: 10,
    unavailableReason: null,
    ...over,
  };
}

describe("who cannot take a lead is decided before who is best", () => {
  it("excludes an offline agent and repeats the recorded reason", () => {
    const { eligible, excluded } = eligibility(lead(), [
      agent({ status: "offline", unavailableReason: "on leave until Monday" }),
    ]);
    expect(eligible).toHaveLength(0);
    expect(excluded[0]?.why).toContain("on leave until Monday");
  });

  it("excludes an agent already at their ceiling", () => {
    const { eligible, excluded } = eligibility(lead(), [
      agent({ openLeads: 25, maxOpenLeads: 25 }),
    ]);
    expect(eligible).toHaveLength(0);
    expect(excluded[0]?.why).toContain("at capacity");
  });

  it("excludes an agent who does not work in the customer's language", () => {
    const { excluded } = eligibility(lead({ language: "ar" }), [agent({ languages: ["en"] })]);
    expect(excluded[0]?.why).toContain("does not work in ar");
  });

  it("treats no recorded languages as unknown, not as speaking everything", () => {
    // The dangerous default: an empty list silently matching an Arabic
    // enquiry to somebody who may not read it.
    const { eligible, excluded } = eligibility(lead({ language: "ar" }), [
      agent({ languages: [] }),
    ]);
    expect(eligible).toHaveLength(0);
    expect(excluded[0]?.why).toContain("no languages recorded");
  });

  it("keeps a busy agent eligible, because busy is not unavailable", () => {
    const { eligible } = eligibility(lead(), [agent({ status: "busy" })]);
    expect(eligible).toHaveLength(1);
  });
});

describe("a ranking always explains itself", () => {
  it("names the language, region and expertise it matched", () => {
    const scored = rank(lead({ interests: ["erp"] }), agent({ expertise: ["erp"] }));
    expect(scored.reason).toContain("works in en");
    expect(scored.reason).toContain("covers India");
    expect(scored.reason).toContain("knows erp");
    expect(scored.factors.language).toBeGreaterThan(0);
  });

  it("says so even when nothing in particular matches", () => {
    const scored = rank(
      lead({ language: null, region: null }),
      agent({ languages: [], regions: [], conversionRate: null, avgResponseMinutes: null }),
    );
    expect(scored.reason).toContain("nothing about this lead matches them particularly");
  });

  it("prefers headroom over raw load, so a small ceiling is respected", () => {
    const roomy = rank(lead(), agent({ openLeads: 2, maxOpenLeads: 25 }));
    const tight = rank(lead(), agent({ agentId: "a2", openLeads: 2, maxOpenLeads: 4 }));
    expect(roomy.score).toBeGreaterThan(tight.score);
  });

  it("marks a recorded conversion rate as recorded, not measured", () => {
    const scored = rank(lead(), agent({ conversionRate: 40 }));
    expect(scored.reason).toContain("recorded conversion 40%");
  });

  it("weighs enterprise experience only when the lead is one", () => {
    const small = rank(lead({ enterprise: false }), agent({ expertise: ["enterprise"] }));
    const big = rank(lead({ enterprise: true }), agent({ expertise: ["enterprise"] }));
    expect(big.score).toBeGreaterThan(small.score);
    expect(big.reason).toContain("enterprise experience");
  });

  it("counts being busy against an agent without disqualifying them", () => {
    const busy = rank(lead(), agent({ status: "busy" }));
    const free = rank(lead(), agent({ status: "online" }));
    expect(busy.score).toBeLessThan(free.score);
    expect(busy.reason).toContain("currently busy");
  });
});

describe("a failure to place a lead is never a bare refusal", () => {
  it("names everyone who was excluded and why", () => {
    const result = match(lead({ language: "ar" }), [
      agent({ agentId: "a1", name: "One", languages: ["en"] }),
      agent({ agentId: "a2", name: "Two", status: "offline", unavailableReason: "shift ended" }),
    ]);
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.reason).toContain("One");
    expect(result.reason).toContain("Two");
    expect(result.excluded).toHaveLength(2);
  });

  it("says plainly when nothing is registered", () => {
    const result = match(lead(), []);
    expect(result.matched).toBe(false);
    if (result.matched) return;
    expect(result.reason).toBe("No agent is registered.");
  });
});

describe("what the match could not know is stated", () => {
  it("reports that nobody has recorded languages", () => {
    const result = match(lead({ language: null }), [agent({ languages: [] })]);
    expect(result.limitations.join(" ")).toContain("No agent has recorded languages");
  });

  it("reports a lead with no region and no interest", () => {
    const result = match(lead({ region: null, interests: [] }), [agent()]);
    expect(result.limitations.join(" ")).toContain("no recorded region");
    expect(result.limitations.join(" ")).toContain("no recorded product interest");
  });
});

describe("the best operational fit wins, and the rest are kept", () => {
  it("chooses the agent who matches most and lists the others", () => {
    const result = match(lead({ language: "en", region: "India", interests: ["erp"] }), [
      agent({ agentId: "generalist", name: "Generalist", expertise: [] }),
      agent({ agentId: "specialist", name: "Specialist", expertise: ["erp"] }),
    ]);
    expect(result.matched).toBe(true);
    if (!result.matched) return;
    expect(result.chosen.agentId).toBe("specialist");
    expect(result.considered).toHaveLength(2);
    expect(result.chosen.reason).toContain("knows erp");
  });

  it("keeps the order stable when two agents are identical", () => {
    const result = match(lead(), [
      agent({ agentId: "first", name: "First" }),
      agent({ agentId: "second", name: "Second" }),
    ]);
    expect(result.matched).toBe(true);
    if (!result.matched) return;
    expect(result.chosen.agentId).toBe("first");
  });
});
