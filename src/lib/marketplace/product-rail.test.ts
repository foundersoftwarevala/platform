import { describe, expect, it } from "vitest";
import { countryCardCapacity, fillProductRail, HOMEPAGE_CARDS_PER_ROW } from "./product-rail";

describe("homepage product rails", () => {
  it("fills short rows to exactly 100 without changing product data", () => {
    const active = { id: "school", status: "ACTIVE" as const, url: "/demo/school" };
    const upcoming = { id: "future", status: "COMING_SOON" as const, url: "/demo/future" };
    const row = fillProductRail([upcoming, active]);

    expect(HOMEPAGE_CARDS_PER_ROW).toBe(100);
    expect(row).toHaveLength(100);
    expect(row[0]).toBe(active);
    expect(row[1]).toBe(upcoming);
    expect(row[2]).toBe(active);
    expect(row.some((product) => product.url === "/demo/school")).toBe(true);
  });

  it("caps long rows at 100 and keeps active demos before coming-soon cards", () => {
    const products = Array.from({ length: 140 }, (_, index) => ({
      id: `product-${index}`,
      status: index < 115 ? ("COMING_SOON" as const) : ("ACTIVE" as const),
      url: `/demo/product-${index}`,
    }));
    const row = fillProductRail(products);

    expect(row).toHaveLength(100);
    expect(row.slice(0, 25).every((product) => product.status === "ACTIVE")).toBe(true);
    expect(row.slice(25).every((product) => product.status === "COMING_SOON")).toBe(true);
    expect(row.map((product) => product.id)).toEqual(
      Array.from({ length: 25 }, (_, index) => `product-${115 + index}`).concat(
        Array.from({ length: 75 }, (_, index) => `product-${index}`),
      ),
    );
    expect(products[0]?.url).toBe("/demo/product-0");
  });

  it("uses only the remaining space for country cards and never exceeds 100", () => {
    const staticProducts = Array.from({ length: 80 }, (_, index) => ({ id: `static-${index}` }));

    expect(countryCardCapacity(staticProducts, 100)).toBe(20);
    expect(
      fillProductRail(
        staticProducts.map((product) => ({ ...product, status: "ACTIVE" as const })),
        HOMEPAGE_CARDS_PER_ROW - countryCardCapacity(staticProducts, 100),
      ),
    ).toHaveLength(80);
    expect(
      countryCardCapacity(
        Array.from({ length: 120 }, (_, index) => ({ id: `${index}` })),
        100,
      ),
    ).toBe(0);
    expect(countryCardCapacity([], 15)).toBe(15);
  });

  it("returns no filler when a row has no product to repeat", () => {
    expect(fillProductRail([])).toEqual([]);
    expect(fillProductRail([{ id: "one", status: "ACTIVE" as const }], 0)).toEqual([]);
  });

  it("rejects invalid row sizes instead of silently rendering the wrong count", () => {
    expect(() => fillProductRail([{ id: "one", status: "ACTIVE" as const }], -1)).toThrow(
      RangeError,
    );
    expect(() => countryCardCapacity([], 1.5)).toThrow(RangeError);
  });
});
