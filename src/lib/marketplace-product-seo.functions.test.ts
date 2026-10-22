import { describe, expect, it } from "vitest";

import {
  createMarketplaceProductCountrySeoJsonLd,
  isMarketplaceSeoAiConfigurationError,
  normalizeMarketplaceSeoHashtags,
  parseMarketplaceProductCountrySeo,
  parseMarketplaceProductCountrySeoDraft,
  toMarketplaceProductCountrySeoRow,
} from "./marketplace-product-seo.functions";

const tags = Array.from({ length: 34 }, (_, index) => `softwaretag${index + 1}`);

describe("Marketplace product-country SEO validation", () => {
  it("stores exactly 35 unique hashtags and appends the mandatory brand tag", () => {
    const hashtags = normalizeMarketplaceSeoHashtags([
      ...tags,
      "#SoftwareVala",
      "#SOFTWAREVALA",
      "#softwaretag1",
    ]);

    expect(hashtags).toHaveLength(35);
    expect(hashtags.at(-1)).toBe("#softwarevala");
    expect(new Set(hashtags.map((tag) => tag.toLowerCase())).size).toBe(35);
  });

  it("rejects generated content without enough distinct valid hashtags", () => {
    expect(() => normalizeMarketplaceSeoHashtags(["#one", "#two", "#softwarevala"])).toThrow(
      "at least 34 unique",
    );
  });

  it("accepts bounded metadata and a two-line snippet from JSON", () => {
    const generated = parseMarketplaceProductCountrySeo(
      JSON.stringify({
        metaTitle: "Clinic software for clinics in Kenya",
        metaDescription: "Compare clinic software for Kenyan healthcare teams.",
        blogSnippet:
          "Choose software that fits your clinic workflow.\nReview features before deciding.",
        hashtags: tags,
      }),
    );

    expect(generated.hashtags).toHaveLength(35);
    expect(generated.hashtags.at(-1)).toBe("#softwarevala");
  });

  it("builds a reviewable product-country draft with 35 tags and conservative JSON-LD", () => {
    const draft = parseMarketplaceProductCountrySeoDraft(
      JSON.stringify({
        metaTitle: "Accreditation software in India",
        metaDescription: "Organize accreditation evidence and submissions with AccreditationDesk.",
        blogSnippet:
          "Organize accreditation evidence for your education team.\nReview requirements and submission packs in one workflow.",
        hashtags: tags,
      }),
      "AccreditationDesk",
      "Education",
    );

    expect(draft.hashtags).toHaveLength(35);
    expect(draft.hashtags.at(-1)).toBe("#softwarevala");
    expect(draft.schema).toEqual({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "AccreditationDesk",
      applicationCategory: "Education",
      description: draft.metaDescription,
    });
  });

  it("does not invent unavailable JSON-LD fields such as offers or ratings", () => {
    const schema = createMarketplaceProductCountrySeoJsonLd(
      "AccreditationDesk",
      "Education",
      "Organize accreditation evidence.",
    );
    expect(schema).not.toHaveProperty("offers");
    expect(schema).not.toHaveProperty("aggregateRating");
  });

  it("maps generated fields to the database column names", () => {
    const row = toMarketplaceProductCountrySeoRow({
      metaTitle: "Clinic software in Kenya",
      metaDescription: "Clinic tools for Kenyan teams.",
      blogSnippet: "Choose tools for your workflow.\nCompare the features.",
      hashtags: [...tags.slice(0, 34).map((tag) => `#${tag}`), "#softwarevala"],
    });

    expect(row).toEqual({
      meta_title: "Clinic software in Kenya",
      meta_description: "Clinic tools for Kenyan teams.",
      blog_snippet: "Choose tools for your workflow.\nCompare the features.",
      hashtags: [...tags.slice(0, 34).map((tag) => `#${tag}`), "#softwarevala"],
    });
  });

  it("rejects title overflow and snippets outside two or three lines", () => {
    const base = {
      metaTitle: "Valid title",
      metaDescription: "Valid description",
      blogSnippet: "First line\nSecond line",
      hashtags: tags,
    };
    expect(() =>
      parseMarketplaceProductCountrySeo(JSON.stringify({ ...base, metaTitle: "x".repeat(61) })),
    ).toThrow("invalid Marketplace SEO fields");
    expect(() =>
      parseMarketplaceProductCountrySeo(JSON.stringify({ ...base, blogSnippet: "Only one line" })),
    ).toThrow("invalid Marketplace SEO fields");
    expect(() =>
      parseMarketplaceProductCountrySeo(
        JSON.stringify({ ...base, blogSnippet: "One\nTwo\nThree\nFour" }),
      ),
    ).toThrow("invalid Marketplace SEO fields");
  });

  it("rejects malformed JSON", () => {
    expect(() => parseMarketplaceProductCountrySeo("{")).toThrow("invalid JSON");
  });

  it("recognizes missing or rejected AI credentials for the pending-configuration UI", () => {
    expect(
      isMarketplaceSeoAiConfigurationError("No active AI service is configured in AI API Manager."),
    ).toBe(true);
    expect(isMarketplaceSeoAiConfigurationError("OpenAI API: Incorrect API key provided.")).toBe(
      true,
    );
    expect(isMarketplaceSeoAiConfigurationError("Anthropic API: invalid x-api-key")).toBe(true);
    expect(isMarketplaceSeoAiConfigurationError("AI provider returned invalid JSON.")).toBe(false);
    expect(isMarketplaceSeoAiConfigurationError("Marketplace SEO database request failed.")).toBe(
      false,
    );
  });
});
