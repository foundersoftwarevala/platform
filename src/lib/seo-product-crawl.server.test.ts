import { describe, expect, it, vi } from "vitest";

import {
  isBrokenSeoHttpStatus,
  scanSeoProductUrls,
  SEO_PRODUCT_CRAWL_CONCURRENCY,
  SEO_PRODUCT_CRAWL_LIMIT,
} from "./seo-product-crawl.server";

describe("SEO product URL crawler", () => {
  it("records HTTP 404 and 500 responses as broken while leaving successful pages clear", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      const status = url.pathname.includes("missing")
        ? 404
        : url.pathname.includes("error")
          ? 500
          : 200;
      return new Response(null, { status });
    });

    const results = await scanSeoProductUrls(
      [
        { url: "https://softwarevala.net/marketplace/product/missing", sourceUrl: null },
        { url: "https://softwarevala.net/marketplace/product/error", sourceUrl: null },
        { url: "https://softwarevala.net/marketplace/product/healthy", sourceUrl: null },
      ],
      "https://softwarevala.net",
      { fetcher },
    );

    expect(results.map((result) => result.httpStatus)).toEqual([404, 500, 200]);
    expect(
      results.filter(
        (result) => result.httpStatus !== null && isBrokenSeoHttpStatus(result.httpStatus),
      ),
    ).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("limits concurrent requests to ten", async () => {
    let active = 0;
    let maximumActive = 0;
    const fetcher = vi.fn<typeof fetch>(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return new Response(null, { status: 200 });
    });
    const urls = Array.from({ length: SEO_PRODUCT_CRAWL_LIMIT }, (_, index) => ({
      url: `https://softwarevala.net/marketplace/product/product-${index}`,
      sourceUrl: null,
    }));

    await scanSeoProductUrls(urls, "https://softwarevala.net", { fetcher });

    expect(maximumActive).toBe(SEO_PRODUCT_CRAWL_CONCURRENCY);
  });

  it("refuses non-site, insecure, and over-limit URLs before making requests", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      scanSeoProductUrls(
        [{ url: "https://example.org/product/1", sourceUrl: null }],
        "https://softwarevala.net",
        { fetcher },
      ),
    ).rejects.toThrow("only accepts HTTPS URLs on this site");
    await expect(
      scanSeoProductUrls(
        [{ url: "http://softwarevala.net/product/1", sourceUrl: null }],
        "https://softwarevala.net",
        { fetcher },
      ),
    ).rejects.toThrow("only accepts HTTPS URLs on this site");
    await expect(
      scanSeoProductUrls(
        Array.from({ length: SEO_PRODUCT_CRAWL_LIMIT + 1 }, (_, index) => ({
          url: `https://softwarevala.net/product/${index}`,
          sourceUrl: null,
        })),
        "https://softwarevala.net",
        { fetcher },
      ),
    ).rejects.toThrow("limited to 50 URLs");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("records connection failures without silently treating them as successful", async () => {
    const results = await scanSeoProductUrls(
      [{ url: "https://softwarevala.net/marketplace/product/unavailable", sourceUrl: null }],
      "https://softwarevala.net",
      { fetcher: vi.fn<typeof fetch>().mockRejectedValue(new Error("network unavailable")) },
    );

    expect(results[0]).toMatchObject({
      httpStatus: null,
      error: "network unavailable",
    });
  });
});
