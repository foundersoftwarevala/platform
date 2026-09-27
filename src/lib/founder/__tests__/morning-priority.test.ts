import { describe, expect, it } from "vitest";

import { allocate, type EligibleAgent } from "../morning/allocation";
import { prioritise, score, type Candidate } from "../morning/priority";

/**
 * How Morning AI decides the day's order, and who could take each item.
 *
 * Both are arithmetic rather than a model call, so both can be tested
 * exactly. That is the point of building them this way: an operator has to be
 * able to disagree with the order, and there is nothing to disagree with in a
 * number that came out of a language model.
 */

function candidate(over: Partial<Candidate> = {}): Candidate {
  return {
    source: "ATTENTION",
    sourceId: "c1",
    title: "Something",
    domain: "finance",
    severity: "LOW",
    humanPriority: null,
    dueAt: null,
    blocked: false,
    awaitingApproval: false,
    needs: null,
    ...over,
  };
}

function agent(over: Partial<EligibleAgent> = {}): EligibleAgent {
  return {
    id: "a1",
    agentKey: "mon-finance",
    name: "Finance Monitoring Agent",
    specialization: "MONITORING",
    lifecycle: "CONFIGURED",
    permissions: ["READ", "ANALYZE", "RECOMMEND", "CREATE"],
    maxConcurrent: 1,
    openRuns: 0,
    blockedReason: null,
    ...over,
  };
}

describe("a priority can always be explained", () => {
  it("never produces a score without a reason", () => {
    // LOW is still a signal, so the item with nothing at all to say for
    // itself is the INFO one.
    const plain = score(candidate({ severity: "INFO" }));
    expect(plain.reason.length).toBeGreaterThan(0);
    expect(plain.reason).toContain("no urgency signal");

    const low = score(candidate({ severity: "LOW" }));
    expect(low.reason).toContain("low severity");
  });

  it("weighs a critical item above a low one", () => {
    const critical = score(candidate({ severity: "CRITICAL" }));
    const low = score(candidate({ severity: "LOW" }));
    expect(critical.score).toBeGreaterThan(low.score);
    expect(critical.reason).toContain("critical severity");
  });

  it("counts an overdue item as more urgent than one due later", () => {
    const overdue = score(candidate({ dueAt: new Date(Date.now() - 7_200_000).toISOString() }));
    const soon = score(candidate({ dueAt: new Date(Date.now() + 7_200_000).toISOString() }));
    expect(overdue.score).toBeGreaterThan(soon.score);
    expect(overdue.reason).toContain("overdue");
  });

  it("surfaces something waiting on a person", () => {
    const waiting = score(candidate({ awaitingApproval: true }));
    expect(waiting.reason).toContain("waiting on an approval");
    expect(waiting.score).toBeGreaterThan(score(candidate()).score);
  });

  it("pushes a blocked item down without hiding it", () => {
    const blocked = score(candidate({ severity: "HIGH", blocked: true }));
    const clear = score(candidate({ severity: "HIGH" }));
    expect(blocked.score).toBeLessThan(clear.score);
    // Still present, and still says why it is where it is.
    expect(blocked.reason).toContain("blocked on something else");
  });
});

describe("a human's priority is not quietly overridden", () => {
  it("puts anything a person prioritised above anything it merely scored", () => {
    const human = score(candidate({ severity: "LOW", humanPriority: 1 }));
    const machine = score(
      candidate({
        severity: "CRITICAL",
        awaitingApproval: true,
        dueAt: new Date(Date.now() - 86_400_000).toISOString(),
      }),
    );
    expect(human.score).toBeGreaterThan(machine.score);
    expect(human.reason).toContain("a person set priority 1");
  });

  it("orders within a human band by the signals it can see", () => {
    const [first, second] = prioritise([
      candidate({ sourceId: "b", humanPriority: 2, severity: "LOW" }),
      candidate({ sourceId: "a", humanPriority: 2, severity: "CRITICAL" }),
    ]);
    expect(first?.sourceId).toBe("a");
    expect(second?.sourceId).toBe("b");
  });

  it("keeps the order stable where nothing separates two items", () => {
    const ordered = prioritise([
      candidate({ sourceId: "first" }),
      candidate({ sourceId: "second" }),
    ]);
    expect(ordered.map((i) => i.sourceId)).toEqual(["first", "second"]);
  });
});

describe("an agent is suggested, never assigned", () => {
  const item = score(candidate({ domain: "finance", needs: "kpi" }));

  it("prefers an agent that watches the same domain", () => {
    const out = allocate(item, [
      agent({ id: "other", agentKey: "mon-seo", name: "SEO" }),
      agent({ id: "fin", agentKey: "mon-finance", name: "Finance" }),
    ]);
    expect(out.agentId).toBe("fin");
    expect(out.reason).toContain("watches finance");
  });

  it("refuses an agent that does not hold CREATE", () => {
    const out = allocate(item, [agent({ permissions: ["READ", "ANALYZE"] })]);
    expect(out.agentId).toBeNull();
    expect(out.unmatchedReason).toContain("does not hold CREATE");
  });

  it("refuses a paused, archived or blocked agent", () => {
    expect(allocate(item, [agent({ lifecycle: "PAUSED" })]).agentId).toBeNull();
    expect(allocate(item, [agent({ lifecycle: "ARCHIVED" })]).agentId).toBeNull();
    const blocked = allocate(item, [agent({ blockedReason: "credential expired" })]);
    expect(blocked.agentId).toBeNull();
    expect(blocked.unmatchedReason).toContain("blocked");
  });

  it("refuses an agent that is already at capacity", () => {
    const out = allocate(item, [agent({ maxConcurrent: 1, openRuns: 1 })]);
    expect(out.agentId).toBeNull();
    expect(out.unmatchedReason).toContain("at capacity");
  });

  it("spreads work towards the agent carrying less of it", () => {
    const out = allocate(item, [
      agent({ id: "busy", agentKey: "mon-finance", maxConcurrent: 5, openRuns: 4 }),
      agent({ id: "free", agentKey: "mon-finance", maxConcurrent: 5, openRuns: 0 }),
    ]);
    expect(out.agentId).toBe("free");
  });

  it("says plainly when nothing is registered", () => {
    const out = allocate(item, []);
    expect(out.agentId).toBeNull();
    expect(out.unmatchedReason).toBe("no agent is registered");
  });

  it("explains its choice rather than just naming one", () => {
    const out = allocate(item, [agent()]);
    expect(out.reason).toContain("holds CREATE");
    expect(out.reason).toContain("in flight");
  });
});
