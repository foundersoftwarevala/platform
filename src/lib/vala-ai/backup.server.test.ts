// @vitest-environment node
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { verifyAuditChain } from "./audit.server.ts";
import type { Operator } from "./auth.server.ts";
import { backupDatabase, inspectDatabase, restoreDatabase } from "./backup.server.ts";
import { productionDataDirProblem } from "./config.server.ts";
import { closeDb, db } from "./db.server.ts";
import { approveRequirement, createProject, listProjects, saveDraft } from "./projects.server.ts";
import { sha256 } from "./util.server.ts";

/* Disposable data only: everything lives under a fresh temporary directory. */

const root = mkdtempSync(join(tmpdir(), "vala-backup-"));
const original = join(root, "data");
const restored = join(root, "restored");
const backups = join(root, "backups");
process.env.VALA_AI_DATA_DIR = original;
process.env.VALA_AI_WORKER = "off";
const owner: Operator = { id: "u-owner", email: "owner@test.local", name: "owner", role: "owner" };
let projectId = "";
let backupPath = "";

beforeAll(() => {
  const p = createProject({ name: "Backup subject", sourceKind: "empty" }, owner);
  projectId = p.project.id;
  const d = saveDraft(
    projectId,
    { title: "t", body: "b", checks: [{ label: "c", command: "node --test" }] },
    owner,
  );
  approveRequirement(d.id, owner);
});

afterAll(() => {
  closeDb();
  rmSync(root, { recursive: true, force: true });
});

describe("backup", () => {
  it("writes a consistent copy with a matching SHA-256 and a clean integrity check", () => {
    const r = backupDatabase({ dir: backups, keep: 14 });
    backupPath = r.path;
    expect(existsSync(r.path)).toBe(true);
    expect(readFileSync(`${r.path}.sha256`, "utf8").split(/\s+/)[0]).toBe(
      sha256(readFileSync(r.path)),
    );
    expect(inspectDatabase(r.path)).toMatchObject({ ok: true, detail: "ok" });
    expect(r.tables).toBeGreaterThanOrEqual(14);
  });

  it("keeps only the newest copies", () => {
    const dir = join(root, "retention");
    const made = [1, 2, 3, 4].map((h) =>
      backupDatabase({ dir, keep: 2, now: new Date(Date.UTC(2026, 9, 9, h)) }),
    );
    const left = readdirSync(dir)
      .filter((f) => f.endsWith(".db"))
      .sort();
    expect(left).toEqual(made.slice(2).map((m) => m.path.split(/[\\/]/).pop()));
    expect(made[3].removed).toEqual([made[1].path.split(/[\\/]/).pop()]);
    expect(readdirSync(dir).filter((f) => f.endsWith(".sha256"))).toHaveLength(2);
  });

  it("refuses an invalid retention count", () => {
    expect(() => backupDatabase({ dir: backups, keep: 0 })).toThrow(/at least 1/);
  });
});

describe("restore", () => {
  it("refuses a copy that does not match its hash, or has no hash", () => {
    const tampered = join(root, "tampered.db");
    writeFileSync(tampered, readFileSync(backupPath));
    writeFileSync(`${tampered}.sha256`, `${"0".repeat(64)}  tampered.db\n`);
    expect(() => restoreDatabase(tampered, join(root, "never"))).toThrow(/does not match/);
    const bare = join(root, "bare.db");
    writeFileSync(bare, readFileSync(backupPath));
    expect(() => restoreDatabase(bare, join(root, "never"))).toThrow(/no \.sha256/);
    expect(existsSync(join(root, "never", "vala.db"))).toBe(false);
  });

  it("refuses a file that is not a healthy database even with a matching hash", () => {
    const junk = join(root, "junk.db");
    writeFileSync(junk, "not a database");
    writeFileSync(`${junk}.sha256`, `${sha256(readFileSync(junk))}  junk.db\n`);
    expect(() => restoreDatabase(junk, join(root, "never"))).toThrow();
  });

  it("restores into a fresh data directory that the application can read", () => {
    closeDb();
    const r = restoreDatabase(backupPath, restored);
    expect(r.previous).toBeNull();
    process.env.VALA_AI_DATA_DIR = restored;
    const projects = listProjects();
    expect(projects.map((p) => p.id)).toContain(projectId);
    expect(projects.find((p) => p.id === projectId)?.approved_version).toBe(1);
    expect(verifyAuditChain().ok).toBe(true);
    expect(inspectDatabase(join(restored, "vala.db")).ok).toBe(true);
  });

  it("keeps the database it replaces", () => {
    closeDb();
    const r = restoreDatabase(backupPath, restored);
    expect(r.previous).toMatch(/vala\.db\.replaced-/);
    expect(existsSync(r.previous!)).toBe(true);
    process.env.VALA_AI_DATA_DIR = original;
  });
});

describe("production data directory", () => {
  it("must be set and outside the application directory", () => {
    const app = join(root, "app");
    expect(productionDataDirProblem({ NODE_ENV: "development" }, app)).toBeNull();
    expect(productionDataDirProblem({ NODE_ENV: "production" }, app)).toMatch(/not set/);
    expect(
      productionDataDirProblem(
        { NODE_ENV: "production", VALA_AI_DATA_DIR: join(app, ".vala-ai") },
        app,
      ),
    ).toMatch(/inside the application/);
    expect(
      productionDataDirProblem({ NODE_ENV: "production", VALA_AI_DATA_DIR: app }, app),
    ).toMatch(/inside the application/);
    expect(
      productionDataDirProblem(
        { NODE_ENV: "production", VALA_AI_DATA_DIR: join(root, "var-lib-vala") },
        app,
      ),
    ).toBeNull();
  });

  it("stops the database from opening when misconfigured", () => {
    closeDb();
    const env = process.env.NODE_ENV;
    const dir = process.env.VALA_AI_DATA_DIR;
    process.env.NODE_ENV = "production";
    process.env.VALA_AI_DATA_DIR = join(process.cwd(), ".vala-ai-test-inside");
    try {
      expect(() => db()).toThrow(/inside the application directory/);
    } finally {
      process.env.NODE_ENV = env;
      process.env.VALA_AI_DATA_DIR = dir;
    }
  });
});
