// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { verifyAuditChain } from "./audit.server.ts";
import { all, closeDb } from "./db.server.ts";
import { importLibrary, listLibrary } from "./library.server.ts";

const root = mkdtempSync(join(tmpdir(), "vala-library-"));
const H = (c: string) => c.repeat(64);

beforeAll(() => {
  process.env.VALA_AI_DATA_DIR = root;
  closeDb();
});
afterAll(() => {
  closeDb();
  rmSync(root, { recursive: true, force: true });
});

const item = (over: Record<string, unknown> = {}) => ({
  name: "EduSmart",
  version: "2.1.0",
  relPath: "school/edusmart",
  stack: ["php", "laravel", "mysql"],
  features: ["school", "fees", "attendance", "exam"],
  fileCount: 1200,
  sizeBytes: 52_000_000,
  manifestSha256: H("a"),
  ...over,
});

describe("software library index", () => {
  it("imports metadata and audits it", () => {
    const out = importLibrary({ rootLabel: "SSD-MASTER", items: [item(), item({ name: "ShopKart", relPath: "retail/shopkart", features: ["pos", "inventory"], stack: ["react"], manifestSha256: H("b") })] }, "op-1");
    expect(out).toEqual({ created: 2, updated: 0, total: 2 });
    expect(all("select * from audit_log where action = 'library.import'")).toHaveLength(1);
    expect(verifyAuditChain().ok).toBe(true);
  });

  it("re-importing the same folder updates instead of duplicating", () => {
    const out = importLibrary({ rootLabel: "SSD-MASTER", items: [item({ version: "2.2.0", manifestSha256: H("c") })] }, "op-1");
    expect(out).toEqual({ created: 0, updated: 1, total: 1 });
    const rows = listLibrary("").items.filter((i) => i.rel_path === "school/edusmart");
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe("2.2.0");
  });

  it("searches by feature and stack, best match first", () => {
    const res = listLibrary("school fees mysql");
    expect(res.items[0].name).toBe("EduSmart");
    expect(listLibrary("inventory").items.map((i) => i.name)).toEqual(["ShopKart"]);
  });

  it("refuses file contents, path escapes and bad hashes", () => {
    expect(() => importLibrary({ rootLabel: "X", items: [{ ...item(), content: "<?php" }] }, "op-1")).toThrow(/metadata only/);
    expect(() => importLibrary({ rootLabel: "X", items: [item({ relPath: "../etc" })] }, "op-1")).toThrow(/inside the scanned folder/);
    expect(() => importLibrary({ rootLabel: "X", items: [item({ manifestSha256: "abc" })] }, "op-1")).toThrow(/SHA-256/);
    expect(() => importLibrary({ items: [item()] }, "op-1")).toThrow(/rootLabel/);
  });
});
