import { describe, expect, it, vi } from "vitest";
import {
  isPublicProduct,
  logProductReview,
  productCreationReview,
  productReviewFields,
} from "../product-safety";

describe("new-product QA review guard", () => {
  it.each([
    "QA Product",
    "test ERP",
    "AUTHOR-E2E-123",
    "DummyProduct",
    "SampleTracking",
    "Placeholder ERP",
    "QATestPlan",
  ])("forces %s hidden and into the existing review queue", (name) => {
    const review = productCreationReview(name);
    expect(review.review_required).toBe(true);
    expect(review.reason).toBeTruthy();
    expect(productReviewFields(review)).toEqual({
      visible: false,
      content_status: "in_review",
      moderation_status: "submitted",
    });
  });

  it.each([
    "School ERP",
    "QuoteStudio",
    "CodingDateStamp",
    "PolicyAttestation",
    "PrintEstimate",
    "TemplateStudio",
    "Latest CRM",
  ])("does not flag a substring in %s", (name) => {
    const review = productCreationReview(name);
    expect(review.review_required).toBe(false);
    expect(productReviewFields(review)).toEqual({});
  });

  it("logs the review flag and product id without logging product input", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const review = productCreationReview("QA Product");
    logProductReview(review, "author products", "p1");
    expect(warn).toHaveBeenCalledWith("[marketplace QA guard]", {
      source: "author products",
      product_id: "p1",
      ...review,
    });
    warn.mockRestore();
  });
});

describe("public reader and SEO publication eligibility", () => {
  it.each([
    undefined,
    null,
    {},
    { visible: false, content_status: "published" },
    { visible: true, content_status: "draft" },
    { visible: true, content_status: "in_review" },
    { visible: true, content_status: "archived" },
  ])("does not publish an absent, hidden or non-published tenant: %j", (tenant) => {
    expect(isPublicProduct(tenant)).toBe(false);
  });

  it("accepts only explicitly visible, published tenants", () => {
    expect(isPublicProduct({ visible: true, content_status: "published" })).toBe(true);
  });
});
