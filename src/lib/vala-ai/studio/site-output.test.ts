import { describe, expect, it } from "vitest";
import { MAX_SITE_HTML_CHARACTERS, siteHtmlLimit, siteHtmlWarning } from "./site-output";

describe("Builder HTML character budgets", () => {
  it("preserves the existing large-document budget when no compact limit is requested", () => {
    expect(siteHtmlLimit("Build a website with 20 products")).toBe(MAX_SITE_HTML_CHARACTERS);
    expect(siteHtmlLimit("Keep the reply under 20 characters")).toBe(MAX_SITE_HTML_CHARACTERS);
  });
  it("honors exclusive and inclusive prompt limits", () => {
    expect(siteHtmlLimit("Keep the HTML under 900 characters")).toBe(899);
    expect(siteHtmlLimit("HTML below 900 chars")).toBe(899);
    expect(siteHtmlLimit("Document must be less than 900 chars")).toBe(899);
    expect(siteHtmlLimit("HTML at most 900 characters")).toBe(900);
    expect(siteHtmlLimit("Website maximum of 900 chars")).toBe(900);
  });
  it("uses the strictest explicit, prompt or safety limit", () => {
    expect(siteHtmlLimit("HTML under 900 chars", 500)).toBe(500);
    expect(siteHtmlLimit("HTML under 900 chars", 1000)).toBe(899);
    expect(siteHtmlLimit("HTML at most 200000 characters")).toBe(MAX_SITE_HTML_CHARACTERS);
    expect(siteHtmlLimit("HTML at most 1000 chars; document under 500 chars")).toBe(499);
  });
  it("rejects invalid or impossible limits before inference", () => {
    for (const limit of [0, -1, 1.5, NaN, Infinity, MAX_SITE_HTML_CHARACTERS + 1])
      expect(() => siteHtmlLimit("Build a website", limit)).toThrow();
    expect(() => siteHtmlLimit("HTML under 1 character")).toThrow();
    expect(() => siteHtmlLimit("HTML under 0 characters")).toThrow();
  });
  it("allows exactly the maximum and warns one character above it without changing HTML", () => {
    const html = "<h1>42</h1>";
    expect(siteHtmlWarning(html, html.length)).toBeNull();
    expect(siteHtmlWarning(html, html.length - 1)).toContain(`${html.length} characters`);
    expect(html).toBe("<h1>42</h1>");
  });
});
