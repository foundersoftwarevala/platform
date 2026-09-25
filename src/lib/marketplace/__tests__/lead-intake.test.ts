import { describe, expect, it } from "vitest";
import { scoreLead } from "@/lib/marketplace/lead-intake";

/**
 * What the lead scorer actually does today.
 *
 * These were written before changing anything, because the Lead Manager has two
 * scorers writing to the same table and the only way to tell which behaviour is
 * worth keeping is to pin down what each one does first. This is the honest one:
 * it scores what the lead actually said about itself, records the evidence for
 * every point it awards, and refuses to invent a model confidence it does not
 * have.
 *
 * If a change here makes one of these fail, that is the point - the failure says
 * which behaviour moved.
 */

const bare = { cta_action: null, email: "someone@example.com" };

describe("scoreLead — the call to action", () => {
  it("scores a request for sales highest, because it is the strongest intent", () => {
    expect(scoreLead({ ...bare, cta_action: "contact_sales" }).score).toBe(30);
    expect(scoreLead({ ...bare, cta_action: "enterprise" }).score).toBe(30);
  });

  it("scores a demo request below sales contact", () => {
    expect(scoreLead({ ...bare, cta_action: "request_demo" }).score).toBe(25);
  });

  it("ranks the rest in descending order of what they imply", () => {
    const of = (cta: string) => scoreLead({ ...bare, cta_action: cta }).score;
    expect(of("callback")).toBe(20);
    expect(of("whatsapp")).toBe(15);
    expect(of("brochure")).toBe(8);
  });

  it("treats a brochure download as research, not intent", () => {
    const [factor] = scoreLead({ ...bare, cta_action: "brochure" }).factors;
    expect(factor?.factor).toBe("brochure");
    expect(factor?.evidence).toMatch(/research rather than intent/i);
  });

  it("falls back to a general enquiry, and says so, when the action is unknown", () => {
    const unknown = scoreLead({ ...bare, cta_action: "something_new" });
    expect(unknown.score).toBe(5);
    expect(unknown.factors[0]?.evidence).toContain("something_new");

    const missing = scoreLead({ ...bare, cta_action: null });
    expect(missing.score).toBe(5);
    expect(missing.factors[0]?.evidence).toContain("unspecified");
  });
});

describe("scoreLead — what the lead supplied", () => {
  it("adds points only for details that are actually present", () => {
    const base = scoreLead({ ...bare, cta_action: "callback" }).score;
    expect(scoreLead({ ...bare, cta_action: "callback", product_id: "p1" }).score).toBe(base + 15);
    expect(scoreLead({ ...bare, cta_action: "callback", phone: "9876543210" }).score).toBe(
      base + 12,
    );
    expect(scoreLead({ ...bare, cta_action: "callback", company: "Acme" }).score).toBe(base + 10);
    expect(scoreLead({ ...bare, cta_action: "callback", country: "India" }).score).toBe(base + 3);
  });

  it("ignores a phone number too short to dial", () => {
    const short = scoreLead({ ...bare, cta_action: "callback", phone: "12345" });
    expect(short.factors.some((f) => f.factor === "phone_given")).toBe(false);

    const long = scoreLead({ ...bare, cta_action: "callback", phone: "1234567" });
    expect(long.factors.some((f) => f.factor === "phone_given")).toBe(true);
  });

  it("ignores a company name that is only whitespace", () => {
    const blank = scoreLead({ ...bare, cta_action: "callback", company: "   " });
    expect(blank.factors.some((f) => f.factor === "company_given")).toBe(false);
  });

  it("rewards a requirement only once it is longer than 120 characters", () => {
    const at120 = scoreLead({ ...bare, cta_action: "callback", requirements: "x".repeat(120) });
    expect(at120.factors.some((f) => f.factor === "detailed_requirement")).toBe(false);

    const at121 = scoreLead({ ...bare, cta_action: "callback", requirements: "x".repeat(121) });
    const factor = at121.factors.find((f) => f.factor === "detailed_requirement");
    expect(factor).toBeDefined();
    expect(factor?.evidence).toContain("121 characters");
  });
});

describe("scoreLead — the guarantees the rest of the system relies on", () => {
  it("gives every factor a weight and a human-readable reason", () => {
    const full = scoreLead({
      cta_action: "contact_sales",
      product_id: "p1",
      phone: "9876543210",
      company: "Acme",
      country: "India",
      requirements: "y".repeat(200),
    });
    expect(full.factors.length).toBeGreaterThan(1);
    for (const f of full.factors) {
      expect(f.weight).toBeGreaterThan(0);
      expect(f.evidence.trim().length).toBeGreaterThan(0);
      expect(f.factor).toMatch(/^[a-z_]+$/);
    }
  });

  it("adds up to the sum of its factors, and never leaves the 0-100 range", () => {
    const full = scoreLead({
      cta_action: "contact_sales",
      product_id: "p1",
      phone: "9876543210",
      company: "Acme",
      country: "India",
      requirements: "y".repeat(200),
    });
    // 30 sales + 15 product + 12 phone + 10 company + 10 requirement + 3 country
    expect(full.score).toBe(80);
    expect(full.score).toBe(full.factors.reduce((t, f) => t + f.weight, 0));
    expect(full.score).toBeLessThanOrEqual(100);
    expect(full.score).toBeGreaterThanOrEqual(0);
  });

  it("calls a lead insufficient when the call to action is all it has", () => {
    expect(scoreLead({ ...bare, cta_action: "callback" }).sufficient).toBe(false);
    expect(scoreLead({ ...bare, cta_action: "callback", company: "Acme" }).sufficient).toBe(true);
  });

  it("reports coverage as the share of signals the lead supplied, not a confidence", () => {
    // One factor out of the seven the model counts.
    expect(scoreLead({ ...bare, cta_action: "callback" }).coverage).toBe(14);

    const full = scoreLead({
      cta_action: "contact_sales",
      product_id: "p1",
      phone: "9876543210",
      company: "Acme",
      country: "India",
      requirements: "y".repeat(200),
    });
    // Six factors, because only ever one of them comes from the call to action.
    expect(full.factors).toHaveLength(6);
    expect(full.coverage).toBe(86);
  });

  it("cannot reach full coverage, because only six factors can ever be awarded", () => {
    // Recorded deliberately. The divisor is seven but the scorer adds at most
    // six factors, so coverage tops out at 86% even for a lead that gave
    // everything it could. Anything reading confidence should know that 86 is
    // this scorer's maximum, not a shortfall in the lead.
    const everything = scoreLead({
      cta_action: "contact_sales",
      product_id: "p1",
      phone: "9876543210",
      company: "Acme",
      country: "India",
      requirements: "y".repeat(500),
      email: "someone@example.com",
    });
    expect(everything.coverage).toBeLessThan(100);
    expect(everything.coverage).toBe(86);
  });
});
