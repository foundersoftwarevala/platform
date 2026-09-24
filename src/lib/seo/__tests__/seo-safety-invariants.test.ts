import { describe, expect, it } from "vitest";

import {
  applyCrossPageFindings,
  evaluatePage,
  INDEXABLE_STATES,
  type Decision,
  type PageFacts,
  type Rendered,
  type SeoState,
} from "../indexing-gate";

/**
 * The rules that must never be broken, stated as rules rather than as
 * examples.
 *
 * The tests beside this one check that particular pages get particular
 * verdicts. These check the properties that have to hold for every page the
 * gate will ever see, including the ones nobody has thought of yet. If one of
 * these fails, something is wrong with the gate itself and no page should be
 * published until it is fixed.
 */

const ALL_STATES: SeoState[] = [
  "READY_FOR_INDEX",
  "INDEX",
  "NOINDEX",
  "CONTENT_NOT_READY",
  "DRAFT",
  "TEST",
  "ARCHIVED",
  "BLOCKED",
  "UNVERIFIED",
  "ERROR",
];

const SITE = "softwarevala.net";

/** A page that passes everything, as the baseline to break in each test. */
function goodHtml(url = "/marketplace/healthcare/kenya"): string {
  const alternates =
    ["en-US", "en-KE", "en-GB", "en-AE"]
      .map((code) => `<link rel="alternate" hrefLang="${code}" href="https://${SITE}/x/${code}" />`)
      .join("") +
    `<link rel="alternate" hrefLang="x-default" href="https://${SITE}/marketplace/category/healthcare" />`;
  const filler = Array.from(
    { length: 40 },
    (_, i) =>
      `Clinics in Kenya run this Healthcare system with AppointMed for appointments, billing, ` +
      `patient records and reporting, paragraph ${i}. `,
  ).join("");
  return (
    `<html><head><title>Healthcare Software in Kenya | Price and Demo</title>` +
    `<meta name="description" content="Healthcare software for businesses in Kenya with a live demo and full source code." />` +
    `<link rel="canonical" href="https://${SITE}${url}" />${alternates}` +
    `<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList"}</script>` +
    `</head><body><h1>Healthcare Software in Kenya</h1><h2>Features and Modules</h2>` +
    `<p>AppointMed. ${filler}</p>` +
    `<a href="/marketplace">m</a><a href="/marketplace/category/healthcare">c</a>` +
    `<a href="/marketplace/country/kenya">k</a></body></html>`
  );
}

const facts = (over: Partial<PageFacts> = {}): PageFacts => ({
  url: "/marketplace/healthcare/kenya",
  entityType: "slot",
  site: SITE,
  publication: "published",
  entityExists: true,
  terms: { country: "Kenya", category: "Healthcare", product: "AppointMed" },
  countryKnown: true,
  categoryKnown: true,
  expectedHreflang: 5,
  minInternalLinks: 3,
  ...over,
});

const ok = (): Rendered => ({ status: 200, html: goodHtml() });

/** Every way a page can come back, healthy and unhealthy alike. */
const RENDERS: Array<[string, Rendered]> = [
  ["healthy", ok()],
  ["404", { status: 404, html: goodHtml() }],
  ["500", { status: 500, html: goodHtml() }],
  ["301", { status: 301, html: "" }],
  ["fetch failed", { status: null, html: null, error: "ECONNREFUSED" }],
  ["200 no body", { status: 200, html: null }],
  [
    "noindex",
    {
      status: 200,
      html: goodHtml().replace("<title>", `<meta name="robots" content="noindex" /><title>`),
    },
  ],
  ["no canonical", { status: 200, html: goodHtml().replace(/<link rel="canonical"[^>]*\/>/, "") }],
  ["foreign canonical", { status: 200, html: goodHtml().replace(SITE, "example.com") }],
  [
    "no title",
    { status: 200, html: goodHtml().replace(/<title>[^<]*<\/title>/, "<title></title>") },
  ],
  ["no h1", { status: 200, html: goodHtml().replace(/<h1[^>]*>[\s\S]*?<\/h1>/, "") }],
  [
    "thin",
    {
      status: 200,
      html: goodHtml().replace(/<p>[\s\S]*?<\/p>/, "<p>AppointMed Kenya Healthcare.</p>"),
    },
  ],
  [
    "bad schema",
    {
      status: 200,
      html: goodHtml().replace(
        '{"@context":"https://schema.org","@type":"BreadcrumbList"}',
        "{oops",
      ),
    },
  ],
  [
    "fabricated rating",
    {
      status: 200,
      html: goodHtml().replace(
        '{"@context":"https://schema.org","@type":"BreadcrumbList"}',
        '{"@context":"https://schema.org","@type":"SoftwareApplication","aggregateRating":{"ratingValue":5}}',
      ),
    },
  ],
];

const PUBLICATIONS: PageFacts["publication"][] = [
  "published",
  "draft",
  "test",
  "archived",
  "unknown",
];

function everyDecision(): Decision[] {
  const out: Decision[] = [];
  for (const [, rendered] of RENDERS) {
    for (const publication of PUBLICATIONS) {
      out.push(evaluatePage(facts({ publication }), rendered));
    }
  }
  return out;
}

describe("invariants that must hold for every page", () => {
  const decisions = everyDecision();

  it("covers a wide spread of outcomes, so the invariants are not vacuous", () => {
    expect(decisions.length).toBe(RENDERS.length * PUBLICATIONS.length);
    const states = new Set(decisions.map((decision) => decision.state));
    expect(states.size).toBeGreaterThanOrEqual(6);
    expect([...states].some((state) => INDEXABLE_STATES.has(state))).toBe(true);
  });

  it("never marks a page indexable outside the two indexable states", () => {
    for (const decision of decisions) {
      if (decision.indexable) expect(INDEXABLE_STATES.has(decision.state)).toBe(true);
    }
  });

  it("never lets a page into the sitemap that is not indexable", () => {
    for (const decision of decisions) {
      if (decision.sitemapEligible) expect(decision.indexable).toBe(true);
    }
  });

  it("never lets a page through with a failing required check", () => {
    for (const decision of decisions) {
      const failing = decision.checks.filter(
        (check) => check.required && check.result !== "PASS" && check.result !== "NOT_APPLICABLE",
      );
      if (failing.length) expect(decision.sitemapEligible).toBe(false);
    }
  });

  it("always says why, when it says no", () => {
    for (const decision of decisions) {
      if (!decision.sitemapEligible) {
        expect(decision.blockingReason, `${decision.state} gave no reason`).toBeTruthy();
      }
    }
  });

  it("never lets an unpublished record reach a crawler, whatever the page looks like", () => {
    for (const publication of PUBLICATIONS.filter((state) => state !== "published")) {
      for (const [, rendered] of RENDERS) {
        expect(evaluatePage(facts({ publication }), rendered).sitemapEligible).toBe(false);
      }
    }
  });

  it("never lets a page through that it could not fetch", () => {
    for (const publication of PUBLICATIONS) {
      const decision = evaluatePage(facts({ publication }), {
        status: null,
        html: null,
        error: "timeout",
      });
      expect(decision.sitemapEligible).toBe(false);
      expect(decision.indexable).toBe(false);
    }
  });

  it("keeps every state it can produce inside the declared set", () => {
    for (const decision of decisions) expect(ALL_STATES).toContain(decision.state);
  });

  it("scores nothing above a hundred or below zero", () => {
    for (const decision of decisions) {
      expect(decision.qualityScore).toBeGreaterThanOrEqual(0);
      expect(decision.qualityScore).toBeLessThanOrEqual(100);
    }
  });
});

describe("invariants of the cross-page pass", () => {
  it("cannot turn a blocked page into an eligible one", () => {
    const blocked = evaluatePage(facts({ publication: "draft" }), ok());
    const [after] = applyCrossPageFindings([{ decision: blocked }]);
    expect(after.sitemapEligible).toBe(false);
  });

  it("blocks both sides of an exact duplicate, never just one", () => {
    const a = evaluatePage(facts({ url: "/a" }), { status: 200, html: goodHtml("/a") });
    const b = evaluatePage(facts({ url: "/b" }), { status: 200, html: goodHtml("/b") });
    // Force the same body fingerprint, which is what an exact duplicate means.
    const shared = a.fingerprints.find((print) => print.layer === "body")!;
    b.fingerprints = b.fingerprints.map((print) =>
      print.layer === "body" ? { ...shared } : print,
    );
    const results = applyCrossPageFindings([{ decision: a }, { decision: b }]);
    expect(results.every((decision) => decision.sitemapEligible === false)).toBe(true);
    expect(results.every((decision) => decision.fingerprintClass === "EXACT_DUPLICATE")).toBe(true);
  });

  it("leaves a lone page eligible when nothing shares its content", () => {
    const only = evaluatePage(facts(), ok());
    const [after] = applyCrossPageFindings([{ decision: only }]);
    expect(after.sitemapEligible).toBe(true);
    expect(after.fingerprintClass).toBe("VALID_VARIATION");
  });
});
