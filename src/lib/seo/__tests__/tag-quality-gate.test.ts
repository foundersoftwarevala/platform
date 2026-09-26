import { describe, expect, it } from "vitest";
import { checkTagBundle, type TagBundle } from "@/lib/seo/tag-quality-gate";

/**
 * What generated SEO output is refused for.
 *
 * A model writing about a catalogue it cannot see will assert that a product is
 * the country's number one with 10,000 customers and a 4.9 rating. None of that
 * is true or checkable, and all of it is the kind of claim that costs a site its
 * standing. These rules run with no provider configured, which is the state the
 * platform is in, so they can be relied on before a single key exists.
 */

const context = {
  category: "school erp",
  country: "India",
  knownCountries: ["India", "Kenya", "Germany", "United Arab Emirates"],
};

const good: TagBundle = {
  primary: "school erp software India",
  secondary: ["school management software India", "school erp system India"],
  longTail: ["cloud school erp for private schools in India"],
  semantic: ["student information system", "attendance management"],
  geo: ["school erp Mumbai"],
  entities: ["CBSE", "student record"],
  questions: ["What does school erp software cost in India?"],
  titleCandidates: ["School ERP Software in India | Software Vala"],
  metaDescriptionCandidates: ["School ERP software for Indian schools, ready to deploy."],
};

describe("checkTagBundle — a sound bundle", () => {
  it("passes and keeps everything", () => {
    const result = checkTagBundle(good, context);
    expect(result.ok).toBe(true);
    expect(result.cleaned?.secondary).toHaveLength(2);
    expect(result.findings.filter((f) => f.rule !== "missing_geo")).toHaveLength(0);
  });
});

describe("checkTagBundle — claims nothing can support", () => {
  it("drops superlatives", () => {
    const result = checkTagBundle(
      { ...good, secondary: [...good.secondary, "the best school erp India", "no.1 school erp India"] },
      context,
    );
    expect(result.ok).toBe(true);
    expect(result.cleaned!.secondary).toHaveLength(2);
    expect(result.findings.some((f) => f.rule === "superlative")).toBe(true);
  });

  it("drops invented statistics, ratings, review counts and prices", () => {
    const result = checkTagBundle(
      {
        ...good,
        longTail: [
          "school erp trusted by 10,000 customers",
          "school erp with 4.9 stars",
          "school erp with 2,500 reviews",
          "school erp at ₹5000 per month",
          "school erp 99% uptime",
        ],
      },
      context,
    );
    const rules = result.findings.map((f) => f.rule);
    expect(rules).toContain("fake_statistic");
    expect(rules).toContain("fake_rating");
    expect(rules).toContain("fake_review_count");
    expect(rules).toContain("fake_pricing");
    expect(rules).toContain("unsupported_percentage");
    expect(result.cleaned!.longTail).toHaveLength(0);
  });

  it("rejects the whole bundle when the primary keyword is itself a claim", () => {
    const result = checkTagBundle({ ...good, primary: "the best school erp India" }, context);
    expect(result.ok).toBe(false);
    expect(result.cleaned).toBeNull();
    expect(result.findings[0].rule).toBe("invalid_primary");
  });
});

describe("checkTagBundle — wrong subject", () => {
  it("rejects a bundle whose primary keyword is about another category", () => {
    const result = checkTagBundle({ ...good, primary: "hospital software India" }, context);
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.rule === "category_mismatch")).toBe(true);
  });

  it("drops keywords naming a country this slot is not for", () => {
    const result = checkTagBundle(
      { ...good, secondary: [...good.secondary, "school erp software Kenya"] },
      context,
    );
    expect(result.findings.some((f) => f.rule === "country_mismatch")).toBe(true);
    expect(result.cleaned!.secondary).not.toContain("school erp software Kenya");
  });

  it("notes, without rejecting, a primary keyword that omits the country", () => {
    const result = checkTagBundle({ ...good, primary: "school erp software" }, context);
    expect(result.ok).toBe(true);
    expect(result.findings.some((f) => f.rule === "missing_geo")).toBe(true);
  });
});

describe("checkTagBundle — shape", () => {
  it("removes duplicates, ignoring case and spacing", () => {
    const result = checkTagBundle(
      { ...good, secondary: ["school erp system India", "School  ERP System India"] },
      context,
    );
    expect(result.cleaned!.secondary).toHaveLength(1);
    expect(result.findings.some((f) => f.rule === "duplicate_keyword")).toBe(true);
  });

  it("drops stuffed phrases and URLs", () => {
    const result = checkTagBundle(
      { ...good, longTail: ["erp erp erp school India", "https://example.com/erp"] },
      context,
    );
    const rules = result.findings.map((f) => f.rule);
    expect(rules).toContain("keyword_stuffing");
    expect(rules).toContain("malformed_url");
  });

  it("rejects a bundle with no primary keyword", () => {
    const result = checkTagBundle({ ...good, primary: "  " }, context);
    expect(result.ok).toBe(false);
    expect(result.findings[0].rule).toBe("missing_primary");
  });

  it("rejects a bundle where almost nothing survived", () => {
    const result = checkTagBundle(
      { ...good, secondary: ["no.1 erp India"], longTail: ["erp with 4.9 stars"], semantic: [] },
      context,
    );
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.rule === "too_little_survived")).toBe(true);
  });
});
