import { describe, expect, it } from "vitest";
import { rescoreFromRecord } from "@/lib/lead-manager/api";

/**
 * The Lead Manager's re-score, pinned down.
 *
 * This used to store score_type "ai_quality" with a confidence of 82 and an
 * audit line reading "AI Re-Scored". There is no AI in this path - it is four
 * weights added together - and 82 was a constant typed into the source. These
 * tests exist so that nothing quietly puts a number like that back.
 */

const day = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * day).toISOString();

describe("rescoreFromRecord — confidence is coverage, not invention", () => {
  it("reports 100% coverage only when all four inputs are present", () => {
    const full = rescoreFromRecord({
      budget_range: "10L+",
      source: "referral",
      intent_score: 80,
      last_contact_at: daysAgo(1),
      created_at: daysAgo(2),
    });
    expect(full.coverage).toBe(100);
  });

  it("drops coverage for every input the lead did not supply", () => {
    expect(rescoreFromRecord({ created_at: daysAgo(1) }).coverage).toBe(25);
    expect(rescoreFromRecord({ created_at: daysAgo(1), source: "web" }).coverage).toBe(50);
    expect(
      rescoreFromRecord({ created_at: daysAgo(1), source: "web", budget_range: "6L" }).coverage,
    ).toBe(75);
  });

  it("never reports the old hardcoded 82 by accident", () => {
    const anything = rescoreFromRecord({ created_at: daysAgo(3), source: "web" });
    expect(anything.coverage).not.toBe(82);
    expect([0, 25, 50, 75, 100]).toContain(anything.coverage);
  });
});

describe("rescoreFromRecord — a missing intent score is missing, not 50", () => {
  it("adds nothing for engagement when there is no intent score and no contact", () => {
    const none = rescoreFromRecord({ created_at: daysAgo(0) });
    const engagement = none.factors.find((f) => f.factor === "engagement");
    expect(engagement?.weight).toBe(0);
    expect(engagement?.evidence).toMatch(/no intent score/i);
  });

  it("counts only the contact when the intent score is absent", () => {
    const contacted = rescoreFromRecord({ created_at: daysAgo(0), last_contact_at: daysAgo(1) });
    expect(contacted.factors.find((f) => f.factor === "engagement")?.weight).toBe(6);
  });

  it("uses the intent score when one actually exists", () => {
    const scored = rescoreFromRecord({ created_at: daysAgo(0), intent_score: 80 });
    // 80/4 = 20, no contact bonus.
    expect(scored.factors.find((f) => f.factor === "engagement")?.weight).toBe(20);
  });

  it("does not let engagement run past its ceiling", () => {
    const high = rescoreFromRecord({
      created_at: daysAgo(0),
      intent_score: 100,
      last_contact_at: daysAgo(1),
    });
    expect(high.factors.find((f) => f.factor === "engagement")?.weight).toBe(25);
  });
});

describe("rescoreFromRecord — the weights that were already there", () => {
  it("puts each budget band on the right weight, using the labels actually stored", () => {
    const at = (b: string) =>
      rescoreFromRecord({ created_at: daysAgo(0), budget_range: b }).factors.find(
        (f) => f.factor === "budget",
      )?.weight;
    // These five are the labels in the leads table today.
    expect(at("₹10L+")).toBe(25);
    expect(at("₹6L - ₹10L")).toBe(18);
    expect(at("₹3L - ₹6L")).toBe(10);
    expect(at("₹1L - ₹3L")).toBe(10);
    expect(at("Under ₹1L")).toBe(10);
    // Nothing recorded, and something that is not a band at all.
    expect(at("450000")).toBe(10);
    expect(
      rescoreFromRecord({ created_at: daysAgo(0) }).factors.find((f) => f.factor === "budget")?.weight,
    ).toBe(10);
  });

  it("does not let a band be promoted by the digits inside its label", () => {
    // The old test of this was two substring checks, so "₹6L - ₹10L" matched
    // "10L" and scored as the top band, and "₹3L - ₹6L" matched "6L" and scored
    // as the middle one. Only the open-ended band is the top band.
    const top = (b: string) =>
      rescoreFromRecord({ created_at: daysAgo(0), budget_range: b }).factors.find(
        (f) => f.factor === "budget",
      )?.weight;
    expect(top("₹6L - ₹10L")).not.toBe(25);
    expect(top("₹3L - ₹6L")).not.toBe(18);
    expect(top("₹10L+")).toBe(25);
  });

  it("reads a band the same however it is punctuated", () => {
    const at = (b: string) =>
      rescoreFromRecord({ created_at: daysAgo(0), budget_range: b }).factors.find(
        (f) => f.factor === "budget",
      )?.weight;
    expect(at("10L+")).toBe(25);
    expect(at("Rs 10L+")).toBe(25);
    expect(at("6l - 10l")).toBe(18);
    expect(at("₹6L-₹10L")).toBe(18);
  });

  it("keeps the stronger sources ahead of the rest", () => {
    const at = (s: string) =>
      rescoreFromRecord({ created_at: daysAgo(0), source: s }).factors.find(
        (f) => f.factor === "source",
      )?.weight;
    expect(at("referral")).toBe(18);
    expect(at("website")).toBe(18);
    expect(at("whatsapp")).toBe(18);
    expect(at("facebook")).toBe(10);
  });

  it("lets freshness decay by a point a day and stop at zero", () => {
    const at = (d: number) =>
      rescoreFromRecord({ created_at: daysAgo(d) }).factors.find((f) => f.factor === "freshness")?.weight;
    expect(at(0)).toBe(20);
    expect(at(5)).toBe(15);
    expect(at(20)).toBe(0);
    expect(at(90)).toBe(0);
  });
});

describe("rescoreFromRecord — the guarantees", () => {
  it("gives every factor a reason an operator can read", () => {
    const r = rescoreFromRecord({
      budget_range: "10L+",
      source: "referral",
      intent_score: 60,
      created_at: daysAgo(1),
    });
    expect(r.factors.length).toBeGreaterThan(0);
    for (const f of r.factors) {
      expect(f.evidence.trim().length).toBeGreaterThan(0);
      expect(f.factor).toMatch(/^[a-z_]+$/);
    }
  });

  it("stays inside its stated range whatever it is given", () => {
    const best = rescoreFromRecord({
      budget_range: "10L+",
      source: "referral",
      intent_score: 100,
      last_contact_at: daysAgo(1),
      created_at: daysAgo(0),
    });
    const worst = rescoreFromRecord({ created_at: daysAgo(999) });
    for (const r of [best, worst]) {
      expect(r.score).toBeGreaterThanOrEqual(5);
      expect(r.score).toBeLessThanOrEqual(99);
      expect(r.probability).toBeGreaterThanOrEqual(2);
      expect(r.probability).toBeLessThanOrEqual(97);
    }
    expect(worst.score).toBeLessThan(best.score);
  });

  it("adds up to the sum of its own factors", () => {
    const r = rescoreFromRecord({ budget_range: "6L", source: "web", created_at: daysAgo(2) });
    expect(r.score).toBe(r.factors.reduce((t, f) => t + f.weight, 0));
  });
});
