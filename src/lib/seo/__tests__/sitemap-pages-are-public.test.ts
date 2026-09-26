import { describe, expect, it } from "vitest";
import { isPubliclyReachable } from "@/components/auth/RouteAccessGate";

/**
 * A sitemap may only advertise pages a visitor can actually reach.
 *
 * sitemap-pages.xml kept its own hand-written list of "public" pages while
 * RouteAccessGate kept the list of gated ones, and the two drifted. /support
 * is wrapped in RequireRole and /vala-tv is gated to marketing and support, yet
 * both were advertised, so a crawler asking for either was served the words
 * "Checking workspace access..." and no content - a thin, duplicate page
 * submitted to the index on purpose.
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
    ]) {
      expect(isPubliclyReachable(path), path).toBe(true);
    }
  });

  it("refuses the two that are gated to staff roles", () => {
    expect(isPubliclyReachable("/support")).toBe(false);
    expect(isPubliclyReachable("/vala-tv")).toBe(false);
  });

  it("refuses the operator consoles", () => {
    for (const path of ["/control-panel", "/boss", "/manager", "/lead-manager"]) {
      expect(isPubliclyReachable(path), path).toBe(false);
    }
  });

  it("gates a child path the same way as its prefix", () => {
    expect(isPubliclyReachable("/vala-tv/anything")).toBe(false);
    expect(isPubliclyReachable("/control-panel/users")).toBe(false);
  });

  it("does not gate a page that merely starts with the same letters", () => {
    // /support-chatbot-blueprint must not be swallowed by /support.
    expect(isPubliclyReachable("/supportive")).toBe(true);
  });
});
