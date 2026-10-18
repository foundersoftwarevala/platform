import { describe, expect, it } from "vitest";

import { assessConfidence, assessGap } from "../decisions.server";
import { scoreRisk } from "../policy.server";
import type { DecisionEvidence } from "../decision.types";

/**
 * The judgements the Decision Engine makes before it recommends anything.
 *
 * These are the functions that decide how much a recommendation is worth and
 * whether one should be made at all, so they are tested on their own rather
 * than only through the database. The cases below are the ones that would be
 * dangerous to get wrong: evidence that is mostly inference, evidence that is
 * entirely stale, and sources that disagree.
 */

const DAY = 86_400_000;

function evidence(
  over: Partial<DecisionEvidence> & { kind: DecisionEvidence["kind"] },
): DecisionEvidence {
  return {
    id: Math.random().toString(36).slice(2),
    statement: "a statement",
    sourceSystem: "tm_tasks",
    sourceEntity: null,
    sourceRecord: "a record",
    measuredAt: new Date().toISOString(),
    calculation: null,
    freshness: null,
    confidence: "MEASURED",
    ...over,
  };
}

describe("confidence is derived from the evidence", () => {
  it("returns nothing to be confident about when there is no evidence", () => {
    const result = assessConfidence([], 0);
    expect(result.score).toBe(0);
    expect(result.level).toBe("INSUFFICIENT");
    expect(result.factors.notes.join(" ")).toMatch(/no evidence/i);
  });

  it("rates three fresh independent measurements highly", () => {
    const result = assessConfidence(
      [
        evidence({ kind: "FACT", sourceSystem: "tm_tasks" }),
        evidence({ kind: "CALCULATION", sourceSystem: "finance_daily_metrics" }),
        evidence({ kind: "OBSERVATION", sourceSystem: "security_alerts" }),
      ],
      0,
    );
    expect(result.level).toBe("HIGH");
    expect(result.factors.sourceCount).toBe(3);
    expect(result.factors.completeness).toBe(1);
  });

  it("caps a case built mostly on inference, and says so", () => {
    const result = assessConfidence(
      [
        evidence({ kind: "FACT" }),
        evidence({
          kind: "INFERENCE",
          sourceRecord: null,
          measuredAt: null,
          confidence: "UNKNOWN",
        }),
        evidence({
          kind: "ASSUMPTION",
          sourceRecord: null,
          measuredAt: null,
          confidence: "UNKNOWN",
        }),
      ],
      0,
    );
    expect(result.score).toBeLessThanOrEqual(35);
    expect(result.factors.assumptions).toBe(2);
    expect(result.factors.notes.join(" ")).toMatch(/assumption or inference/i);
  });

  it("caps a case whose every measurement is stale", () => {
    const old = new Date(Date.now() - 20 * DAY).toISOString();
    const result = assessConfidence(
      [
        evidence({ kind: "FACT", measuredAt: old }),
        evidence({ kind: "CALCULATION", sourceSystem: "finance_daily_metrics", measuredAt: old }),
      ],
      0,
    );
    expect(result.score).toBeLessThanOrEqual(40);
    expect(result.factors.freshness).toBe(0);
    expect(result.factors.notes.join(" ")).toMatch(/stale/i);
  });

  it("caps a case where sources disagree", () => {
    const result = assessConfidence([evidence({ kind: "FACT" })], 2);
    expect(result.score).toBeLessThanOrEqual(30);
    expect(result.factors.conflicts).toBe(2);
    expect(result.factors.notes.join(" ")).toMatch(/disagreement/i);
  });

  it("notes when everything rests on one source", () => {
    const result = assessConfidence(
      [evidence({ kind: "FACT" }), evidence({ kind: "CALCULATION" })],
      0,
    );
    expect(result.factors.sourceCount).toBe(1);
    expect(result.factors.notes.join(" ")).toMatch(/single source/i);
  });
});

describe("a missing answer is named rather than filled in", () => {
  it("calls no evidence insufficient", () => {
    expect(assessGap([], 0)).toBe("INSUFFICIENT_DATA");
  });

  it("puts a disagreement ahead of everything else", () => {
    expect(assessGap([evidence({ kind: "FACT" })], 1)).toBe("CONFLICTING_DATA");
  });

  it("calls a case with nothing measured insufficient", () => {
    const result = assessGap(
      [evidence({ kind: "INFERENCE", sourceRecord: null, measuredAt: null })],
      0,
    );
    expect(result).toBe("INSUFFICIENT_DATA");
  });

  it("calls a case whose measurements have all aged out stale", () => {
    const old = new Date(Date.now() - 20 * DAY).toISOString();
    expect(assessGap([evidence({ kind: "FACT", measuredAt: old })], 0)).toBe("STALE_DATA");
  });

  it("is satisfied by fresh measurement", () => {
    expect(assessGap([evidence({ kind: "FACT" }), evidence({ kind: "CALCULATION" })], 0)).toBe(
      "NONE",
    );
  });

  it("is not satisfied when measurement is a small minority", () => {
    const soft = Array.from({ length: 6 }, () =>
      evidence({ kind: "INFERENCE", sourceRecord: null, measuredAt: null }),
    );
    expect(assessGap([evidence({ kind: "FACT" }), ...soft], 0)).toBe("INSUFFICIENT_DATA");
  });
});

describe("risk scoring states its method", () => {
  it("records the formula alongside the score", () => {
    const result = scoreRisk(80, "HIGH");
    expect(result.score).toBe(60);
    expect(result.severity).toBe("HIGH");
    expect(result.method).toMatch(/likelihood/i);
  });

  it("does not invent a score when likelihood was never measured", () => {
    const result = scoreRisk(null, "MEDIUM");
    expect(result.score).toBeNull();
    expect(result.severity).toBe("MEDIUM");
    expect(result.method).toMatch(/not measured/i);
  });

  it("reaches critical only at the top of the range", () => {
    expect(scoreRisk(100, "CRITICAL").severity).toBe("CRITICAL");
    expect(scoreRisk(20, "CRITICAL").severity).toBe("LOW");
  });
});
