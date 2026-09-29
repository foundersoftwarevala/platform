import { describe, expect, it } from "vitest";

import { normaliseDemoUrl, parseIntakeFile } from "./assign.server";
import { identityEvidence } from "./investigate.server";

/**
 * The file twelve thousand addresses will arrive as, and the evidence read from
 * the pages behind them.
 *
 * These are the parts that decide whether an address is understood at all, and
 * they are pure functions, so they are tested directly rather than through a
 * browser. What matters most is what they refuse: a column whose meaning is not
 * certain, and a file with no address in it.
 */

describe("parseIntakeFile", () => {
  it("reads a spreadsheet export whatever the header spelling", () => {
    const file = [
      "Demo URL,Product Slug,Product Name,Notes",
      "https://a.example.com/,counterpos,,by slug",
      "https://b.example.com/,,CounterPOS,by name",
    ].join("\n");
    const parsed = parseIntakeFile(file);
    expect(parsed.columns.url).toBe(0);
    expect(parsed.columns.productSlug).toBe(1);
    expect(parsed.columns.productName).toBe(2);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].product).toBe("counterpos");
    expect(parsed.rows[1].name).toBe("CounterPOS");
  });

  it("prefers a product id over a slug, as the hierarchy requires", () => {
    const file = [
      "url,product_id,product_slug",
      "https://a.example.com/,11111111-1111-4111-8111-111111111111,counterpos",
    ].join("\n");
    const parsed = parseIntakeFile(file);
    expect(parsed.rows[0].product).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("handles tabs, semicolons, quoted fields and a BOM", () => {
    const tabbed = parseIntakeFile("﻿link\tproduct\nhttps://a.example.com/\tCounterPOS");
    expect(tabbed.rows[0].url).toBe("https://a.example.com");
    expect(tabbed.rows[0].name).toBe("CounterPOS");

    const quoted = parseIntakeFile('url;product_name\n"https://b.example.com/";"Acme, Limited"');
    expect(quoted.rows[0].name).toBe("Acme, Limited");
  });

  it("accepts a headerless list of one address per line", () => {
    const parsed = parseIntakeFile("https://a.example.com/\nhttps://b.example.com/");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.detected[0]).toContain("no header");
  });

  it("counts the same address twice as one", () => {
    const parsed = parseIntakeFile(
      ["url", "https://a.example.com/", "https://a.example.com", "https://b.example.com/"].join("\n"),
    );
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.duplicatesInFile).toBe(1);
  });

  it("sets a malformed line aside with its reason and line number", () => {
    const parsed = parseIntakeFile(["url", "not-a-url", "", "ftp://x.example.com/", "https://ok.example.com/"].join("\n"));
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.invalid.map((i) => i.reason)).toContain("not an http address");
    expect(parsed.invalid.every((i) => i.line >= 2)).toBe(true);
  });

  it("refuses a file with no address column rather than importing nothing", () => {
    expect(() => parseIntakeFile("Company,Contact\nAcme,someone")).toThrowError(/SCHEMA_ERROR/);
  });

  it("refuses an empty file", () => {
    expect(() => parseIntakeFile("")).toThrowError(/SCHEMA_ERROR/);
  });

  it("leaves a column it cannot identify alone", () => {
    // `region` is not a product identifier and must not be read as one - guessing
    // which column holds the product is how a demo lands on the wrong one.
    const parsed = parseIntakeFile("url,region\nhttps://a.example.com/,Kenya");
    expect(parsed.rows[0].product).toBeNull();
    expect(parsed.rows[0].name).toBeNull();
  });
});

describe("normaliseDemoUrl", () => {
  it("treats a trailing slash as the same address", () => {
    expect(normaliseDemoUrl("https://a.example.com/")).toBe(normaliseDemoUrl("https://a.example.com"));
  });

  it("leaves an empty value empty", () => {
    expect(normaliseDemoUrl("   ")).toBe("");
  });
});

describe("identityEvidence", () => {
  const html = `<!doctype html><html><head>
    <title>CounterPOS — Retail till | Software Vala</title>
    <meta property="og:title" content="CounterPOS">
    <meta name="description" content="A till for a small shop.">
    <link rel="canonical" href="https://shop.example.com/counterpos">
    <script type="application/ld+json">{"@type":"SoftwareApplication","name":"CounterPOS"}</script>
    </head><body><h1>CounterPOS</h1><p>Sample data only.</p></body></html>`;

  it("reads the few things that identify a product", () => {
    const evidence = identityEvidence(html, "https://shop.example.com/counterpos", 200);
    expect(evidence.title).toContain("CounterPOS");
    expect(evidence.ogTitle).toBe("CounterPOS");
    expect(evidence.heading).toBe("CounterPOS");
    expect(evidence.jsonLdName).toBe("CounterPOS");
    expect(evidence.canonical).toBe("https://shop.example.com/counterpos");
    expect(evidence.description).toBe("A till for a small shop.");
    expect(evidence.httpStatus).toBe(200);
  });

  it("survives a page with none of it", () => {
    const evidence = identityEvidence("<html><body>hello</body></html>", "https://x.example.com/", 200);
    expect(evidence.title).toBeNull();
    expect(evidence.jsonLdName).toBeNull();
    expect(evidence.heading).toBeNull();
  });

  it("does not throw on malformed JSON-LD", () => {
    const broken = `<script type="application/ld+json">{not json}</script><title>T</title>`;
    expect(() => identityEvidence(broken, "https://x.example.com/", 200)).not.toThrow();
    expect(identityEvidence(broken, "https://x.example.com/", 200).jsonLdName).toBeNull();
  });

  it("keeps the evidence compact rather than storing the page", () => {
    const long = `<title>${"x".repeat(5000)}</title>`;
    const evidence = identityEvidence(long, "https://x.example.com/", 200);
    expect((evidence.title ?? "").length).toBeLessThanOrEqual(300);
  });
});
