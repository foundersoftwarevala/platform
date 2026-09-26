import { describe, expect, it } from "vitest";

import { assessDataQuality, checkDepth, MAX_AI_DEPTH } from "../intelligence/guard.server";
import type { MetricSample } from "../intelligence/guard.server";

/**
 * The checks that run before an AI request is allowed to reason.
 *
 * Authorization and rate limiting need the database and are exercised against
 * it elsewhere; these are the two that are pure logic and the two that decide
 * whether a confident answer is allowed to exist at all.
 */

const DAY = 86_400_000;

function sample(over: Partial<MetricSample> & { subject: string }): MetricSample {
  return {
    value: 100,
    measuredAt: new Date().toISOString(),
    source: "finance_daily_metrics",
    ...over,
  };
}

describe("a chain of AI calls cannot run away", () => {
  it("allows a normal depth", () => {
    expect(checkDepth(1).allowed).toBe(true);
    expect(checkDepth(MAX_AI_DEPTH).allowed).toBe(true);
  });

  it("refuses past the bound and says so", () => {
    const result = checkDepth(MAX_AI_DEPTH + 1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/refusing rather than looping/i);
  });
});

describe("data is judged before it is reasoned over", () => {
  it("refuses to support a recommendation when nothing was measured", () => {
    const result = assessDataQuality([]);
    expect(result.score).toBe(0);
    expect(result.refuseStrongRecommendation).toBe(true);
    expect(result.summary).toMatch(/nothing can be concluded/i);
  });

  it("is satisfied by fresh, present measurements", () => {
    const result = assessDataQuality([
      sample({ subject: "revenue" }),
      sample({ subject: "orders" }),
    ]);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.refuseStrongRecommendation).toBe(false);
  });

  it("notices a missing value rather than treating it as zero", () => {
    const result = assessDataQuality([
      sample({ subject: "revenue", value: null }),
      sample({ subject: "orders" }),
    ]);
    expect(result.issues.some((i) => i.kind === "MISSING")).toBe(true);
    expect(result.score).toBeLessThan(100);
  });

  it("notices a stale measurement", () => {
    const result = assessDataQuality([
      sample({ subject: "revenue", measuredAt: new Date(Date.now() - 20 * DAY).toISOString() }),
    ]);
    expect(result.issues.some((i) => i.kind === "STALE")).toBe(true);
  });

  it("refuses a strong recommendation when two sources disagree", () => {
    const result = assessDataQuality([
      sample({ subject: "revenue", value: 250_000, source: "finance_daily_metrics" }),
      sample({ subject: "revenue", value: 241_300, source: "marketplace_orders" }),
    ]);
    const conflict = result.issues.find((i) => i.kind === "CONFLICT");
    expect(conflict).toBeDefined();
    // The disagreement is reported with both readings; neither is chosen.
    expect(conflict!.detail).toContain("250000");
    expect(conflict!.detail).toContain("241300");
    expect(result.refuseStrongRecommendation).toBe(true);
    expect(result.summary).toMatch(/sources disagree/i);
  });

  it("does not call two sources that agree a conflict", () => {
    const result = assessDataQuality([
      sample({ subject: "revenue", value: 250_000, source: "a" }),
      sample({ subject: "revenue", value: 250_000, source: "b" }),
    ]);
    expect(result.issues.some((i) => i.kind === "CONFLICT")).toBe(false);
  });

  it("notices a value outside its expected range", () => {
    const result = assessDataQuality([
      sample({ subject: "conversion", value: 180, min: 0, max: 100 }),
    ]);
    expect(result.issues.some((i) => i.kind === "OUT_OF_RANGE")).toBe(true);
    expect(result.score).toBeLessThanOrEqual(60);
  });

  it("refuses a strong recommendation once the score falls far enough", () => {
    const stale = new Date(Date.now() - 30 * DAY).toISOString();
    const result = assessDataQuality([
      sample({ subject: "a", value: null }),
      sample({ subject: "b", value: null }),
      sample({ subject: "c", measuredAt: stale }),
    ]);
    expect(result.refuseStrongRecommendation).toBe(true);
  });
});
