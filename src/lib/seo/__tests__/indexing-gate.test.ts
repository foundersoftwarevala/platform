import { describe, expect, it } from "vitest";

import {
  applyCrossPageFindings,
  evaluatePage,
  extract,
  INDEXABLE_STATES,
  type PageFacts,
  type Rendered,
} from "../indexing-gate";

/**
 * The gate has one job: never let a page a crawler should not see reach the
 * sitemap. Every test here is a way that could go wrong.
 *
 * The rule under test throughout is fail closed - a check that cannot be
 * performed must not pass.
 */

const SITE = "softwarevala.net";

function html(overrides: Partial<Record<string, string>> = {}, bodyExtra = ""): string {
  const {
    title = "Healthcare Software in Kenya | Price, Demo & Source Code",
    h1 = "Healthcare Software in Kenya",
    description = "Healthcare software for businesses in Kenya. One-time lifetime licence, full source code and a live demo on Software Vala.",
    canonical = `https://${SITE}/marketplace/healthcare/kenya`,
    robots = "",
    jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "BreadcrumbList", itemListElement: [] },
        { "@type": "SoftwareApplication", name: "AppointMed", areaServed: { name: "Kenya" } },
      ],
    }),
  } = overrides as Record<string, string>;

  const alternates = Array.from(
    { length: 4 },
    (_, i) =>
      `<link rel="alternate" hrefLang="en-${["US", "KE", "GB", "AE"][i]}" href="https://${SITE}/marketplace/healthcare/c${i}" />`,
  ).join("");

  const body =
    `<h1>${h1}</h1>` +
    `<h2>Features and Modules</h2>` +
    `<p>AppointMed is the Healthcare product currently published for Kenya. ` +
    Array.from(
      { length: 40 },
      (_, i) =>
        `Clinics in Kenya use this Healthcare system for appointments, billing, patient records ` +
        `and reporting, item ${i}. `,
    ).join("") +
    bodyExtra +
    `</p>` +
    `<a href="/marketplace">Marketplace</a><a href="/marketplace/category/healthcare">Healthcare</a>` +
    `<a href="/marketplace/country/kenya">Kenya</a><a href="/marketplace/product/appointmed">AppointMed</a>`;

  return (
    `<html><head><title>${title}</title>` +
    `<meta name="description" content="${description}" />` +
    (robots ? `<meta name="robots" content="${robots}" />` : "") +
    `<link rel="canonical" href="${canonical}" />` +
    alternates +
    `<link rel="alternate" hrefLang="x-default" href="https://${SITE}/marketplace/category/healthcare" />` +
    `<script type="application/ld+json">${jsonLd}</script>` +
    `</head><body>${body}</body></html>`
  );
}

const facts = (over: Partial<PageFacts> = {}): PageFacts => ({
  url: "/marketplace/healthcare/kenya",
  entityType: "slot",
  entityId: null,
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

const ok = (body?: string): Rendered => ({ status: 200, html: html({}, body) });

describe("a healthy page", () => {
  it("is ready for index and eligible for the sitemap", () => {
    const decision = evaluatePage(facts(), ok());
    expect(decision.blockingReason).toBeNull();
    expect(decision.state).toBe("READY_FOR_INDEX");
    expect(decision.indexable).toBe(true);
    expect(decision.sitemapEligible).toBe(true);
    expect(decision.qualityStatus).toBe("PASS");
    expect(decision.qualityScore).toBe(100);
  });

  it("records a fingerprint for every layer it reads", () => {
    const layers = evaluatePage(facts(), ok()).fingerprints.map((print) => print.layer);
    expect(layers).toContain("body");
    expect(layers).toContain("body_masked");
    expect(layers).toContain("title");
  });
});

describe("fail closed", () => {
  it("blocks a draft record before it looks at the page at all", () => {
    const decision = evaluatePage(facts({ publication: "draft" }), ok());
    expect(decision.state).toBe("DRAFT");
    expect(decision.indexable).toBe(false);
    expect(decision.sitemapEligible).toBe(false);
  });

  it("blocks a test record", () => {
    expect(evaluatePage(facts({ publication: "test" }), ok()).state).toBe("TEST");
  });

  it("blocks an archived record", () => {
    expect(evaluatePage(facts({ publication: "archived" }), ok()).state).toBe("ARCHIVED");
  });

  it("refuses a record whose publication state is unknown", () => {
    const decision = evaluatePage(facts({ publication: "unknown" }), ok());
    expect(decision.state).toBe("UNVERIFIED");
    expect(decision.indexable).toBe(false);
  });

  it("refuses a page it could not fetch", () => {
    const decision = evaluatePage(facts(), { status: null, html: null, error: "ECONNREFUSED" });
    expect(decision.state).toBe("ERROR");
    expect(decision.indexable).toBe(false);
    expect(decision.blockingReason).toContain("ECONNREFUSED");
  });

  it("refuses a 200 with no body", () => {
    expect(evaluatePage(facts(), { status: 200, html: null }).state).toBe("ERROR");
  });

  it("blocks a non-200 page", () => {
    const decision = evaluatePage(facts(), { status: 404, html: html() });
    expect(decision.state).toBe("BLOCKED");
    expect(decision.blockingReason).toContain("404");
  });

  it("blocks a URL with no record behind it", () => {
    expect(evaluatePage(facts({ entityExists: false }), ok()).state).toBe("BLOCKED");
  });

  it("honours a page that asks not to be indexed", () => {
    const decision = evaluatePage(facts(), {
      status: 200,
      html: html({ robots: "noindex, follow" }),
    });
    expect(decision.state).toBe("NOINDEX");
    expect(decision.sitemapEligible).toBe(false);
  });
});

describe("canonical", () => {
  it("blocks a page with no canonical", () => {
    const raw = html().replace(/<link rel="canonical"[^>]*\/>/, "");
    const decision = evaluatePage(facts(), { status: 200, html: raw });
    expect(decision.canonicalStatus).toBe("FAIL");
    expect(decision.indexable).toBe(false);
  });

  it("blocks a canonical on another domain", () => {
    const decision = evaluatePage(facts(), {
      status: 200,
      html: html({ canonical: "https://softwarewala.net/marketplace/healthcare/kenya" }),
    });
    expect(decision.canonicalStatus).toBe("FAIL");
    expect(decision.blockingReason).toContain("softwarewala.net");
  });

  it("keeps a page out of the sitemap when its canonical names another URL", () => {
    const decision = evaluatePage(facts(), {
      status: 200,
      html: html({ canonical: `https://${SITE}/marketplace/healthcare/uganda` }),
    });
    expect(decision.sitemapEligible).toBe(false);
    expect(decision.duplicateOf).toBe("/marketplace/healthcare/uganda");
  });
});

describe("metadata and content", () => {
  it("blocks placeholder text in the title", () => {
    const decision = evaluatePage(facts(), { status: 200, html: html({ title: "Coming soon" }) });
    expect(decision.indexable).toBe(false);
    expect(decision.blockingReason).toContain("title");
  });

  it("accepts a one-word heading, because a category's H1 is its category", () => {
    // Demanding two words of an H1 once blocked all ninety-one category pages,
    // whose headings are "Academy", "Healthcare", "Logistics".
    const raw = html().replace(/<h1[^>]*>[\s\S]*?<\/h1>/, "<h1>Healthcare</h1>");
    const decision = evaluatePage(facts(), { status: 200, html: raw });
    expect(decision.checks.find((check) => check.name === "h1")?.result).toBe("PASS");
  });

  it("still blocks an empty heading", () => {
    const raw = html().replace(/<h1[^>]*>[\s\S]*?<\/h1>/, "<h1>   </h1>");
    expect(evaluatePage(facts(), { status: 200, html: raw }).indexable).toBe(false);
  });

  it("blocks a missing description", () => {
    const raw = html().replace(/<meta name="description"[^>]*\/>/, "");
    expect(evaluatePage(facts(), { status: 200, html: raw }).indexable).toBe(false);
  });

  it("calls a thin page content-not-ready rather than blocked", () => {
    const raw =
      `<html><head><title>Healthcare Software in Kenya</title>` +
      `<meta name="description" content="Healthcare software for businesses in Kenya with a live demo." />` +
      `<link rel="canonical" href="https://${SITE}/marketplace/healthcare/kenya" />` +
      Array.from(
        { length: 5 },
        (_, i) =>
          `<link rel="alternate" hrefLang="${["en-US", "en-KE", "en-GB", "en-AE", "x-default"][i]}" href="https://${SITE}/x${i}" />`,
      ).join("") +
      `</head><body><h1>Healthcare Software in Kenya</h1>` +
      `<p>AppointMed for Kenya Healthcare.</p>` +
      `<a href="/a">a</a><a href="/b">b</a><a href="/c">c</a></body></html>`;
    const decision = evaluatePage(facts(), { status: 200, html: raw });
    expect(decision.contentStatus).toBe("FAIL");
    expect(decision.state).toBe("CONTENT_NOT_READY");
    expect(decision.sitemapEligible).toBe(false);
  });

  it("blocks a page that does not name what it is recorded against", () => {
    const raw = html().replace(/Kenya/g, "Uganda");
    const decision = evaluatePage(facts(), { status: 200, html: raw });
    expect(decision.indexable).toBe(false);
  });
});

describe("hreflang", () => {
  it("blocks a page with the wrong number of alternates", () => {
    const decision = evaluatePage(facts({ expectedHreflang: 81 }), ok());
    expect(decision.hreflangStatus).toBe("FAIL");
    expect(decision.indexable).toBe(false);
  });

  it("does not require alternates on a page whose architecture has none", () => {
    const raw = html().replace(/<link rel="alternate"[^>]*\/>/g, "");
    const decision = evaluatePage(facts({ expectedHreflang: null }), { status: 200, html: raw });
    expect(decision.hreflangStatus).toBe("NOT_APPLICABLE");
    expect(decision.indexable).toBe(true);
  });
});

describe("structured data", () => {
  it("blocks invalid JSON-LD", () => {
    const decision = evaluatePage(facts(), { status: 200, html: html({ jsonLd: "{not json" }) });
    expect(decision.schemaStatus).toBe("FAIL");
    expect(decision.indexable).toBe(false);
  });

  it("blocks a fabricated rating", () => {
    const decision = evaluatePage(facts(), {
      status: 200,
      html: html({
        jsonLd: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              name: "AppointMed",
              aggregateRating: { ratingValue: 4.8, reviewCount: 214 },
            },
          ],
        }),
      }),
    });
    expect(decision.schemaStatus).toBe("FAIL");
    expect(decision.blockingReason).toContain("aggregateRating");
  });
});

describe("the cross-page pass", () => {
  const withBody = (url: string, body: string, terms: Record<string, string>) => {
    const decision = evaluatePage(facts({ url, terms, expectedHreflang: 5 }), {
      status: 200,
      html: html({ canonical: `https://${SITE}${url}` }, body),
    });
    return { decision, body: decision.fingerprints.find((f) => f.layer === "body")!.sample, terms };
  };

  it("blocks two pages that are word for word the same", () => {
    const a = evaluatePage(facts({ url: "/a" }), {
      status: 200,
      html: html({ canonical: `https://${SITE}/a` }),
    });
    const b = evaluatePage(facts({ url: "/b" }), {
      status: 200,
      html: html({ canonical: `https://${SITE}/b` }),
    });
    const body = "identical body text";
    const [first, second] = applyCrossPageFindings([
      { decision: a, body, terms: a.fingerprints ? { country: "Kenya" } : {} },
      { decision: b, body, terms: { country: "Kenya" } },
    ]);
    expect(first.fingerprintClass).toBe("EXACT_DUPLICATE");
    expect(first.sitemapEligible).toBe(false);
    expect(second.sitemapEligible).toBe(false);
  });

  it("lets two genuinely different pages through", () => {
    const a = withBody(
      "/marketplace/healthcare/kenya",
      "Insurance claims batch filing in Nairobi clinics.",
      {
        country: "Kenya",
        category: "Healthcare",
        product: "AppointMed",
      },
    );
    const b = withBody(
      "/marketplace/logistics/kenya",
      "Fleet telemetry, fuel reconciliation and customs paperwork.",
      {
        country: "Kenya",
        category: "Logistics",
        product: "FleetRun",
      },
    );
    const results = applyCrossPageFindings([a, b]);
    for (const decision of results) {
      expect(["VALID_VARIATION", "TEMPLATE_ONLY", "NEAR_DUPLICATE"]).toContain(
        decision.fingerprintClass,
      );
    }
  });

  it("blocks a URL claimed by two records", () => {
    const a = evaluatePage(facts({ url: "/same" }), {
      status: 200,
      html: html({ canonical: `https://${SITE}/same` }),
    });
    const results = applyCrossPageFindings([
      { decision: a, body: "one", terms: {} },
      { decision: { ...a }, body: "two", terms: {} },
    ]);
    expect(results[0].checks.find((c) => c.name === "url_unique")?.result).toBe("FAIL");
    expect(results[0].sitemapEligible).toBe(false);
  });
});

describe("the state machine", () => {
  it("treats only READY_FOR_INDEX and INDEX as indexable", () => {
    expect([...INDEXABLE_STATES].sort()).toEqual(["INDEX", "READY_FOR_INDEX"]);
  });
});

describe("extraction", () => {
  it("reads a page's own account of itself", () => {
    const page = extract(html());
    expect(page.title).toContain("Healthcare Software in Kenya");
    expect(page.h1).toBe("Healthcare Software in Kenya");
    expect(page.hreflangCodes).toContain("x-default");
    expect(page.jsonLd).toHaveLength(1);
    expect(page.internalLinks.length).toBeGreaterThanOrEqual(4);
  });
});
