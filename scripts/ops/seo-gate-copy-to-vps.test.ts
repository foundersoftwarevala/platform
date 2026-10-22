import { describe, expect, it } from "vitest";
import { classifyRows, rowHash } from "./seo-gate-copy-to-vps.mjs";

const decisions = {
  name: "seo_indexing_decisions",
  key: (row: { url: string }) => row.url,
};

describe("SEO gate VPS copy safety", () => {
  it("classifies absent keys as inserts and leaves matching rows alone", () => {
    const existing = new Map([["/same", rowHash({ url: "/same", state: "INDEX" })]]);
    const result = classifyRows(
      [
        { url: "/same", state: "INDEX" },
        { url: "/new", state: "UNVERIFIED" },
      ],
      existing,
      decisions,
    );

    expect(result).toMatchObject({
      missing: [{ url: "/new", state: "UNVERIFIED" }],
      conflicts: 0,
    });
  });

  it("reports same-key differences without treating them as inserts", () => {
    const existing = new Map([["/same", { url: "/same", state: "INDEX" }]]);
    const result = classifyRows([{ url: "/same", state: "NOINDEX" }], existing, decisions);

    expect(result).toMatchObject({
      missing: [],
      conflicts: 1,
      conflictFields: { state: 1 },
      timestampDirection: { sourceNewer: 0, targetNewer: 0, same: 0 },
    });
  });

  it("canonicalizes object key order and equivalent timestamp formats", () => {
    expect(rowHash({ state: "INDEX", evaluated_at: "2026-10-18T12:30:00.000Z" })).toBe(
      rowHash({ evaluated_at: new Date("2026-10-18T12:30:00.000Z"), state: "INDEX" }),
    );
  });
});
