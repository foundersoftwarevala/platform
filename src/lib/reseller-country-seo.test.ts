import { describe, expect, it } from "vitest";

import {
  formatResellerCountrySeoDraft,
  parseResellerCountrySeo,
  RESELLER_SEO_COUNTRIES,
  RESELLER_SEO_LOCAL_HASHTAG_COUNT,
  RESELLER_SEO_MASTER_HASHTAGS,
  resellerCountrySeoHashtags,
} from "./reseller-country-seo";

function makeAiResponse(
  localHashtags = Array.from(
    { length: RESELLER_SEO_LOCAL_HASHTAG_COUNT },
    (_, i) => `#local_${i + 1}`,
  ),
) {
  return JSON.stringify({
    primaryLanguage: "English",
    metaTitle: "Software reseller opportunities in the USA",
    metaDescription: "Explore a software reseller opportunity for your business in the USA.",
    blogSnippet:
      "Build a software reseller business with practical digital products.\nExplore a flexible opportunity for your local market.",
    localHashtags,
  });
}

describe("reseller country SEO contracts", () => {
  it("keeps every supplied master hashtag and covers 100 unique countries", () => {
    expect(RESELLER_SEO_MASTER_HASHTAGS).toHaveLength(51);
    expect(RESELLER_SEO_MASTER_HASHTAGS[0]).toBe("#software reseller");
    expect(RESELLER_SEO_MASTER_HASHTAGS[50]).toBe("#Software Vala reseller");
    expect(RESELLER_SEO_COUNTRIES).toHaveLength(100);
    expect(new Set(RESELLER_SEO_COUNTRIES.map((country) => country.code)).size).toBe(100);
  });

  it("combines the exact master set with country-specific tags and localized fields", () => {
    const content = parseResellerCountrySeo(makeAiResponse());
    const hashtags = resellerCountrySeoHashtags(content.localHashtags, "US");
    const body = formatResellerCountrySeoDraft({ code: "US", name: "USA" }, content);

    expect(hashtags).toHaveLength(80);
    expect(hashtags.slice(0, RESELLER_SEO_MASTER_HASHTAGS.length)).toEqual(
      RESELLER_SEO_MASTER_HASHTAGS,
    );
    expect(hashtags.slice(RESELLER_SEO_MASTER_HASHTAGS.length)).toHaveLength(
      RESELLER_SEO_LOCAL_HASHTAG_COUNT,
    );
    expect(hashtags.slice(RESELLER_SEO_MASTER_HASHTAGS.length)).toEqual(
      content.localHashtags.map((tag) => `${tag}_us`),
    );
    expect(body).toContain("Meta title: Software reseller opportunities in the USA");
    expect(body).toContain("Meta description:");
    expect(body).toContain("Blog snippet:");
    for (const tag of RESELLER_SEO_MASTER_HASHTAGS) expect(body).toContain(tag);
  });

  it("rejects duplicate, malformed, or master-overlapping local tags", () => {
    expect(() =>
      parseResellerCountrySeo(
        makeAiResponse(
          Array.from({ length: RESELLER_SEO_LOCAL_HASHTAG_COUNT }, () => "#duplicate"),
        ),
      ),
    ).toThrow(`exactly ${RESELLER_SEO_LOCAL_HASHTAG_COUNT} unique local hashtags`);

    const malformed = Array.from(
      { length: RESELLER_SEO_LOCAL_HASHTAG_COUNT },
      (_, i) => `#local_${i + 1}`,
    );
    malformed[0] = "#two words";
    expect(() => parseResellerCountrySeo(makeAiResponse(malformed))).toThrow(
      "single, valid hashtag tokens",
    );

    const overlapsMaster = Array.from(
      { length: RESELLER_SEO_LOCAL_HASHTAG_COUNT },
      (_, i) => `#local_${i + 1}`,
    );
    overlapsMaster[0] = "#software_reseller_india";
    expect(() => parseResellerCountrySeo(makeAiResponse(overlapsMaster))).toThrow(
      "must not duplicate the master",
    );
  });
});
