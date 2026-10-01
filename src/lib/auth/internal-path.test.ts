import { describe, expect, it } from "vitest";

import { internalPath } from "./internal-path";

describe("where signing in may send you", () => {
  it.each([
    ["/checkout", "/checkout"],
    ["/marketplace/product/school-erp?buy=1", "/marketplace/product/school-erp?buy=1"],
    ["/account/purchases#licences", "/account/purchases#licences"],
  ])("keeps the path on this site: %s", (asked, kept) => {
    expect(internalPath(asked)).toBe(kept);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "/\\/evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "/\tevil",
    "evil.com",
    "",
    null,
    undefined,
  ])("refuses anything that leaves it: %s", (asked) => {
    expect(internalPath(asked as string | null | undefined)).toBeUndefined();
  });
});
