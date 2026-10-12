import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GateInput, GateRow } from "../gate-run";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  unsafe: vi.fn(),
  begin: vi.fn(),
  rows: [] as GateRow[],
  signature: "a".repeat(32),
}));
vi.mock("postgres", () => ({
  default: () =>
    Object.assign(mocks.query, {
      unsafe: mocks.unsafe,
      begin: mocks.begin,
    }),
}));
import { saveGateRun } from "../seo-store.server";
const row = (url: string, eligible = true): GateRow => ({
  url,
  entity_type: "slot",
  state: eligible ? "READY_FOR_INDEX" : "UNVERIFIED",
  indexable: eligible,
  sitemap_eligible: eligible,
  fingerprint_class: "ORIGINAL",
  blocking_reason: null,
});
const input = (decisions: GateRow[]): GateInput => ({
  kinds: ["slot"],
  decisions,
  fingerprints: [],
  expectedSignature: "a".repeat(32),
  maxDropPercent: 2,
  crossOnly: false,
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SEO_STORE", "vps");
  vi.stubEnv("VPS_DATABASE_URL", "postgres://fixture@localhost/fixture");
  mocks.rows = [row("/a")];
  mocks.signature = "a".repeat(32);
  mocks.query.mockImplementation(async (parts: TemplateStringsArray) => {
    const sql = parts.join("?");
    if (sql.includes("md5(")) return [{ signature: mocks.signature }];
    if (sql.includes("select url, layer, hash")) return [];
    if (sql.includes("current_database()")) return [{ database: "fixture" }];
    if (
      sql.includes("lock table") ||
      sql.includes("set transaction") ||
      sql.includes("delete from")
    )
      return [];
    throw new Error(`Unexpected SQL ${sql}`);
  });
  mocks.unsafe.mockImplementation(async (sql: string) => {
    if (sql.startsWith("select ")) return structuredClone(mocks.rows);
    if (sql.startsWith("insert ")) return [];
    throw new Error(`Unexpected SQL ${sql}`);
  });
  mocks.begin.mockImplementation(
    async (options: unknown, callback?: (tx: unknown) => Promise<unknown>) =>
      typeof options === "function"
        ? options(Object.assign(mocks.query, { unsafe: mocks.unsafe }))
        : callback!(Object.assign(mocks.query, { unsafe: mocks.unsafe })),
  );
});
afterEach(() => vi.unstubAllEnvs());
describe("atomic gate store", () => {
  it("dry-run never inserts or deletes either table", async () => {
    const report = await saveGateRun(input([row("/a")]), true);
    expect(report.saved).toBe(false);
    expect(mocks.unsafe.mock.calls.every(([sql]) => sql.startsWith("select "))).toBe(true);
    expect(mocks.query.mock.calls.some(([parts]) => parts.join("").includes("delete from"))).toBe(
      false,
    );
  });
  it("stop rule refuses all decisions and fingerprint writes", async () => {
    const report = await saveGateRun(input([row("/a", false)]), false);
    expect(report).toMatchObject({ stopped: true, saved: false, lossPercent: 100 });
    expect(mocks.unsafe.mock.calls.every(([sql]) => sql.startsWith("select "))).toBe(true);
    expect(mocks.query.mock.calls.some(([parts]) => parts.join("").includes("delete from"))).toBe(
      false,
    );
  });
  it("concurrent changes refuse commit before inserts", async () => {
    mocks.signature = "b".repeat(32);
    await expect(saveGateRun(input([row("/a")]), false)).rejects.toThrow("changed");
    expect(mocks.unsafe.mock.calls.every(([sql]) => sql.startsWith("select "))).toBe(true);
  });
  it("approved saves run inside one transaction and clear stale scoped fingerprints", async () => {
    const report = await saveGateRun(input([row("/a")]), false);
    expect(report.saved).toBe(true);
    expect(mocks.begin).toHaveBeenCalledTimes(1);
    expect(mocks.unsafe.mock.calls.some(([sql]) => sql.includes("$1::text::json"))).toBe(true);
    expect(mocks.query.mock.calls.some(([parts]) => parts.join("").includes("delete from"))).toBe(
      true,
    );
  });
  it("a failed fingerprint write rejects the transaction, never returns saved", async () => {
    const request = input([row("/a")]);
    request.fingerprints = [{ url: "/a", hash: "x", layer: "body" }];
    mocks.unsafe.mockImplementation(async (sql: string) => {
      if (sql.startsWith("select ")) return structuredClone(mocks.rows);
      if (sql.includes("public.seo_fingerprints")) throw new Error("fingerprint write failed");
      return [];
    });
    await expect(saveGateRun(request, false)).rejects.toThrow("fingerprint write failed");
    expect(mocks.begin).toHaveBeenCalledTimes(1);
  });
});
