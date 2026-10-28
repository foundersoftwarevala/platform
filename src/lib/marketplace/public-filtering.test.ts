import { describe, expect, it } from "vitest";
import type { MarketProduct, PublicStorefrontFilterGroup } from "@/lib/marketplace.functions";
import { filterPublicProducts } from "./public-filtering";

const product = (overrides: Partial<MarketProduct>): MarketProduct => ({
  id: "product",
  slug: "product",
  name: "Product",
  industry_label: "Education",
  icon: "Book",
  price_label: "$249",
  price_period: "lifetime",
  rating: 4.5,
  downloads: 0,
  downloads_label: null,
  badge: null,
  ...overrides,
});

const group = (source: string, combine: "and" | "or" = "or"): PublicStorefrontFilterGroup => ({
  key: source === "tag" ? "tags" : source,
  label: source,
  source,
  enabled: true,
  position: 1,
  select_mode: "multi",
  combine,
  visible_desktop: true,
  visible_mobile: true,
  values: [],
});

describe("filterPublicProducts", () => {
  it("applies configured facets against canonical product attributes", () => {
    const products = [
      product({ id: "cloud", deployment: "Cloud", is_trending: true }),
      product({ id: "premise", deployment: "On-premise", is_trending: false }),
    ];
    expect(
      filterPublicProducts(products, [group("deployment"), group("tag")], {
        deployment: ["Cloud"],
        tags: ["trending"],
      }).map((row) => row.id),
    ).toEqual(["cloud"]);
  });

  it("honors the configured AND/OR selection policy", () => {
    const products = [
      product({ id: "cloud", deployment: "Cloud", license: "MIT" }),
      product({ id: "premise", deployment: "On-premise", license: "MIT" }),
    ];
    const selections = { deployment: ["Cloud", "On-premise"] };
    expect(filterPublicProducts(products, [group("deployment", "or")], selections)).toHaveLength(2);
    expect(filterPublicProducts(products, [group("deployment", "and")], selections)).toHaveLength(
      0,
    );
  });

  it("does not filter by disabled groups or the already-selected category", () => {
    const productRow = product({ id: "keep" });
    const disabled = { ...group("industry"), enabled: false };
    expect(
      filterPublicProducts([productRow], [disabled, group("category")], {
        industry: ["Other"],
        category: ["another-category"],
      }),
    ).toEqual([productRow]);
  });
});
