import { describe, expect, it } from "vitest";
import { toCard } from "./catalog-card";

const row = {
  id: "product",
  slug: "product",
  category_id: "education",
  product_demo_urls: [
    { status: "active", url: "https://demo.example", detected_category_id: "education" },
  ],
};

describe("catalog card demo availability", () => {
  it("only exposes a nonblank active demo compatible with the product category", () => {
    expect(toCard(row).hasDemo).toBe(true);
    expect(
      toCard({
        ...row,
        product_demo_urls: [
          { status: "active", url: "https://demo.example", detected_category_id: "healthcare" },
        ],
      }).hasDemo,
    ).toBe(false);
    expect(
      toCard({
        ...row,
        product_demo_urls: [{ status: "active", url: "  ", detected_category_id: "education" }],
      }).hasDemo,
    ).toBe(false);
    expect(
      toCard({
        ...row,
        product_demo_urls: [{ status: "inactive", url: "https://demo.example" }],
      }).hasDemo,
    ).toBe(false);
  });
});
