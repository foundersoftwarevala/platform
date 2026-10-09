// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it } from "vitest";

import { all, closeDb, db, MIGRATIONS, schemaVersion } from "./db.server.ts";

/* Disposable databases only. */

const root = mkdtempSync(join(tmpdir(), "vala-migrate-"));

afterAll(() => {
  closeDb();
  rmSync(root, { recursive: true, force: true });
});

const indexNames = (table: string) =>
  all<{ name: string }>(`pragma index_list(${table})`).map((r) => r.name);
const plan = (sql: string, ...params: unknown[]) =>
  all<{ detail: string }>(`explain query plan ${sql}`, ...params)
    .map((r) => r.detail)
    .join(" | ");

describe("migrations", () => {
  it("leaves migration 1 exactly as released in 23d5594", () => {
    const m1 = MIGRATIONS[0].replace(/\r\n/g, "\n");
    expect(createHash("sha256").update(m1).digest("hex")).toBe(
      "e21d2d04c061d211f0d7a55047617dc28f2ac59749ff3da2562ffca52ece6f9f",
    );
  });

  it("creates a new database at version 2 with the indexes", () => {
    process.env.VALA_AI_DATA_DIR = join(root, "fresh");
    closeDb();
    expect(schemaVersion()).toBe(2);
    expect(indexNames("evidence")).toContain("evidence_task");
    expect(indexNames("approvals")).toContain("approvals_status");
    expect(indexNames("releases")).toContain("releases_project");
  });

  it("upgrades an existing version 1 database without touching its data", () => {
    const dir = join(root, "upgrade");
    mkdirSync(dir, { recursive: true });
    const v1 = new DatabaseSync(join(dir, "vala.db"));
    v1.exec(MIGRATIONS[0]);
    v1.exec("pragma user_version = 1");
    const now = new Date().toISOString();
    v1.prepare(
      "insert into projects (id, name, source_kind, created_by, created_at, updated_at) values (?,?,?,?,?,?)",
    ).run("VP-OLD", "Old", "empty", "u", now, now);
    v1.prepare(
      "insert into evidence (id, project_id, label, command, duration_ms, output_path, output_sha256, output_tail, producer, verdict, created_at) values (?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      "EV-OLD",
      "VP-OLD",
      "l",
      "node --test",
      1,
      "/x",
      "0".repeat(64),
      "",
      "agent",
      "pass",
      now,
    );
    v1.close();

    process.env.VALA_AI_DATA_DIR = dir;
    closeDb();
    expect(schemaVersion()).toBe(2);
    expect(all("select id from projects")).toEqual([{ id: "VP-OLD" }]);
    expect(all("select id from evidence")).toEqual([{ id: "EV-OLD" }]);
    expect(indexNames("evidence")).toContain("evidence_task");
    expect(
      (db().prepare("pragma integrity_check").get() as { integrity_check: string }).integrity_check,
    ).toBe("ok");
  });

  it("is used by the queries the screens run", () => {
    expect(plan("select * from evidence where task_id = ? order by created_at asc", "T-X")).toMatch(
      /evidence_task/,
    );
    expect(
      plan(
        "select * from approvals where status = ? order by requested_at desc limit 300",
        "pending",
      ),
    ).toMatch(/approvals_status/);
    expect(
      plan("select * from releases where project_id = ? order by created_at desc", "VP-OLD"),
    ).toMatch(/releases_project/);
  });

  it("does not run again on a database already at version 2", () => {
    closeDb();
    expect(schemaVersion()).toBe(2);
    expect(indexNames("evidence").filter((n) => n === "evidence_task")).toHaveLength(1);
  });
});
