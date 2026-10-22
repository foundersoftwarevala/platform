import { describe, expect, it } from "vitest";
import { railCardToDemo } from "./country-rail";

const catalogueCard = {
  id: "product-123",
  slug: "retail-pos-suite",
  name: "Retail POS Suite",
  icon: "ShoppingCart",
  industry: "Retail & POS",
  price: "$249",
  period: "one-time",
  country: "India",
  href: "/marketplace/product/retail-pos-suite",
  description: "A published point-of-sale product.",
  features: ["Inventory", "Receipts"],
  tech: ["React"],
  subcategory: "Point of Sale",
  hasDemo: false,
};

describe("catalogue card conversion for the homepage", () => {
  it("preserves the database product identity and recorded details", () => {
    expect(
      railCardToDemo(catalogueCard, "Retail & POS", "from-cyan-600 to-blue-600"),
    ).toMatchObject({
      id: "catalogue-product-123",
      slug: "retail-pos-suite",
      name: "Retail POS Suite",
      url: "/marketplace/product/retail-pos-suite",
      category: "Point of Sale",
      masterCategory: "Retail & POS",
      description: "A published point-of-sale product.",
      status: "COMING_SOON",
      price: "$249",
      discountPrice: "",
      features: ["Inventory", "Receipts"],
    });
  });

  it("marks only products with an active catalogue demo as live", () => {
    expect(
      railCardToDemo(
        { ...catalogueCard, hasDemo: true },
        "Retail & POS",
        "from-cyan-600 to-blue-600",
      ).status,
    ).toBe("ACTIVE");
  });
});
