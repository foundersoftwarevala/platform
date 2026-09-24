import { describe, expect, it } from "vitest";

import {
  comparePages,
  fingerprint,
  hammingDistance,
  htmlToText,
  jaccard,
  judgeOnePage,
  maskTerms,
  maskedFingerprint,
  normalizeUrl,
  shingles,
  simhash64,
  tokenize,
  THRESHOLDS,
} from "../fingerprint";

/**
 * The fingerprint engine exists to answer one question at scale: is this page
 * a real page, or is it the neighbouring page with the country name swapped?
 *
 * These tests are written around that question. The shared blueprint across
 * 7,280 slots must survive; the country swap must not.
 */

const blueprint = (country: string, category: string, product: string, tail: string) =>
  `${category} Software in ${country}. ` +
  `Best ${category} software for ${country} businesses. ` +
  `The product currently listed for ${country} is ${product}. ` +
  `Pricing in ${country} is shown on this page as the catalogue records it. ` +
  `Software Vala sells a one-time lifetime licence rather than a subscription. ` +
  `Local implementation and support in ${country}. ` +
  `Integrations and source code. Frequently asked questions. ` +
  `Is ${category} software available for businesses in ${country}? ` +
  `How much does ${category} software cost in ${country}? ` +
  `Can I see a live demo before buying? Do I get the source code? ` +
  tail;

describe("normalising", () => {
  it("keeps the words that tell pages apart", () => {
    const tokens = tokenize("Healthcare Software in Kenya — Nairobi, KES pricing!");
    expect(tokens).toContain("healthcare");
    expect(tokens).toContain("kenya");
    expect(tokens).toContain("nairobi");
    expect(tokens).toContain("kes");
  });

  it("strips markup, scripts and styles from HTML", () => {
    const text = htmlToText(
      `<html><head><style>.a{color:red}</style><script>var x=1</script></head>` +
        `<body><h1>Healthcare &amp; More</h1><p>In Kenya</p></body></html>`,
    );
    expect(text).toBe("Healthcare & More In Kenya");
    expect(text).not.toContain("color");
    expect(text).not.toContain("var x");
  });

  it("decodes the entities the renderer actually writes", () => {
    // The renderer writes an apostrophe as &#x27;, which once cost every
    // Cote d'Ivoire page its place in the sitemap.
    const text = htmlToText(
      "<p>Academy Software in Cote d&#x27;Ivoire &amp; more &#38; still more</p>",
    );
    expect(text).toBe("Academy Software in Cote d'Ivoire & more & still more");
  });

  it("does not turn an escaped entity into a character", () => {
    expect(htmlToText("<p>&amp;#x27;</p>")).toBe("&#x27;");
  });

  it("reduces a URL to the part that identifies a page", () => {
    expect(normalizeUrl("https://softwarevala.net/marketplace/healthcare/kenya/")).toBe(
      "/marketplace/healthcare/kenya",
    );
    expect(normalizeUrl("/marketplace/healthcare/kenya?utm_source=x#top")).toBe(
      "/marketplace/healthcare/kenya",
    );
  });
});

describe("masking", () => {
  it("replaces whole words only, longest term first", () => {
    const masked = maskTerms("South Africa sits in Africa and uses Healthcare Software", {
      country: "South Africa",
      region: "Africa",
      category: "Healthcare",
    });
    expect(masked).toContain("{country}");
    expect(masked).toContain("{region}");
    expect(masked).toContain("{category}");
    // "South Africa" must not have been eaten as "Africa", leaving "south".
    expect(masked).not.toContain("south");
  });

  it("does not mask a term that only appears inside another word", () => {
    const masked = maskTerms("the ukulele shop", { country: "UK" });
    expect(masked).toBe("the ukulele shop");
  });
});

describe("hashing", () => {
  it("gives identical text an identical simhash and zero distance", () => {
    const a = simhash64(tokenize("healthcare software in kenya for clinics"));
    const b = simhash64(tokenize("healthcare software in kenya for clinics"));
    expect(a).toBe(b);
    expect(hammingDistance(a, b)).toBe(0);
  });

  it("gives unrelated text a large distance", () => {
    const a = simhash64(tokenize(blueprint("Kenya", "Healthcare", "AppointMed", "")));
    const b = simhash64(
      tokenize("A logistics fleet tracker with GPS telemetry, fuel logs and driver rosters."),
    );
    expect(hammingDistance(a, b)).toBeGreaterThan(THRESHOLDS.nearSimhashBits);
  });

  it("measures shingle overlap", () => {
    const a = shingles(tokenize("one two three four five six"));
    const b = shingles(tokenize("one two three four five six"));
    expect(jaccard(a, b)).toBe(1);
    expect(jaccard(a, shingles(tokenize("alpha beta gamma delta epsilon zeta")))).toBe(0);
  });

  it("produces a fingerprint carrying a hash, a simhash and a token count", () => {
    const print = fingerprint("title", "Healthcare Software in Kenya");
    expect(print.hash).toHaveLength(64);
    expect(print.simhash).toHaveLength(16);
    expect(print.tokens).toBe(4);
  });
});

describe("the country-swap case", () => {
  it("calls two pages that differ only by their names a low-value duplicate", () => {
    const kenya = {
      url: "/marketplace/healthcare/kenya",
      body: blueprint("Kenya", "Healthcare", "AppointMed", ""),
      terms: { country: "Kenya", category: "Healthcare", product: "AppointMed" },
    };
    const ghana = {
      url: "/marketplace/healthcare/ghana",
      body: blueprint("Ghana", "Healthcare", "ClinicFlow", ""),
      terms: { country: "Ghana", category: "Healthcare", product: "ClinicFlow" },
    };

    const verdict = comparePages(kenya, ghana);
    expect(verdict.exactBodyMatch).toBe(false);
    expect(verdict.maskedMatch).toBe(true);
    expect(verdict.classification).toBe("LOW_VALUE_DUPLICATE");
  });

  it("lets two pages through once each has substance of its own", () => {
    const kenya = {
      url: "/marketplace/healthcare/kenya",
      body: blueprint(
        "Kenya",
        "Healthcare",
        "AppointMed",
        "Clinics billing through the national insurer must file claims electronically, and the " +
          "product records a claims module with batch submission and rejection handling. " +
          "Deployment is cloud with an offline appointment book for intermittent connectivity.",
      ),
      terms: { country: "Kenya", category: "Healthcare", product: "AppointMed" },
    };
    const ghana = {
      url: "/marketplace/healthcare/ghana",
      body: blueprint(
        "Ghana",
        "Healthcare",
        "ClinicFlow",
        "The listed product is an on-premise hospital information system with a pharmacy stock " +
          "ledger, theatre scheduling and a laboratory results interface. It records no claims " +
          "module. Training is delivered on site over two weeks.",
      ),
      terms: { country: "Ghana", category: "Healthcare", product: "ClinicFlow" },
    };

    const verdict = comparePages(kenya, ghana);
    expect(verdict.maskedMatch).toBe(false);
    expect(verdict.classification).not.toBe("LOW_VALUE_DUPLICATE");
    expect(verdict.classification).not.toBe("EXACT_DUPLICATE");
  });

  it("calls word-for-word identical pages an exact duplicate", () => {
    const body = blueprint("Kenya", "Healthcare", "AppointMed", "");
    const verdict = comparePages(
      { url: "/a", body, terms: { country: "Kenya" } },
      { url: "/b", body, terms: { country: "Kenya" } },
    );
    expect(verdict.classification).toBe("EXACT_DUPLICATE");
    expect(verdict.exactBodyMatch).toBe(true);
  });

  it("does not condemn a shared blueprint on its own", () => {
    // Same eight headings, genuinely different everything else.
    const headings =
      "Features and Modules. Pricing. Local implementation and support. " +
      "Integrations and source code. Frequently asked questions.";
    const a = {
      url: "/marketplace/healthcare/kenya",
      body:
        `${headings} A clinic appointment and billing system with an insurance claims module, ` +
        "electronic patient records, a pharmacy counter and a laboratory results feed. " +
        "Priced once, installed on the practice's own server or hosted.",
      terms: { country: "Kenya", category: "Healthcare", product: "AppointMed" },
    };
    const b = {
      url: "/marketplace/logistics/kenya",
      body:
        `${headings} A fleet and freight platform with GPS telemetry, fuel reconciliation, ` +
        "driver rosters, proof-of-delivery capture and customs paperwork for cross-border runs. " +
        "Sold with full source and a warehouse scanner client.",
      terms: { country: "Kenya", category: "Logistics", product: "FleetRun" },
    };

    const verdict = comparePages(a, b);
    expect(verdict.maskedMatch).toBe(false);
    expect(["TEMPLATE_ONLY", "VALID_VARIATION"]).toContain(verdict.classification);
  });
});

describe("thinness", () => {
  it("fails a page with too few words, with no neighbour needed", () => {
    const verdict = judgeOnePage({
      url: "/marketplace/healthcare/kenya",
      body: "Healthcare Software in Kenya. Coming soon.",
      terms: { country: "Kenya", category: "Healthcare" },
    });
    expect(verdict.thin).toBe(true);
    expect(verdict.reason).toContain("words of visible text");
  });

  it("passes a page with real substance", () => {
    const verdict = judgeOnePage({
      url: "/marketplace/healthcare/kenya",
      body: blueprint("Kenya", "Healthcare", "AppointMed", "").repeat(2),
      terms: { country: "Kenya", category: "Healthcare", product: "AppointMed" },
    });
    expect(verdict.thin).toBe(false);
    expect(verdict.tokens).toBeGreaterThanOrEqual(THRESHOLDS.minBodyTokens);
  });
});

describe("masked fingerprint", () => {
  it("is stable for the same page and differs when substance differs", () => {
    const terms = { country: "Kenya", category: "Healthcare", product: "AppointMed" };
    const body = blueprint("Kenya", "Healthcare", "AppointMed", "");
    expect(maskedFingerprint(body, terms).hash).toBe(maskedFingerprint(body, terms).hash);
    expect(maskedFingerprint(body, terms).hash).not.toBe(
      maskedFingerprint(`${body} An offline appointment book for intermittent connectivity.`, terms)
        .hash,
    );
  });
});
