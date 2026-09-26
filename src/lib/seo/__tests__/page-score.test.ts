import { describe, expect, it } from "vitest";
import { scoreBand, scorePage, type PageEvidence } from "@/lib/seo/page-score";

/**
 * What a page's SEO score is allowed to claim.
 *
 * The property that matters most: a component with no evidence is not scored.
 * A page that has never been crawled must not come back as "0 out of 100" -
 * that reads as a terrible page rather than an unexamined one, and every
 * decision made from the number depends on telling those two apart.
 */

const sound: PageEvidence = {
  url: "https://softwarevala.net/marketplace/school-erp/india",
  crawl: {
    title: "School ERP Software in India | Software Vala",
    meta_description:
      "School ERP software for Indian schools: admissions, attendance, fees and report cards, ready to deploy.",
    h1: "School ERP Software in India",
    canonical_url: "https://softwarevala.net/marketplace/school-erp/india",
    word_count: 640,
    index_status: "indexable",
    schema_json: [{ "@type": "SoftwareApplication", name: "School ERP" }],
    http_status: 200,
  },
  gate: {
    state: "READY_FOR_INDEX",
    indexable: true,
    sitemap_eligible: true,
    canonical_status: "ok",
    schema_status: "ok",
    hreflang_status: "ok",
    content_status: "ok",
    http_status: 200,
    blocking_reason: null,
    fingerprint_class: "UNIQUE",
  },
  links: { inbound: 12, outbound: 40 },
  geo: { country: "India", language: "en", hreflang_group: "school-erp" },
  advertised: true,
};

describe("scorePage — a sound page", () => {
  it("scores high and finds nothing serious", () => {
    const result = scorePage(sound);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.issues.filter((i) => i.severity === "critical")).toHaveLength(0);
    expect(result.source).toBe("both");
  });

  it("judges every component", () => {
    const result = scorePage(sound);
    for (const [name, component] of Object.entries(result.components)) {
      expect(component.unverified, name).toBe(false);
      expect(component.score, name).not.toBeNull();
    }
  });
});

describe("scorePage — evidence it does not have", () => {
  it("returns null, not zero, for a page nothing is known about", () => {
    const result = scorePage({ url: "https://softwarevala.net/unknown" });
    expect(result.score).toBeNull();
    expect(result.source).toBe("none");
    expect(result.issues).toHaveLength(0);
  });

  it("marks a component unverified rather than failing it", () => {
    const result = scorePage({ url: sound.url, crawl: sound.crawl });
    expect(result.components.links.unverified).toBe(true);
    expect(result.components.links.score).toBeNull();
    expect(result.components.geo.unverified).toBe(true);
    expect(result.components.content.unverified).toBe(false);
  });

  it("does not let an unjudged component drag the total down", () => {
    // Crawl evidence only. The score must reflect the content and technical
    // checks that ran, not be diluted towards zero by the four that could not.
    const result = scorePage({ url: sound.url, crawl: sound.crawl });
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it("says which evidence it used", () => {
    expect(scorePage({ url: sound.url, crawl: sound.crawl }).source).toBe("crawl");
    expect(scorePage({ url: sound.url, gate: sound.gate }).source).toBe("gate");
    expect(scorePage(sound).source).toBe("both");
  });
});

describe("scorePage — the failures it must catch", () => {
  const withCrawl = (patch: Partial<NonNullable<PageEvidence["crawl"]>>): PageEvidence => ({
    ...sound,
    crawl: { ...sound.crawl!, ...patch },
  });

  it("calls a missing title critical", () => {
    const result = scorePage(withCrawl({ title: "" }));
    expect(result.issues.some((i) => i.code === "title_missing" && i.severity === "critical")).toBe(true);
  });

  it("catches a relative canonical, which is the fault found in production", () => {
    const result = scorePage(withCrawl({ canonical_url: "/marketplace/product/education" }));
    const issue = result.issues.find((i) => i.code === "canonical_relative");
    expect(issue?.severity).toBe("high");
    expect(issue?.remediation).toMatch(/absolute/i);
  });

  it("catches thin content", () => {
    const result = scorePage(withCrawl({ word_count: 44 }));
    expect(result.issues.some((i) => i.code === "thin_content")).toBe(true);
  });

  it("catches a page nothing links to", () => {
    const result = scorePage({ ...sound, links: { inbound: 0, outbound: 40 } });
    expect(result.issues.some((i) => i.code === "orphan" && i.severity === "high")).toBe(true);
  });

  it("catches a duplicate the gate has already judged", () => {
    const result = scorePage({
      ...sound,
      gate: { ...sound.gate!, fingerprint_class: "LOW_VALUE_DUPLICATE" },
    });
    expect(result.issues.some((i) => i.code === "duplicate")).toBe(true);
  });

  it("catches both directions of sitemap drift", () => {
    const advertisedButBlocked = scorePage({
      ...sound,
      advertised: true,
      gate: { ...sound.gate!, sitemap_eligible: false },
    });
    expect(advertisedButBlocked.issues.some((i) => i.code === "advertised_not_eligible")).toBe(true);

    const eligibleButHidden = scorePage({ ...sound, advertised: false });
    expect(eligibleButHidden.issues.some((i) => i.code === "eligible_not_advertised")).toBe(true);
  });

  it("calls an unfetchable page critical", () => {
    const result = scorePage({
      ...sound,
      gate: { ...sound.gate!, http_status: 504 },
    });
    expect(result.issues.some((i) => i.code === "http_status" && i.severity === "critical")).toBe(true);
  });

  it("gives every finding something to do about it", () => {
    const broken = scorePage({
      ...sound,
      crawl: { ...sound.crawl!, title: "", h1: "", word_count: 10, canonical_url: null },
    });
    expect(broken.issues.length).toBeGreaterThan(3);
    for (const issue of broken.issues) {
      expect(issue.remediation.length, issue.code).toBeGreaterThan(20);
      expect(issue.detail.length, issue.code).toBeGreaterThan(3);
    }
  });

  it("puts the worst findings first", () => {
    const broken = scorePage({
      ...sound,
      crawl: { ...sound.crawl!, title: "", meta_description: "" },
    });
    const order = ["critical", "high", "medium", "low"];
    const seen = broken.issues.map((i) => order.indexOf(i.severity));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it("weighs one critical failure more heavily than several cosmetic ones", () => {
    const oneCritical = scorePage(withCrawl({ title: "" }));
    const threeCosmetic = scorePage(
      withCrawl({ title: "ERP", meta_description: "short", canonical_url: sound.crawl!.canonical_url }),
    );
    expect(oneCritical.components.content.score!).toBeLessThan(
      threeCosmetic.components.content.score! + 1,
    );
  });
});

describe("scoreBand", () => {
  it("separates unverified from bad", () => {
    expect(scoreBand(null)).toBe("unverified");
    expect(scoreBand(0)).toBe("critical");
  });

  it("bands the rest", () => {
    expect(scoreBand(49)).toBe("critical");
    expect(scoreBand(60)).toBe("warning");
    expect(scoreBand(80)).toBe("fair");
    expect(scoreBand(95)).toBe("healthy");
  });
});
