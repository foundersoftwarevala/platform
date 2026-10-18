import { describe, expect, it } from "vitest";
import { demoCatalogEntry, type CatalogDemoRow } from "./catalog";

const demo: CatalogDemoRow = {
  id: "real-demo-id",
  demo_name: "Clinic",
  status: "active",
  processing_status: "live",
  marketplace_products: {
    name: "Clinic Management",
    slug: "clinic-management",
    marketplace_categories: { name: "Healthcare" },
  },
};

describe("canonical demo catalogue", () => {
  it("uses the assigned category and branded product URL", () => {
    expect(demoCatalogEntry(demo, 210)).toEqual({
      id: "real-demo-id",
      number: 211,
      name: "Clinic Management",
      category: "Healthcare",
      live: true,
      url: "/demo/clinic-management",
    });
  });

  it.each(["review", "failed", "investigating", "unprocessed"])(
    "does not advertise %s as a verified live demo",
    (processing_status) => {
      expect(demoCatalogEntry({ ...demo, processing_status }, 0).url).toBeNull();
    },
  );

  it("preserves unmatched rows without inventing a category or link", () => {
    expect(demoCatalogEntry({ ...demo, marketplace_products: null }, 4)).toMatchObject({
      number: 5,
      name: "Clinic",
      category: null,
      url: null,
    });
  });

  it("preserves global numbers when a view is filtered", () => {
    const entries = [demo, { ...demo, id: "second", status: "inactive" }].map(demoCatalogEntry);
    expect(entries.filter((entry) => !entry.url)[0].number).toBe(2);
  });
});
