import { describe, expect, it } from "vitest";
import { deriveSource, slotPathFrom } from "@/lib/marketplace/lead-attribution";

/**
 * Which channel is allowed to claim a lead.
 *
 * Every capture was filed as "marketplace" while leads.source has had `seo`,
 * `ads`, `social` and `referral` in its enum all along. Getting this wrong in
 * the generous direction is the expensive mistake: an SEO programme credited
 * with bought traffic reports a success it did not have, and the budget moves
 * the wrong way.
 */

describe("deriveSource", () => {
  it("credits SEO for a search arrival", () => {
    const { source, why } = deriveSource({ search_engine: "google", referrer: "https://www.google.com/search?q=erp" });
    expect(source).toBe("seo");
    expect(why).toContain("google");
  });

  it("credits ads, not SEO, when the click was paid for", () => {
    // A search ad has a search engine as its referrer. Counting it as SEO
    // credits the free channel for bought traffic.
    for (const medium of ["cpc", "ppc", "paid", "paidsearch", "display", "retargeting"]) {
      const { source } = deriveSource({ search_engine: "google", utm_medium: medium });
      expect(source, medium).toBe("ads");
    }
  });

  it("credits SEO when the campaign says organic", () => {
    for (const medium of ["organic", "organic_search", "seo"]) {
      expect(deriveSource({ utm_medium: medium }).source, medium).toBe("seo");
    }
  });

  it("credits social for a social referrer", () => {
    for (const referrer of [
      "https://www.linkedin.com/feed/",
      "https://www.facebook.com/x",
      "https://t.co/abc",
      "https://www.reddit.com/r/erp",
    ]) {
      expect(deriveSource({ referrer }).source, referrer).toBe("social");
    }
  });

  it("credits referral for a newsletter or an affiliate", () => {
    expect(deriveSource({ utm_medium: "email", utm_source: "newsletter" }).source).toBe("referral");
    expect(deriveSource({ utm_medium: "affiliate" }).source).toBe("referral");
  });

  it("credits referral for an ordinary site that linked to us", () => {
    expect(deriveSource({ referrer: "https://news.ycombinator.com/item?id=1" }).source).toBe("referral");
  });

  it("keeps the caller's own source when nothing external was seen", () => {
    expect(deriveSource({}).source).toBe("marketplace");
    expect(deriveSource(null).source).toBe("marketplace");
    expect(deriveSource({}, "website").source).toBe("website");
    expect(deriveSource({ landing_page: "/marketplace" }).why).toContain("no external signal");
  });
});

describe("slotPathFrom", () => {
  it("finds the slot a visit landed on", () => {
    expect(slotPathFrom("/marketplace/school-erp/india")).toBe("/marketplace/school-erp/india");
    expect(slotPathFrom("https://softwarevala.net/marketplace/finance-cat/cyprus")).toBe(
      "/marketplace/finance-cat/cyprus",
    );
  });

  it("prefers the landing page over the converting page", () => {
    // The slot that earned the visit is the one search ranked, not whichever
    // page they happened to be on when they filled the form in.
    expect(slotPathFrom("/marketplace/school-erp/india", "/marketplace/pos-billing/uae")).toBe(
      "/marketplace/school-erp/india",
    );
  });

  it("falls through to the converting page when the landing page is not a slot", () => {
    expect(slotPathFrom("/", "/marketplace/pos-billing/uae")).toBe("/marketplace/pos-billing/uae");
    expect(slotPathFrom(null, "/marketplace/pos-billing/uae")).toBe("/marketplace/pos-billing/uae");
  });

  it("does not mistake product, category or country pages for slots", () => {
    expect(slotPathFrom("/marketplace/product/ingredientstock")).toBeNull();
    expect(slotPathFrom("/marketplace/category/education-coaching")).toBeNull();
    expect(slotPathFrom("/marketplace/country/india")).toBeNull();
  });

  it("ignores a query string and a trailing slash", () => {
    expect(slotPathFrom("/marketplace/school-erp/india/?utm_source=x")).toBe(
      "/marketplace/school-erp/india",
    );
  });

  it("returns nothing rather than guessing", () => {
    expect(slotPathFrom(null, undefined, "")).toBeNull();
    expect(slotPathFrom("/about")).toBeNull();
    expect(slotPathFrom("/marketplace")).toBeNull();
    expect(slotPathFrom("/marketplace/a/b/c")).toBeNull();
  });
});
