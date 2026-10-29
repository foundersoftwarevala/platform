import { describe, expect, it } from "vitest";

import {
  prepareResellerSeoAssets,
  RESELLER_APPLICATION_URL,
  RESELLER_SEO_COUNTRIES,
  type GeneratedCountrySeo,
} from "./seo-bulk-reseller.functions";

function generatedCountry(country: string): GeneratedCountrySeo {
  return {
    country,
    keyword: `software reseller opportunity ${country}`,
    metaTitle: `Software reseller in ${country} | Software Vala`,
    metaDescription: `Explore the Software Vala reseller program for ${country}.`,
    hashtags: [
      `#Reseller${country.replace(/\s+/g, "")}`,
      "#SoftwareVala",
      "#SoftwareReseller",
      "#BusinessPartner",
      "#ChannelPartner",
      "#BusinessOpportunity",
      "#B2BSoftware",
      "#ResellerProgram",
      "#BusinessSoftware",
      "#SoftwareDistribution",
    ],
  };
}

describe("prepareResellerSeoAssets", () => {
  it("creates one review draft per configured country with the fixed application destination", () => {
    const assets = prepareResellerSeoAssets(RESELLER_SEO_COUNTRIES.map(generatedCountry));

    expect(assets).toHaveLength(10);
    for (const asset of assets) {
      expect(asset.role_type).toBe("reseller");
      expect(asset.status).toBe("draft");
      expect(asset.backlink_url).toBe(RESELLER_APPLICATION_URL);
      expect(asset.meta_description).toContain(RESELLER_APPLICATION_URL);
      expect(asset.hashtag.split(" ")).toHaveLength(10);
      expect(asset.hashtag.split(" ")).toContain("#SoftwareVala");
      expect(asset.meta_title.length).toBeLessThanOrEqual(60);
    }
  });

  it("adds the required brand tag and does not accept external backlink destinations", () => {
    const assets = prepareResellerSeoAssets(
      RESELLER_SEO_COUNTRIES.map((country) => ({
        ...generatedCountry(country),
        hashtags: ["#UniqueTag"],
      })),
    );

    expect(assets.every((asset) => asset.hashtag.includes("#SoftwareVala"))).toBe(true);
    expect(assets.every((asset) => asset.backlink_url === RESELLER_APPLICATION_URL)).toBe(true);
  });

  it("fails explicitly when the generator omits a configured country", () => {
    expect(() => prepareResellerSeoAssets([generatedCountry("India")])).toThrow(
      "The AI response omitted Philippines.",
    );
  });
});
