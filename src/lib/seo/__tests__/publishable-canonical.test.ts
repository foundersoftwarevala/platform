import { describe, expect, it } from "vitest";
import { publishableCanonical } from "@/lib/seo/page-overrides";

/**
 * What a stored canonical has to become before it is published.
 *
 * A sweep of all 7,347 product pages found one serving
 * `<link rel="canonical" href="/marketplace/product/education"/>`. Fifteen
 * seo_pages rows hold a path rather than a URL, and the value was handed to the
 * page exactly as stored. A relative canonical is resolved against whatever
 * host served it, so it cannot do the one job it exists for - saying which of
 * several URLs is the real one - and the same string was going into the page's
 * JSON-LD, where schema.org requires an absolute URL.
 */

const SITE = "https://softwarevala.net";

describe("publishableCanonical", () => {
  it("makes a stored path absolute", () => {
    expect(publishableCanonical("/marketplace/product/education")).toBe(
      `${SITE}/marketplace/product/education`,
    );
    expect(publishableCanonical("/pricing")).toBe(`${SITE}/pricing`);
  });

  it("leaves an absolute URL exactly as the operator wrote it", () => {
    const url = `${SITE}/marketplace/product/forecastcrm`;
    expect(publishableCanonical(url)).toBe(url);
  });

  it("accepts a path the operator typed without a leading slash", () => {
    expect(publishableCanonical("pricing")).toBe(`${SITE}/pricing`);
  });

  it("still refuses the testing domain, absolute or not", () => {
    expect(publishableCanonical("https://softwarewala.net/pricing")).toBeNull();
    expect(publishableCanonical("http://www.softwarewala.net/x")).toBeNull();
  });

  it("passes nothing through as nothing, so the caller keeps its own default", () => {
    expect(publishableCanonical(null)).toBeNull();
    expect(publishableCanonical("")).toBeNull();
  });

  it("never returns a relative value", () => {
    for (const stored of ["/a", "b", "/a/b/c", `${SITE}/d`]) {
      const out = publishableCanonical(stored);
      expect(out, stored).toMatch(/^https?:\/\//);
    }
  });
});
