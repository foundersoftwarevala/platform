import { describe, expect, it } from "vitest";
import { isPubliclyReachable } from "@/components/auth/RouteAccessGate";

/**
 * A sitemap may only advertise pages a visitor can actually reach.
 *
 * sitemap-pages.xml kept its own hand-written list of "public" pages while
 * RouteAccessGate kept the list of gated ones, and the two drifted. /support
 * is wrapped in RequireRole, and /vala-tv was gated to marketing and support,
 * yet both were advertised, so a crawler asking for either was served the
 * words "Checking workspace access..." and no content.
 *
 * /vala-tv is a storefront page and is public again, so it is asserted here
 * as public. /support is the operator console and stays gated; the customer's
 * way to reach us is /contact.
 */

describe("isPubliclyReachable", () => {
  it("keeps the genuinely public pages public", () => {
    for (const path of [
      "/",
      "/marketplace",
      "/ai/finder",
      "/ai/recommend",
      "/ai/compare",
      "/ai/assistant",
      "/academy",
      "/apply",
      "/vala-tv",
    ]) {
      expect(isPubliclyReachable(path), path).toBe(true);
    }
  });

  it("refuses the operator support console", () => {
    expect(isPubliclyReachable("/support")).toBe(false);
  });

  it("refuses the operator consoles", () => {
    for (const path of ["/control-panel", "/boss", "/manager", "/lead-manager"]) {
      expect(isPubliclyReachable(path), path).toBe(false);
    }
  });

  it("gates a child path the same way as its prefix", () => {
    // /vala-tv used to be the example here and is public now, so the rule is
    // shown with prefixes that are still gated.
    expect(isPubliclyReachable("/support/tickets")).toBe(false);
    expect(isPubliclyReachable("/control-panel/users")).toBe(false);
  });

  it("does not gate a page that merely starts with the same letters", () => {
    // /support-chatbot-blueprint must not be swallowed by /support.
    expect(isPubliclyReachable("/supportive")).toBe(true);
  });
});
