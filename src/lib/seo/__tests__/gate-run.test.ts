import { describe, expect, it } from "vitest";
import { expectedSlotHreflang, prepareGateRun, type GateInput, type GateRow } from "../gate-run";

const row = (url: string, eligible = true, kind = "slot"): GateRow => ({
  url,
  entity_type: kind,
  state: eligible ? "READY_FOR_INDEX" : "UNVERIFIED",
  indexable: eligible,
  sitemap_eligible: eligible,
  fingerprint_class: "ORIGINAL",
  blocking_reason: eligible ? null : "not published",
});
const input = (decisions: GateRow[], overrides: Partial<GateInput> = {}): GateInput => ({
  decisions,
  fingerprints: [],
  expectedSignature: "fixture",
  kinds: ["slot"],
  maxDropPercent: 2,
  crossOnly: false,
  ...overrides,
});
describe("whole-run gate safeguards", () => {
  it("reports evaluated, blocked and excluded counts separately after the complete plan", () => {
    const before = [row("/a"), row("/b"), row("/c")];
    const blocked = { ...row("/b", false), state: "BLOCKED" };
    const plan = prepareGateRun(before, [], input([row("/a"), blocked]));
    expect(plan.stats).toMatchObject({
      evaluated: 2,
      currentTotal: 3,
      projectedTotal: 3,
      currentEligible: 3,
      projectedEligible: 1,
      projectedIneligible: 2,
      currentBlocked: 0,
      projectedBlocked: 1,
      currentByState: { READY_FOR_INDEX: 3 },
      projectedByState: { READY_FOR_INDEX: 1, BLOCKED: 1, UNVERIFIED: 1 },
      lost: 2,
      gained: 0,
    });
  });
  it("compares nested decision records without treating key order or evaluation time as a change", () => {
    const before = [
      {
        ...row("/a"),
        evaluated_at: "2026-10-22T12:00:00.000Z",
        evidence: { source: "live", checks: ["title", "canonical"] },
      },
    ];
    const after = [
      {
        evidence: { checks: ["title", "canonical"], source: "live" },
        ...row("/a"),
        evaluated_at: "2026-10-23T12:00:00.000Z",
      },
    ];

    expect(prepareGateRun(before, [], input(after)).stats.verdictChanges).toBe(0);
    expect(
      prepareGateRun(before, [], input([{ ...after[0], evidence: { source: "changed" } }])).stats
        .verdictChanges,
    ).toBe(1);
  });
  it("exact duplicates keep priority inside a larger country-swap group", () => {
    const rows = [row("/a"), row("/b"), row("/c")];
    const prints = [
      { url: "/a", layer: "body", hash: "exact" },
      { url: "/b", layer: "body", hash: "exact" },
      ...rows.map((value) => ({ url: value.url, layer: "body_masked", hash: "masked" })),
    ];
    const plan = prepareGateRun(rows, [], input(rows, { fingerprints: prints }));
    expect(plan.rows.find((value) => value.url === "/a")?.fingerprint_class).toBe(
      "EXACT_DUPLICATE",
    );
    expect(plan.rows.find((value) => value.url === "/c")?.fingerprint_class).toBe(
      "LOW_VALUE_DUPLICATE",
    );
  });
  it("counts filled ISO siblings dynamically, plus x-default", () => {
    const siblings = Array.from({ length: 100 }, (_, at) => ({
      status: at < 79 ? "occupied" : "vacant",
      country_code: "US",
    }));
    expect(expectedSlotHreflang(siblings)).toBe(80);
    expect(expectedSlotHreflang([{ status: "occupied", country_code: null }])).toBe(1);
    expect(expectedSlotHreflang([{ status: "reserved", country_code: "US" }])).toBe(1);
  });
  it("a simulated 5% drop stops without mutating existing rows", () => {
    const before = Array.from({ length: 100 }, (_, i) => row(`/slot/${i}`));
    const next = before.map((value, i) => row(value.url, i >= 5));
    const plan = prepareGateRun(before, [], input(next));
    expect(plan).toMatchObject({
      stopped: true,
      stats: { lost: 5, lossPercent: 5, projectedEligible: 95 },
    });
    expect(before.every((value) => value.sitemap_eligible)).toBe(true);
  });
  it("exactly 2% is allowed, above 2% stops; threshold is configurable", () => {
    const before = Array.from({ length: 100 }, (_, i) => row(`/slot/${i}`));
    expect(prepareGateRun(before, [], input(before.slice(2))).stopped).toBe(false);
    expect(prepareGateRun(before, [], input(before.slice(3))).stopped).toBe(true);
    expect(prepareGateRun(before, [], input(before.slice(3), { maxDropPercent: 5 })).stopped).toBe(
      false,
    );
  });
  it("gained pages cannot hide loss of existing eligible pages", () => {
    const before = Array.from({ length: 100 }, (_, i) => row(`/slot/${i}`));
    const next = [...before.slice(5), ...Array.from({ length: 20 }, (_, i) => row(`/new/${i}`))];
    expect(prepareGateRun(before, [], input(next))).toMatchObject({
      stopped: true,
      stats: { lost: 5, gained: 20, projectedEligible: 115 },
    });
  });
  it("scope does not demote another kind; stale fingerprints do not block fresh pages", () => {
    const before = [row("/s"), row("/product", true, "product"), row("/vacant", false)];
    const hashes = [
      { url: "/vacant", layer: "body", hash: "same" },
      { url: "/product", layer: "body", hash: "same" },
    ];
    const plan = prepareGateRun(
      before,
      hashes,
      input([row("/s"), row("/vacant", false)], {
        fingerprints: [{ url: "/s", layer: "body", hash: "same" }],
      }),
    );
    expect(plan.rows).toHaveLength(2);
    expect(plan.stats.projectedEligible).toBe(1);
    expect(plan.stats.exactDuplicateGroups).toBe(0);
  });
  it("cross-slice duplicates are included before the drop threshold", () => {
    const before = [row("/a"), row("/b")];
    const plan = prepareGateRun(
      before,
      [],
      input(before, {
        fingerprints: before.map((value) => ({ url: value.url, layer: "body", hash: "same" })),
      }),
    );
    expect(plan).toMatchObject({ stopped: true, stats: { lost: 2, exactDuplicateGroups: 1 } });
    expect(plan.rows.every((value) => value.state === "CONTENT_NOT_READY")).toBe(true);
  });
  it("cross-only keeps first blocking reasons and excludes other kinds", () => {
    const before = [row("/a"), row("/b", false), row("/p", true, "product")];
    const hashes = before.map((value) => ({ url: value.url, layer: "body_masked", hash: "same" }));
    const plan = prepareGateRun(before, hashes, input([], { crossOnly: true }));
    expect(plan.stats.maskedDuplicateGroups).toBe(1);
    expect(plan.rows.find((value) => value.url === "/b")?.blocking_reason).toBe("not published");
    expect(plan.rows).toHaveLength(2);
  });
  it("rejects duplicate URLs, out-of-scope decisions and unrelated fingerprints", () => {
    expect(() => prepareGateRun([], [], input([row("/a"), row("/a")]))).toThrow("Duplicate");
    expect(() => prepareGateRun([], [], input([row("/p", true, "product")]))).toThrow("scope");
    expect(() =>
      prepareGateRun(
        [],
        [],
        input([row("/a")], {
          fingerprints: [{ url: "/other", hash: "x", layer: "body" }],
        }),
      ),
    ).toThrow("inventory");
  });
});
