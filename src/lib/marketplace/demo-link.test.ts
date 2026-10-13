import { describe, expect, it } from "vitest";
import { demoNumbersForCards, demoNumbersInRow, marketplaceDemoHref } from "./demo-link";

describe("marketplace demo links", () => {
  it("opens the Software Vala demo gateway for a catalogue product with an active demo", () => {
    expect(marketplaceDemoHref({ hasDemo: true, slug: "routecommand-console" })).toBe(
      "/demo/routecommand-console",
    );
  });

  it("preserves an existing gateway URL for seeded demo cards", () => {
    expect(marketplaceDemoHref({ url: "/demo/existing-demo" })).toBe("/demo/existing-demo");
  });

  it("does not offer an absent demo or expose a third-party URL", () => {
    expect(
      marketplaceDemoHref({ hasDemo: false, slug: "product", url: "https://example.com" }),
    ).toBe(null);
    expect(marketplaceDemoHref({ hasDemo: true, url: "https://example.com" })).toBe(null);
  });

  it("numbers matching demos from one at the start of every row", () => {
    const firstRow = [{ hasDemo: false }, { hasDemo: true }, { hasDemo: true }];
    const secondRow = [{ hasDemo: true }, { hasDemo: false }, { hasDemo: true }];

    expect(demoNumbersInRow(firstRow)).toEqual([null, 1, 2]);
    expect(demoNumbersInRow(secondRow)).toEqual([1, null, 2]);
  });

  it("numbers 20 Education demos and six Real Estate demos independently without gaps", () => {
    for (const [category, count] of [
      ["education", 20],
      ["real-estate", 6],
    ] as const) {
      const cards = Array.from({ length: count }, (_, index) => ({
        id: `${category}-${index}`,
        status: "ACTIVE" as const,
        slug: `${category}-${index}`,
      }));
      const numbers = demoNumbersForCards(cards);
      expect(numbers).toEqual(Array.from({ length: count }, (_, index) => index + 1));
      expect(new Set(numbers).size).toBe(count);
    }
  });

  it("includes seeded gateway URLs without slugs and excludes cards without a live demo link", () => {
    expect(
      demoNumbersForCards([
        { id: "childcare", status: "ACTIVE", url: "/demo/childcare" },
        { id: "future", status: "COMING_SOON", url: "/demo/future" },
        { id: "missing", status: "ACTIVE" },
        { id: "external", status: "ACTIVE", url: "https://example.com" },
        { id: "catalogue", status: "ACTIVE", slug: "catalogue-product" },
      ]),
    ).toEqual([1, null, null, null, 2]);
  });

  it("continues country-rail numbering after distinct static demos, not carousel copies", () => {
    const first = { id: "school", status: "ACTIVE" as const, slug: "school" };
    const second = { id: "childcare", status: "ACTIVE" as const, url: "/demo/childcare" };
    const staticNumbers = demoNumbersForCards([first, second, first, second]);
    expect(staticNumbers).toEqual([1, 2, null, null]);
    const offset = staticNumbers.filter((number) => number !== null).length;
    expect(
      demoNumbersForCards(
        [
          { id: "future", status: "COMING_SOON", slug: "future" },
          { id: "art", status: "ACTIVE", slug: "art" },
          { id: "bible", status: "ACTIVE", slug: "bible" },
        ],
        offset,
      ),
    ).toEqual([null, 3, 4]);
  });

  it("resets a filtered row and does not let an inactive copy consume a demo number", () => {
    const cards = [
      { id: "a", status: "ACTIVE" as const, slug: "a" },
      { id: "b", status: "COMING_SOON" as const, slug: "b" },
      { id: "b", status: "ACTIVE" as const, slug: "b" },
      { id: "b", status: "ACTIVE" as const, slug: "b" },
    ];
    expect(demoNumbersForCards(cards)).toEqual([1, null, 2, null]);
    expect(demoNumbersForCards(cards.slice(2))).toEqual([1, null]);
  });
});
