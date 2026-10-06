import { describe, expect, it } from "vitest";
import { marketplaceDemoHref } from "./demo-link";

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
});
