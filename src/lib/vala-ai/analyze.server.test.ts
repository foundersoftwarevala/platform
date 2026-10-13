// @vitest-environment node
import { describe, expect, it } from "vitest";

import { analyzeRequirement } from "./analyze.server.ts";

describe("requirement analyzer", () => {
  it("detects features from keywords", () => {
    const out = analyzeRequirement("A clinic website with login, appointment checkout via Stripe, and an admin dashboard");
    expect(out.features).toContain("Payment Integration");
    expect(out.features).toContain("User Authentication");
    expect(out.features).toContain("Admin Dashboard");
  });

  it("asks about payments when not mentioned", () => {
    const out = analyzeRequirement("A simple school website with photo gallery");
    expect(out.questions.some((q) => /payments/i.test(q))).toBe(true);
  });

  it("does not ask about payments when already mentioned", () => {
    const out = analyzeRequirement("A store with checkout and payment by card");
    expect(out.questions.some((q) => /payments/i.test(q))).toBe(false);
  });

  it("always returns the four analysis sections", () => {
    const out = analyzeRequirement("anything");
    expect(out).toHaveProperty("features");
    expect(out).toHaveProperty("optional");
    expect(out).toHaveProperty("deployment");
    expect(out).toHaveProperty("questions");
  });
});
