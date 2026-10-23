import { describe, expect, it } from "vitest";
import { LIVE_SECTIONS } from "./LiveSections";
import { marketplaceGroups, marketplacePrimary } from "./navigation";
import { filterSchema, navIdToLabel, sectionRegistry } from "./sectionRegistry";
import {
  hrefWithMarketplaceSection,
  parseFilterParams,
  resolveMarketplaceSection,
  urlWithMarketplaceSection,
} from "./workspaceNavigation";

describe("Marketplace Manager workspace navigation", () => {
  const labels = Object.keys(sectionRegistry);

  it("registers every sidebar label and all five primary destinations", () => {
    const groupLabels = marketplaceGroups.flatMap((group) => group.items.map((item) => item.label));

    expect(marketplaceGroups).toHaveLength(7);
    expect(groupLabels).toHaveLength(77);
    expect(new Set(groupLabels).size).toBe(77);
    expect(labels).toHaveLength(77);
    for (const label of groupLabels) expect(sectionRegistry[label]).toBeDefined();
    expect(marketplacePrimary).toHaveLength(5);
    for (const item of marketplacePrimary) expect(sectionRegistry[item.label]).toBeDefined();
  });

  it.each(Object.keys(sectionRegistry))("opens a direct URL for %s", (label) => {
    expect(
      resolveMarketplaceSection(
        `?section=${encodeURIComponent(label)}`,
        sectionRegistry,
        navIdToLabel,
      ),
    ).toBe(label);
  });

  it.each(Object.entries(navIdToLabel))("resolves the legacy section id %s", (id, label) => {
    expect(
      resolveMarketplaceSection(
        `?section=${encodeURIComponent(id)}`,
        sectionRegistry,
        navIdToLabel,
      ),
    ).toBe(label);
  });

  it("falls back to Dashboard for invalid sections", () => {
    expect(resolveMarketplaceSection("?section=not-a-section", sectionRegistry, navIdToLabel)).toBe(
      "Dashboard",
    );
  });

  it("preserves existing filter and deep-link parameters when the section changes", () => {
    expect(
      hrefWithMarketplaceSection(
        "https://example.test/marketplace-manager?status=draft&range=30d&product=sku#list",
        "Products",
      ),
    ).toBe("/marketplace-manager?status=draft&range=30d&product=sku&section=Products#list");
  });

  it("resolves a relative section URL against the current page", () => {
    expect(
      urlWithMarketplaceSection(
        "?status=draft#list",
        "Products",
        "https://example.test/marketplace-manager",
      ).href,
    ).toBe("https://example.test/marketplace-manager?status=draft&section=Products#list");
  });

  it("declares filter schemas only for product queue sections", () => {
    const productQueues = labels.filter((label) => LIVE_SECTIONS[label]?.resource === "products");
    expect(Object.keys(filterSchema).sort()).toEqual(productQueues.sort());
  });

  it.each(Object.keys(filterSchema))("parses the full product filter schema for %s", (section) => {
    const result = parseFilterParams(
      section,
      new URLSearchParams("status=draft&moderation=submitted&missing=description&range=7d"),
      new Date("2026-10-21T00:00:00.000Z"),
    );

    expect(result.invalidParameters).toEqual([]);
    expect(result.filters).toEqual([
      { column: "content_status", operator: "eq", value: "draft" },
      { column: "moderation_status", operator: "eq", value: "submitted" },
      { column: "description", operator: "is", value: "null" },
      { column: "created_at", operator: "gte", value: "2026-10-14T00:00:00.000Z" },
    ]);
  });

  it.each(Object.keys(filterSchema))("rejects invalid product filters for %s", (section) => {
    const result = parseFilterParams(
      section,
      "?status=not-a-status&moderation=not-a-decision&missing=unapproved_field&range=forever",
    );

    expect(result.filters).toEqual([]);
    expect(result.invalidParameters).toEqual(["status", "moderation", "missing", "range"]);
  });

  it.each(labels.filter((label) => !filterSchema[label]))(
    "ignores arbitrary URL params without changing them for non-queue section %s",
    (section) => {
      const search = new URLSearchParams(
        `section=${encodeURIComponent(section)}&status=not-a-status&arbitrary=value`,
      );
      const before = search.toString();

      expect(parseFilterParams(section, search)).toEqual({
        filters: [],
        invalidParameters: [],
      });
      expect(search.toString()).toBe(before);
    },
  );

  it("uses the selected allowlisted field for a missing-value filter", () => {
    expect(parseFilterParams("Products", "?missing=thumbnail_url").filters).toEqual([
      { column: "thumbnail_url", operator: "is", value: "null" },
    ]);
  });

  it.each(Object.keys(filterSchema))("uses default rows when %s has no filters", (section) => {
    expect(parseFilterParams(section, `?section=${encodeURIComponent(section)}`)).toEqual({
      filters: [],
      invalidParameters: [],
    });
  });

  it("leaves unrecognized parameters untouched for a product queue too", () => {
    const search = new URLSearchParams("status=draft&custom=view");
    const before = search.toString();
    expect(parseFilterParams("Products", search)).toEqual({
      filters: [{ column: "content_status", operator: "eq", value: "draft" }],
      invalidParameters: [],
    });
    expect(search.toString()).toBe(before);
  });
});
