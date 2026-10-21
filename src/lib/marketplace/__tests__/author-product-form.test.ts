import { describe, expect, it } from "vitest";
import { validateAuthorProductDraft } from "../author-product-form";

describe("author product form validation", () => {
  it("requires a trimmed product name of at least three characters", () => {
    expect(validateAuthorProductDraft({ name: "  ab  " })).toBe(
      "A product name of at least 3 characters is required.",
    );
  });

  it.each(["javascript:alert(1)", "ftp://example.com", "not a URL"])(
    "rejects unsupported demo URL %s",
    (demo_url) => {
      expect(validateAuthorProductDraft({ name: "Product", demo_url })).toBe(
        "demo_url must be an http(s) web address.",
      );
    },
  );

  it("validates public repository links and allows empty optional links", () => {
    expect(
      validateAuthorProductDraft({
        name: "Product",
        demo_url: "",
        public_repo_url: "https://github.com/example/project",
      }),
    ).toBeNull();
    expect(
      validateAuthorProductDraft({ name: "Product", public_repo_url: "file:///tmp/repo" }),
    ).toBe("public_repo_url must be an http(s) web address.");
  });

  it("rejects malformed feature JSON before submitting", () => {
    expect(validateAuthorProductDraft({ name: "Product", features: "[broken" })).toBe(
      "Features must contain valid JSON.",
    );
  });

  it("accepts optional valid JSON fields", () => {
    expect(
      validateAuthorProductDraft({ name: "Product", features: '["Analytics", {"api": true}]' }),
    ).toBeNull();
  });
});
