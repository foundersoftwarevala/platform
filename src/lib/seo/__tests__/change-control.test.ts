import { describe, expect, it } from "vitest";
import { needsApproval } from "@/lib/seo/change-control.server";

/**
 * Which SEO changes are allowed to happen without anyone looking.
 *
 * The rule is deliberately blunt in one direction. Being wrong by asking for
 * approval costs an operator a click; being wrong by not asking costs a
 * catalogue, because one request that rewrites one card slot's keywords is one
 * request away from rewriting all 7,280.
 */

describe("needsApproval", () => {
  it("always asks when an AI proposed the change", () => {
    expect(
      needsApproval({ field: "meta_title_template", source: "ai", oldValue: null, newValue: "x" }),
    ).toBe(true);
    // Even filling something empty, because the next one will not be empty.
    expect(needsApproval({ field: "faq_set", source: "ai", oldValue: [], newValue: ["q"] })).toBe(true);
  });

  it("always asks for a field that decides whether a page can be indexed", () => {
    for (const field of ["index_status", "canonical_url", "robots", "indexnow_enabled", "status"]) {
      expect(
        needsApproval({ field, source: "manual", oldValue: "a", newValue: "b" }),
        field,
      ).toBe(true);
    }
  });

  it("asks before replacing a list that already has things in it", () => {
    expect(
      needsApproval({
        field: "keyword_set",
        source: "manual",
        oldValue: ["one", "two"],
        newValue: ["three"],
      }),
    ).toBe(true);
  });

  it("does not ask to fill a list that was empty", () => {
    expect(
      needsApproval({ field: "keyword_set", source: "manual", oldValue: [], newValue: ["a"] }),
    ).toBe(false);
  });

  it("does not ask for an ordinary operator edit to a text field", () => {
    expect(
      needsApproval({
        field: "meta_description_template",
        source: "manual",
        oldValue: "old",
        newValue: "new",
      }),
    ).toBe(false);
  });

  it("treats a crawler or an automation as ordinary unless the field says otherwise", () => {
    expect(
      needsApproval({ field: "word_count", source: "crawler", oldValue: 10, newValue: 20 }),
    ).toBe(false);
    expect(
      needsApproval({ field: "canonical_url", source: "automation", oldValue: "a", newValue: "b" }),
    ).toBe(true);
  });
});
