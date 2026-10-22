import { describe, expect, it } from "vitest";
import { publishedProductCount } from "./useCatalogueCounts";

describe("published homepage product count", () => {
  it("uses the live database count without a display cap", () => {
    expect(publishedProductCount({ products: 12_000 })).toBe(12_000);
  });

  it("omits a missing or invalid count instead of showing a fallback", () => {
    expect(publishedProductCount(null)).toBeNull();
    expect(publishedProductCount({ products: 0 })).toBeNull();
  });
});
